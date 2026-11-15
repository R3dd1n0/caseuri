/**
 * fotos.js — álbum do casamento.
 *
 * Duas coleções, com a mesma cara (seletores + grade + foto ampliada):
 *   - Fotos oficiais (fotógrafo): lista de oficiais.js, atualizada pelo backend
 *     (action=oficiais) quando ele souber listar as pastas do Drive;
 *   - Dos convidados: enviadas por aqui (action=listar).
 *
 * Envio (botão "Enviar" nas fotos dos convidados), para cada arquivo:
 *   1. pede ao Apps Script uma sessão de upload (POST criarSessao);
 *   2. envia os BYTES direto para a URL da sessão com PUT (progresso real);
 *   3. avisa o Apps Script que terminou (POST confirmar).
 * Um arquivo que falha não derruba os outros; dá pra tentar de novo.
 */
(function () {
  'use strict';

  var CFG = window.FOTOS_CONFIG || {};
  var BASE = CFG.BASE_URL || '';
  var temBackend = !!BASE && BASE.indexOf('COLE_AQUI') !== 0;

  // Missões do jogo da festa. O menu saiu do site; a lista fica só para dar
  // nome às fotos que foram enviadas com uma missão.
  var MISSOES = {
    mesa: 'Foto de toda a mesa', selfie: 'Uma selfie', danca: 'A primeira dança',
    criativo: 'Seja criativo!', brinde: 'Um brinde', casal: 'O casal juntos', pista: 'A galera na pista'
  };
  function labelMissao(id) { return MISSOES[id] || ''; }

  function $(id) { return document.getElementById(id); }
  function cada(lista, fn) { Array.prototype.forEach.call(lista, fn); }

  // ---- API ----------------------------------------------------------------
  function post(action, corpo) {
    var dados = { action: action };
    for (var k in corpo) if (corpo.hasOwnProperty(k)) dados[k] = corpo[k];
    return fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
      body: JSON.stringify(dados)
    }).then(function (r) { return r.json(); });
  }
  function thumbUrl(id, w) { return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (w || 600); }

  // ---- Elementos ----------------------------------------------------------
  var barraOrigem = $('album-origem');
  var elEspera    = $('album-espera');
  var secOficiais = $('album-oficiais');
  var secConv     = $('album-convidados');
  var chipsOf     = $('oficiais-chips');
  var gradeOf     = $('oficiais-grade');
  var grade       = $('grade');
  var albumMsg    = $('album-msg');
  var lb          = $('lb');
  var lbMedia     = $('lb-media');

  // ---- Célula da grade (igual para oficiais e convidados) -----------------
  function criarCel(it, lista, aoSumir) {
    var cel = document.createElement('button'); cel.type = 'button'; cel.className = 'cel';
    var img = document.createElement('img'); img.loading = 'lazy'; img.alt = '';
    // Arquivo apagado do Drive (ou miniatura indisponível): some da galeria
    // em vez de deixar um quadro quebrado.
    img.addEventListener('error', function () {
      it._indisponivel = true;
      if (cel.parentNode) cel.parentNode.removeChild(cel);
      if (aoSumir) aoSumir();
    });
    img.src = thumbUrl(it.id, 600);
    cel.appendChild(img);
    if (it.cat === 'video') { var p = document.createElement('span'); p.className = 'cel-play'; p.textContent = '▶'; cel.appendChild(p); }
    if (it.nome) { var nm = document.createElement('span'); nm.className = 'cel-nome'; nm.textContent = it.nome; cel.appendChild(nm); }
    if (labelMissao(it.missao)) { var mt = document.createElement('span'); mt.className = 'cel-missao'; mt.textContent = labelMissao(it.missao); cel.appendChild(mt); }
    cel.addEventListener('click', function () {
      var visiveis = lista.filter(function (x) { return !x._indisponivel; });
      abrirLb(visiveis, Math.max(0, visiveis.indexOf(it)));
    });
    return cel;
  }

  // ---- Fotos oficiais -----------------------------------------------------
  // A seção só aparece depois de confirmar que as fotos estão visíveis ao
  // público (pasta compartilhada por link); senão ficam só as dos convidados.
  var OFICIAIS = ((window.FOTOS_OFICIAIS && window.FOTOS_OFICIAIS.albuns) || []).map(function (a) {
    var alb = { chave: a.chave || a.titulo, titulo: a.titulo, rotulo: a.rotulo || a.titulo, itens: [] };
    alb.itens = itensOficiais(a.itens, alb);
    return alb;
  });
  function itensOficiais(itens, alb) {
    return (itens || []).map(function (x) {
      return { id: x.id, cat: x.cat === 'video' ? 'video' : 'foto', oficial: alb.titulo };
    });
  }
  var oficiaisOk = null;            // null = ainda não testado; true/false = resultado
  var oficialAtual = '';            // chave do álbum oficial selecionado
  var oficiaisRenderizadas = false;
  var origemAtual = 'convidados';
  var origemEscolhida = false;      // a pessoa já tocou na chave?

  function albunsComFotos() { return OFICIAIS.filter(function (a) { return a.itens.length > 0; }); }

  // Testa se dá para ver as oficiais sem login (uma miniatura de cada álbum).
  function testarOficiais(cb) {
    var alvos = albunsComFotos().map(function (a) { return a.itens[0].id; });
    if (!alvos.length) return cb(false);
    var pend = alvos.length, feito = false;
    function fim(ok) { if (feito) return; if (ok || --pend <= 0) { feito = true; cb(!!ok); } }
    alvos.forEach(function (id) {
      var im = new Image();
      im.onload = function () { fim(true); };
      im.onerror = function () { fim(false); };
      im.src = thumbUrl(id, 600);
    });
    setTimeout(function () { if (!feito) { feito = true; cb(false); } }, 6000);
  }

  function renderOficiais() {
    if (oficiaisRenderizadas) return;
    oficiaisRenderizadas = true;
    var albuns = albunsComFotos();
    if (!albuns.some(function (a) { return a.chave === oficialAtual; })) oficialAtual = albuns.length ? albuns[0].chave : '';

    chipsOf.innerHTML = '';
    albuns.forEach(function (a) {
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'chip' + (a.chave === oficialAtual ? ' ativa' : '');
      b.textContent = a.rotulo;
      b.addEventListener('click', function () {
        if (oficialAtual === a.chave) return;
        oficialAtual = a.chave; oficiaisRenderizadas = false; renderOficiais();
      });
      chipsOf.appendChild(b);
    });
    chipsOf.hidden = albuns.length < 2;       // um álbum só: seletor não faz sentido

    gradeOf.innerHTML = '';
    albuns.forEach(function (a) {
      if (a.chave !== oficialAtual) return;
      a.itens.forEach(function (it) { if (!it._indisponivel) gradeOf.appendChild(criarCel(it, a.itens)); });
    });
  }

  // Lista atual das pastas oficiais no Drive (se o backend já tiver essa ação).
  function buscarOficiaisNoBackend() {
    if (!temBackend) return;
    fetch(BASE + '?action=oficiais').then(function (r) { return r.json(); }).then(function (r) {
      if (!r || !r.ok || !r.albuns) return;                 // backend antigo: fica a lista fixa
      var mudou = false;
      r.albuns.forEach(function (b) {
        var alvo = null;
        OFICIAIS.forEach(function (a) { if (a.chave === b.chave) alvo = a; });
        if (!alvo || !b.itens || !b.itens.length) return;
        var antes = alvo.itens.map(function (x) { return x.id; }).join(',');
        var agora = b.itens.map(function (x) { return x.id; }).join(',');
        if (antes === agora) return;
        alvo.itens = itensOficiais(b.itens, alvo);
        mudou = true;
      });
      if (!mudou) return;
      oficiaisRenderizadas = false;
      if (oficiaisOk) { if (origemAtual === 'oficiais') renderOficiais(); return; }
      // Antes não havia oficiais visíveis: testa de novo com a lista nova.
      testarOficiais(function (ok) {
        if (!ok) return;
        oficiaisOk = true; elEspera.hidden = true;
        if (!origemEscolhida) mostrarOrigem('oficiais'); else atualizarChave();
      });
    }).catch(function () {});
  }

  // ---- Chave oficiais x convidados ----------------------------------------
  function atualizarChave() {
    barraOrigem.hidden = !oficiaisOk;
    cada(barraOrigem.querySelectorAll('.origem-btn'), function (b) {
      var ativa = b.getAttribute('data-o') === origemAtual;
      b.classList.toggle('ativa', ativa); b.setAttribute('aria-pressed', ativa ? 'true' : 'false');
    });
  }
  function mostrarOrigem(qual) {
    origemAtual = (qual === 'oficiais' && oficiaisOk) ? 'oficiais' : 'convidados';
    secOficiais.hidden = origemAtual !== 'oficiais';
    secConv.hidden = origemAtual !== 'convidados';
    atualizarChave();
    if (origemAtual === 'oficiais') renderOficiais();
    else if (!albumCarregado) carregarAlbum();
  }
  function abrirAlbum(preferida) {
    buscarOficiaisNoBackend();
    if (preferida === 'convidados') origemEscolhida = true;
    if (!albunsComFotos().length) { oficiaisOk = false; return mostrarOrigem('convidados'); }
    if (preferida === 'convidados') mostrarOrigem('convidados'); else elEspera.hidden = false;
    testarOficiais(function (ok) {
      elEspera.hidden = true;
      if (oficiaisOk === true) return;          // a lista do backend já confirmou antes
      oficiaisOk = ok;
      mostrarOrigem(ok && !origemEscolhida ? 'oficiais' : origemAtual);
    });
  }

  // ---- Fotos dos convidados -----------------------------------------------
  var itensAlbum = [], filtroAtual = 'todos', albumCarregado = false;

  function carregarAlbum() {
    albumCarregado = true;
    albumMsg.hidden = false; albumMsg.classList.remove('erro'); albumMsg.textContent = 'Carregando…';
    grade.innerHTML = '';
    if (!temBackend) { albumMsg.textContent = ''; return; }
    fetch(BASE + '?action=listar').then(function (r) { return r.json(); }).then(function (r) {
      // Envios de teste (feitos com o nome "TESTE Claude ...") nunca aparecem.
      itensAlbum = ((r && r.itens) || []).filter(function (it) {
        return !/^teste claude/i.test(it.nome || '');
      });
      renderGrade();
    }).catch(function () {
      albumCarregado = false;
      albumMsg.hidden = false; albumMsg.classList.add('erro');
      albumMsg.textContent = 'Não carregou. Tente de novo.';
    });
  }
  function renderGrade() {
    grade.innerHTML = '';
    var lista = itensAlbum.filter(function (it) { return filtroAtual === 'todos' || it.cat === filtroAtual; });
    function vazio() { albumMsg.hidden = false; albumMsg.classList.remove('erro'); albumMsg.textContent = 'Nada por aqui ainda.'; }
    if (!lista.length) return vazio();
    albumMsg.hidden = true;
    lista.forEach(function (it) {
      grade.appendChild(criarCel(it, lista, function () { if (!grade.children.length) vazio(); }));
    });
  }

  // ---- Foto ampliada ------------------------------------------------------
  var lbLista = [], lbIdx = 0;
  function abrirLb(lista, idx) { lbLista = lista; lbIdx = idx; mostrarLb(); lb.hidden = false; document.body.style.overflow = 'hidden'; }
  function fecharLb() { lb.hidden = true; lbMedia.innerHTML = ''; document.body.style.overflow = ''; }
  function navLb(d) { if (!lbLista.length) return; lbIdx = (lbIdx + d + lbLista.length) % lbLista.length; mostrarLb(); }
  function mostrarLb() {
    var it = lbLista[lbIdx]; lbMedia.innerHTML = '';
    var partes = [];
    if (it.oficial) partes.push((it.cat === 'video' ? 'Vídeo oficial' : 'Foto oficial') + ' · ' + it.oficial);
    if (it.nome) partes.push('Enviado por ' + it.nome);
    if (labelMissao(it.missao)) partes.push('Missão: ' + labelMissao(it.missao));
    $('lb-cap').textContent = partes.join(' · ');
    // Baixar o original direto do Drive (o arquivo já é público por link).
    var baixar = $('lb-baixar');
    baixar.href = 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(it.id);
    baixar.setAttribute('aria-label', it.cat === 'video' ? 'Baixar vídeo original' : 'Baixar foto original');
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

  // ---- Envio --------------------------------------------------------------
  var paneEnviar = $('pane-enviar');
  var btnEnviar  = $('btn-enviar');
  var elNome   = $('nome');
  var elInput  = $('arquivo');
  var elBotao  = $('btn-add');
  var elAviso  = $('aviso');
  var elLista  = $('lista');
  var elResumo = $('resumo');
  var elHp     = $('hp');

  var ticket = null, pedindoTicket = false;
  var fila = [];         // itens { file, el, barra, estado }
  var idx = 0;           // ponteiro sequencial
  var enviando = false;
  var cont = { ok: 0, erro: 0 };

  function avisar(msg, erro) {
    elAviso.textContent = msg || '';
    elAviso.hidden = !msg;
    elAviso.classList.toggle('erro', !!erro);
  }

  // Nome do convidado: lembra entre envios e reaproveita o login do site.
  function nomeSalvo() {
    try {
      return (localStorage.getItem('fm.fotos.nome') ||
              localStorage.getItem('caseuri.nome') || '').trim();
    } catch (_) { return ''; }
  }
  function lembrarNome(n) { try { if (n) localStorage.setItem('fm.fotos.nome', n); } catch (_) {} }
  // Se já sabemos o nome, não pergunta de novo: "Enviando como X · trocar".
  function montarNome() {
    var salvo = nomeSalvo();
    if (!salvo) return;
    elNome.value = salvo;
    var campo = document.querySelector('.campo-nome');
    campo.hidden = true;
    var box = document.createElement('div');
    box.className = 'nome-compacto';
    box.innerHTML = 'Enviando como <strong></strong> · <a href="#" class="trocar">trocar</a>';
    box.querySelector('strong').textContent = salvo;
    campo.parentNode.insertBefore(box, campo);
    box.querySelector('.trocar').addEventListener('click', function (ev) {
      ev.preventDefault();
      box.parentNode.removeChild(box); campo.hidden = false; elNome.focus();
    });
  }

  function abrirEnvio(abrir) {
    paneEnviar.hidden = !abrir;
    btnEnviar.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    if (!abrir || ticket || pedindoTicket) return;
    if (!temBackend) return avisar('Envio indisponível no momento.', true);
    // O ticket autoriza o envio; pede só quando a pessoa abre o painel.
    pedindoTicket = true;
    fetch(BASE + '?action=ticket').then(function (r) { return r.json(); }).then(function (r) {
      pedindoTicket = false;
      if (r && r.ok) { ticket = r.ticket; elBotao.disabled = false; avisar(''); }
      else avisar('Não foi possível iniciar. Recarregue a página.', true);
    }).catch(function () {
      pedindoTicket = false;
      avisar('Sem conexão. Recarregue a página.', true);
    });
  }

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

  function enviarUm(item, done) {
    var f = item.file;
    item.el.classList.remove('falhou');
    item.estado.className = 'item-estado';
    item.estado.textContent = 'enviando…';

    post('criarSessao', {
      ticket: ticket,
      nome: (elNome.value || '').trim(),
      origin: location.origin,
      missao: '',
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
    }).catch(function () {
      item.feito = true;
      cont.erro++;
      item.el.classList.add('falhou');
      item.estado.textContent = 'falhou';
      item.estado.classList.add('erro');
      mostrarRetry(item);
      done();                                   // não trava a fila
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
      a.parentNode.removeChild(a);
      item.feito = false;
      item.barra.style.width = '0';
      cont.erro = Math.max(0, cont.erro - 1);
      var i = fila.indexOf(item);               // reenvia só este, respeitando a fila
      if (i < idx) idx = i;
      processar();
    });
    item.el.appendChild(a);
  }

  function finalizar() {
    if (!(cont.ok + cont.erro)) return;
    var html = '';
    if (cont.ok)  html += '<p>' + cont.ok + (cont.ok === 1 ? ' arquivo enviado.' : ' arquivos enviados.') + ' Obrigado!</p>';
    if (cont.erro) html += '<p>' + cont.erro + (cont.erro === 1 ? ' falhou' : ' falharam') + ' — toque em “tentar de novo”.</p>';
    elResumo.innerHTML = html;
    elResumo.hidden = false;
    if (cont.ok) carregarAlbum();               // os novos já entram na grade
  }

  // ---- Inicialização ------------------------------------------------------
  function iniciar() {
    montarNome();

    cada(barraOrigem.querySelectorAll('.origem-btn'), function (b) {
      b.addEventListener('click', function () { origemEscolhida = true; mostrarOrigem(b.getAttribute('data-o')); });
    });
    cada(document.querySelectorAll('.filtro'), function (b) {
      b.addEventListener('click', function () {
        filtroAtual = b.getAttribute('data-f');
        cada(document.querySelectorAll('.filtro'), function (x) { x.classList.toggle('ativa', x === b); });
        renderGrade();
      });
    });
    $('lb-fechar').addEventListener('click', fecharLb);
    $('lb-prev').addEventListener('click', function () { navLb(-1); });
    $('lb-next').addEventListener('click', function () { navLb(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) fecharLb(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') fecharLb();
      else if (e.key === 'ArrowLeft') navLb(-1);
      else if (e.key === 'ArrowRight') navLb(1);
    });

    btnEnviar.addEventListener('click', function () { abrirEnvio(paneEnviar.hidden); });
    elBotao.addEventListener('click', function () { if (!elBotao.disabled) elInput.click(); });
    elInput.addEventListener('change', function () {
      if (elHp.value) return;                   // honeypot: bot preencheu → ignora
      var files = Array.prototype.slice.call(elInput.files || []);
      elInput.value = '';
      if (!files.length) return;
      lembrarNome((elNome.value || '').trim());
      elResumo.hidden = true;
      files.forEach(adicionar);
      processar();
    });

    // #enviar abre direto o envio; #convidados abre nas fotos dos convidados.
    var h = location.hash;
    if (h === '#enviar') { abrirAlbum('convidados'); abrirEnvio(true); }
    else if (h === '#convidados') abrirAlbum('convidados');
    else abrirAlbum();
  }

  iniciar();
})();
