/**
 * fotos.js — álbum colaborativo (upload direto para o Google Drive).
 *
 * Para cada arquivo:
 *   1. pede ao Apps Script uma sessão de upload (POST criarSessao);
 *   2. envia os BYTES direto para a URL da sessão com PUT (progresso real);
 *   3. avisa o Apps Script que terminou (POST confirmar).
 * Um arquivo que falha não derruba os outros; dá pra tentar de novo.
 */
(function () {
  'use strict';

  var CFG = window.FOTOS_CONFIG || {};
  var BASE = CFG.BASE_URL || '';
  var LIMITES = { foto: 50, video: 300, outro: 50 }; // MB (só para mensagem amigável)

  // Missões do "jogo". As 4 primeiras são as do cartão impresso; as marcadas
  // como 'bonus' existem só no site. Para mudar/adicionar, edite só esta lista.
  var MISSOES = [
    { id: 'mesa',     label: 'Foto de toda a mesa', grupo: 'card' },
    { id: 'selfie',   label: 'Uma selfie',          grupo: 'card' },
    { id: 'danca',    label: 'A primeira dança',    grupo: 'card' },
    { id: 'criativo', label: 'Seja criativo!',      grupo: 'card' },
    { id: 'brinde',   label: 'Um brinde',           grupo: 'bonus' },
    { id: 'casal',    label: 'O casal juntos',      grupo: 'bonus' },
    { id: 'pista',    label: 'A galera na pista',   grupo: 'bonus' }
  ];
  var missaoAtual = '';

  var elNome   = document.getElementById('nome');
  var elInput  = document.getElementById('arquivo');
  var elBotao  = document.getElementById('btn-add');
  var elAviso  = document.getElementById('aviso');
  var elLista  = document.getElementById('lista');
  var elResumo = document.getElementById('resumo');
  var elHp     = document.getElementById('hp');
  var elBanner = document.getElementById('missao-banner');

  var ticket = null;
  var fila = [];         // itens { file, el, barra, estado }
  var idx = 0;           // ponteiro sequencial
  var enviando = false;
  var cont = { ok: 0, erro: 0 };

  // ---- API ----------------------------------------------------------------
  function post(action, corpo) {
    return fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
      body: JSON.stringify(assign({ action: action }, corpo))
    }).then(function (r) { return r.json(); });
  }
  function pegarTicket() {
    return fetch(BASE + '?action=ticket')
      .then(function (r) { return r.json(); })
      .then(function (r) { if (r && r.ok) ticket = r.ticket; return r; });
  }
  function assign(a, b) { for (var k in b) if (b.hasOwnProperty(k)) a[k] = b[k]; return a; }

  // ---- Nome do convidado (lembra entre envios / reaproveita o login) ------
  function nomeSalvo() {
    try {
      return (localStorage.getItem('fm.fotos.nome') ||
              localStorage.getItem('caseuri.nome') || '').trim();
    } catch (_) { return ''; }
  }
  function lembrarNome(n) { try { if (n) localStorage.setItem('fm.fotos.nome', n); } catch (_) {} }

  // Se já sabemos o nome (deste álbum ou do login no site), não pergunta de
  // novo: mostra "Enviando como X · trocar".
  function montarNome() {
    var salvo = nomeSalvo();
    if (!salvo) return;
    elNome.value = salvo;
    var campo = document.querySelector('.campo-nome');
    if (!campo) return;
    campo.hidden = true;
    var box = document.createElement('div');
    box.className = 'nome-compacto';
    box.innerHTML = 'Enviando como <strong></strong> · <a href="#" class="trocar">trocar</a>';
    box.querySelector('strong').textContent = salvo;
    campo.parentNode.insertBefore(box, campo);
    box.querySelector('.trocar').addEventListener('click', function (ev) {
      ev.preventDefault();
      box.remove(); campo.hidden = false; elNome.focus();
    });
  }

  // ---- Galeria (álbum) ----------------------------------------------------
  var tabEnviar  = document.getElementById('tab-enviar');
  var tabAlbum   = document.getElementById('tab-album');
  var paneEnviar = document.getElementById('pane-enviar');
  var paneAlbum  = document.getElementById('pane-album');
  var grade      = document.getElementById('grade');
  var albumMsg   = document.getElementById('album-msg');
  var lb         = document.getElementById('lb');
  var lbMedia    = document.getElementById('lb-media');
  var itensAlbum = [], filtroAtual = 'todos', albumCarregado = false, lbLista = [], lbIdx = 0;

  function setupAbas() {
    tabEnviar.addEventListener('click', function () { mostrarPane('enviar'); });
    if (tabMissoes) tabMissoes.addEventListener('click', function () { mostrarPane('missoes'); });
    tabAlbum.addEventListener('click', function () { mostrarPane('album'); });
    Array.prototype.forEach.call(document.querySelectorAll('.filtro'), function (b) {
      b.addEventListener('click', function () {
        filtroAtual = b.getAttribute('data-f');
        Array.prototype.forEach.call(document.querySelectorAll('.filtro'), function (x) {
          x.classList.toggle('ativa', x === b);
        });
        renderGrade();
      });
    });
    document.getElementById('lb-fechar').addEventListener('click', fecharLb);
    document.getElementById('lb-prev').addEventListener('click', function () { navLb(-1); });
    document.getElementById('lb-next').addEventListener('click', function () { navLb(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) fecharLb(); });
  }
  function mostrarPane(qual) {
    paneEnviar.hidden = qual !== 'enviar';
    paneAlbum.hidden  = qual !== 'album';
    if (paneMissoes) paneMissoes.hidden = qual !== 'missoes';
    tabEnviar.classList.toggle('ativa', qual === 'enviar');
    tabAlbum.classList.toggle('ativa', qual === 'album');
    if (tabMissoes) tabMissoes.classList.toggle('ativa', qual === 'missoes');
    if (qual === 'album' && !albumCarregado) carregarAlbum();
    if (qual === 'missoes') renderMissoes();
  }
  function carregarAlbum() {
    albumMsg.hidden = false; albumMsg.classList.remove('erro'); albumMsg.textContent = 'Carregando…';
    grade.innerHTML = '';
    fetch(BASE + '?action=listar').then(function (r) { return r.json(); }).then(function (r) {
      albumCarregado = true;
      itensAlbum = (r && r.itens) || [];
      renderGrade();
    }).catch(function () {
      albumMsg.hidden = false; albumMsg.classList.add('erro');
      albumMsg.textContent = 'Não deu pra carregar agora. Tente de novo.';
    });
  }
  function thumbUrl(id, w) { return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (w || 600); }
  function renderGrade() {
    grade.innerHTML = '';
    var lista = itensAlbum.filter(function (it) { return filtroAtual === 'todos' || it.cat === filtroAtual; });
    if (!lista.length) {
      albumMsg.hidden = false; albumMsg.classList.remove('erro');
      albumMsg.textContent = albumCarregado ? 'Nada por aqui ainda. Envie a primeira foto!' : 'Carregando…';
      return;
    }
    albumMsg.hidden = true;
    lista.forEach(function (it, idx) {
      var cel = document.createElement('button'); cel.type = 'button'; cel.className = 'cel';
      var img = document.createElement('img'); img.loading = 'lazy'; img.alt = ''; img.src = thumbUrl(it.id, 600);
      cel.appendChild(img);
      if (it.cat === 'video') { var p = document.createElement('span'); p.className = 'cel-play'; p.textContent = '▶'; cel.appendChild(p); }
      if (it.nome) { var nm = document.createElement('span'); nm.className = 'cel-nome'; nm.textContent = it.nome; cel.appendChild(nm); }
      if (it.missao && labelMissao(it.missao)) { var mt = document.createElement('span'); mt.className = 'cel-missao'; mt.textContent = labelMissao(it.missao); cel.appendChild(mt); }
      cel.addEventListener('click', function () { abrirLb(lista, idx); });
      grade.appendChild(cel);
    });
  }
  function abrirLb(lista, idx) { lbLista = lista; lbIdx = idx; mostrarLb(); lb.hidden = false; document.body.style.overflow = 'hidden'; }
  function fecharLb() { lb.hidden = true; lbMedia.innerHTML = ''; document.body.style.overflow = ''; }
  function navLb(d) { if (!lbLista.length) return; lbIdx = (lbIdx + d + lbLista.length) % lbLista.length; mostrarLb(); }
  function mostrarLb() {
    var it = lbLista[lbIdx]; lbMedia.innerHTML = '';
    var cap = document.getElementById('lb-cap');
    if (cap) {
      var partes = [];
      if (it.nome) partes.push('Enviado por ' + it.nome);
      if (it.missao && labelMissao(it.missao)) partes.push('Missão: ' + labelMissao(it.missao));
      cap.textContent = partes.join(' · ');
    }
    // Baixar o original direto do Drive (o arquivo já é público por link).
    var baixar = document.getElementById('lb-baixar');
    if (baixar) {
      baixar.href = 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(it.id);
      baixar.setAttribute('aria-label', it.cat === 'video' ? 'Baixar vídeo original' : 'Baixar foto original');
    }
    if (it.cat === 'video') {
      var ifr = document.createElement('iframe');
      ifr.src = 'https://drive.google.com/file/d/' + it.id + '/preview';
      ifr.setAttribute('allow', 'autoplay'); ifr.setAttribute('allowfullscreen', '');
      lbMedia.appendChild(ifr);
    } else {
      var img = document.createElement('img'); img.alt = ''; img.src = thumbUrl(it.id, 1600);
      lbMedia.appendChild(img);
    }
  }

  // ---- Missões (jogo) -----------------------------------------------------
  var tabMissoes   = document.getElementById('tab-missoes');
  var paneMissoes  = document.getElementById('pane-missoes');
  var missoesLista = document.getElementById('missoes-lista');

  function labelMissao(id) {
    for (var i = 0; i < MISSOES.length; i++) if (MISSOES[i].id === id) return MISSOES[i].label;
    return '';
  }
  function missoesFeitas() {
    try { return JSON.parse(localStorage.getItem('fm.fotos.missoes') || '{}') || {}; }
    catch (_) { return {}; }
  }
  function marcarMissaoFeita(id) {
    if (!id) return;
    try { var o = missoesFeitas(); o[id] = true; localStorage.setItem('fm.fotos.missoes', JSON.stringify(o)); }
    catch (_) {}
  }
  function renderMissoes() {
    if (!missoesLista) return;
    var feitas = missoesFeitas();
    missoesLista.innerHTML = '';
    [{ chave: 'card', titulo: 'Do seu cartão' }, { chave: 'bonus', titulo: 'Bônus (só no site)' }].forEach(function (g) {
      var doGrupo = MISSOES.filter(function (m) { return m.grupo === g.chave; });
      if (!doGrupo.length) return;
      var h = document.createElement('p');
      h.className = 'missao-grupo'; h.textContent = g.titulo;
      missoesLista.appendChild(h);
      doGrupo.forEach(function (m) {
        var feita = !!feitas[m.id];
        var row = document.createElement('div');
        row.className = 'missao-row' + (feita ? ' feita' : '');
        var marca = document.createElement('span');
        marca.className = 'missao-check'; marca.textContent = feita ? '✓' : '';
        var lab = document.createElement('span');
        lab.className = 'missao-label'; lab.textContent = m.label;
        var bt = document.createElement('button');
        bt.type = 'button'; bt.className = 'missao-btn';
        bt.textContent = feita ? 'Enviar mais' : 'Enviar';
        bt.addEventListener('click', function () { escolherMissao(m.id); });
        row.appendChild(marca); row.appendChild(lab); row.appendChild(bt);
        missoesLista.appendChild(row);
      });
    });
  }
  function escolherMissao(id) {
    missaoAtual = id || '';
    atualizarBanner();
    mostrarPane('enviar');
    if (!elBotao.disabled) elInput.click();
  }
  function atualizarBanner() {
    if (!elBanner) return;
    elBanner.hidden = false;
    if (missaoAtual) {
      elBanner.className = 'missao-banner ativa';
      elBanner.innerHTML = 'Missão: <strong></strong> · <a href="#" class="link-missao">enviar livre</a>';
      elBanner.querySelector('strong').textContent = labelMissao(missaoAtual);
      elBanner.querySelector('.link-missao').addEventListener('click', function (ev) {
        ev.preventDefault(); missaoAtual = ''; atualizarBanner();
      });
    } else {
      elBanner.className = 'missao-banner';
      elBanner.innerHTML = 'Envio livre · <a href="#" class="link-missao">escolher missão</a>';
      elBanner.querySelector('.link-missao').addEventListener('click', function (ev) {
        ev.preventDefault(); mostrarPane('missoes');
      });
    }
  }

  // ---- Inicialização ------------------------------------------------------
  function iniciar() {
    montarNome();
    setupAbas();
    atualizarBanner();
    // Link direto para a galeria (ex.: botão "Fotos" da página principal).
    if (location.hash === '#album') mostrarPane('album');
    if (!BASE || BASE.indexOf('COLE_AQUI') === 0) {
      return falhaInicial('Configuração pendente (fotos-config.js).');
    }
    pegarTicket().then(function (r) {
      if (r && r.ok) {
        elBotao.disabled = false;
        elAviso.textContent = 'Pode escolher da galeria. Dá pra enviar vários de uma vez.';
      } else {
        falhaInicial('Não foi possível iniciar agora. Recarregue a página.');
      }
    }).catch(function () {
      falhaInicial('Sem conexão com o servidor. Verifique a internet e recarregue.');
    });
  }
  function falhaInicial(msg) {
    elBotao.disabled = true;
    elAviso.textContent = msg;
    elAviso.classList.add('erro');
  }

  elBotao.addEventListener('click', function () { if (!elBotao.disabled) elInput.click(); });
  elInput.addEventListener('change', function () {
    if (elHp.value) return; // honeypot: bot preencheu → ignora silenciosamente
    var files = Array.prototype.slice.call(elInput.files || []);
    elInput.value = '';
    if (!files.length) return;
    lembrarNome((elNome.value || '').trim());
    elResumo.hidden = true;
    files.forEach(adicionar);
    processar();
  });

  // ---- UI por arquivo -----------------------------------------------------
  function miniatura(file) {
    var box = document.createElement('div');
    box.className = 'thumb';
    var t = (file.type || '').toLowerCase();
    var nome = (file.name || '').toLowerCase();
    var ehVideo = t.indexOf('video/') === 0 || /\.(mp4|mov|m4v|3gp)$/.test(nome);
    var ehHeic  = t.indexOf('heic') >= 0 || t.indexOf('heif') >= 0 || /\.(heic|heif)$/.test(nome);
    try {
      if (ehVideo) {
        var v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'metadata';
        v.src = URL.createObjectURL(file);
        box.appendChild(v);
        var play = document.createElement('span'); play.className = 'thumb-play'; play.textContent = '▶';
        box.appendChild(play);
      } else if (!ehHeic && t.indexOf('image/') === 0) {
        var img = document.createElement('img');
        img.alt = ''; img.src = URL.createObjectURL(file);
        box.appendChild(img);
      } else {
        box.classList.add('thumb-icon'); box.textContent = '🖼';
      }
    } catch (_) { box.classList.add('thumb-icon'); box.textContent = '🖼'; }
    return box;
  }

  function adicionar(file) {
    var el = document.createElement('div');
    el.className = 'item';
    el.innerHTML =
      '<div class="item-top"><span class="item-estado">na fila</span></div>' +
      '<div class="barra"><i></i></div>';
    el.querySelector('.item-top').insertBefore(miniatura(file), el.querySelector('.item-estado'));
    elLista.appendChild(el);
    fila.push({
      file: file, el: el,
      barra: el.querySelector('.barra i'),
      estado: el.querySelector('.item-estado'),
      missao: missaoAtual,
      feito: false
    });
  }

  function processar() {
    if (enviando) return;
    while (idx < fila.length && fila[idx].feito) idx++;
    if (idx >= fila.length) { finalizar(); return; }
    enviando = true;
    enviarUm(fila[idx], function () {
      enviando = false; idx++; processar();
    });
  }

  // ---- Envio de um arquivo ------------------------------------------------
  function enviarUm(item, done) {
    var f = item.file;
    item.el.classList.remove('falhou');
    item.estado.className = 'item-estado';
    item.estado.textContent = 'enviando…';

    post('criarSessao', {
      ticket: ticket,
      nome: (elNome.value || '').trim(),
      origin: location.origin,
      missao: item.missao || '',
      arquivo: { nome: f.name, tipo: f.type, tamanho: f.size }
    }).then(function (r) {
      if (!r || !r.ok) throw r || { erro: 'interno' };
      return enviarBytes(r.uploadUrl, f, item).then(function (fileId) {
        return post('confirmar', { ticket: ticket, registroId: r.registroId, fileId: fileId });
      });
    }).then(function () {
      item.feito = true;
      item.estado.textContent = 'enviado ✓';
      item.estado.classList.add('ok');
      item.barra.style.width = '100%';
      if (item.missao) marcarMissaoFeita(item.missao);
      cont.ok++; done();
    }).catch(function (err) {
      item.feito = true;
      cont.erro++;
      item.el.classList.add('falhou');
      item.estado.textContent = 'falhou';
      item.estado.classList.add('erro');
      mostrarRetry(item);
      // registra a falha (best-effort), sem travar a fila
      done();
      void err;
    });
  }

  function enviarBytes(url, file, item) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) item.barra.style.width = Math.round(e.loaded / e.total * 100) + '%';
      };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          var id = '';
          try { id = JSON.parse(xhr.responseText).id || ''; } catch (_) {}
          resolve(id);
        } else { reject({ erro: 'upload_falhou', http: xhr.status }); }
      };
      xhr.onerror = function () { reject({ erro: 'rede' }); };
      xhr.ontimeout = function () { reject({ erro: 'timeout' }); };
      xhr.send(file);
    });
  }

  function mostrarRetry(item) {
    if (item.el.querySelector('.retry')) return;
    var a = document.createElement('span');
    a.className = 'retry';
    a.textContent = 'tentar de novo';
    a.addEventListener('click', function () {
      a.remove();
      item.feito = false;
      item.barra.style.width = '0';
      cont.erro = Math.max(0, cont.erro - 1);
      // reenvia só este, respeitando a fila
      var i = fila.indexOf(item);
      if (i < idx) idx = i;
      processar();
    });
    item.el.appendChild(a);
  }

  // ---- Encerramento -------------------------------------------------------
  function finalizar() {
    var total = cont.ok + cont.erro;
    if (!total) return;
    if (cont.ok) { albumCarregado = false; renderMissoes(); } // recarrega álbum e atualiza missões
    elResumo.hidden = false;
    var html = '<div class="selo">Obrigado 💛</div>';
    if (cont.ok)  html += '<p>' + cont.ok + ' arquivo(s) enviado(s) com sucesso.</p>';
    if (cont.erro) html += '<p>' + cont.erro + ' não foram enviados — use “tentar de novo” acima.</p>';
    html += '<p class="mais">Quer mandar mais? É só tocar em “Adicionar fotos e vídeos”.</p>';
    elResumo.innerHTML = html;
    elResumo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  iniciar();
})();
