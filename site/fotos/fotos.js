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

  var elNome   = document.getElementById('nome');
  var elInput  = document.getElementById('arquivo');
  var elBotao  = document.getElementById('btn-add');
  var elAviso  = document.getElementById('aviso');
  var elLista  = document.getElementById('lista');
  var elResumo = document.getElementById('resumo');
  var elHp     = document.getElementById('hp');

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
    tabEnviar.classList.toggle('ativa', qual === 'enviar');
    tabAlbum.classList.toggle('ativa', qual === 'album');
    if (qual === 'album' && !albumCarregado) carregarAlbum();
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
    if (cap) cap.textContent = it.nome ? ('Enviado por ' + it.nome) : '';
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

  // ---- Inicialização ------------------------------------------------------
  function iniciar() {
    montarNome();
    setupAbas();
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
    if (cont.ok) albumCarregado = false; // recarrega o álbum na próxima vez que abrir
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
