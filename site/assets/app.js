/**
 * app.js — orquestração do site (gate, hub, RSVP, presentes, PIX).
 *
 * Estrutura, não estilo. Todo texto vem de window.CONTEUDO; o visual vem das
 * variáveis CSS. A lógica não depende de nenhum conteúdo específico.
 */
(function () {
  var C = window.CONTEUDO;
  var estado = { token: null, grupo: '', pessoas: [], deuPresente: false };

  // ---- helpers de DOM ----
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { n.appendChild(f); });
    return n;
  }
  function mostrar(n, sim) { if (n) n.hidden = !sim; }

  /** Preenche elementos [data-bind="a.b.c"] com o texto vindo de CONTEUDO. */
  function bindConteudo(raiz) {
    (raiz || document).querySelectorAll('[data-bind]').forEach(function (n) {
      var val = caminho(C, n.getAttribute('data-bind'));
      if (val != null) n.textContent = val;
    });
  }
  function caminho(obj, path) {
    return path.split('.').reduce(function (o, k) { return o ? o[k] : undefined; }, obj);
  }

  // ===================================================================
  // BOOT
  // ===================================================================
  document.addEventListener('DOMContentLoaded', function () {
    document.title = C.casal.titulo;
    montarGate();
    bindConteudo(document);

    var token = window.Sessao.obter();
    if (token) {
      window.API.sessao(token).then(function (r) {
        if (r && r.ok) { aplicarSessao(token, r); entrarNoHub(); }
        else { window.Sessao.limpar(); mostrarGate(); }
      }).catch(mostrarGate);
    } else {
      mostrarGate();
    }
  });

  function aplicarSessao(token, r) {
    estado.token = token;
    estado.grupo = r.grupo || '';
    estado.pessoas = r.pessoas || [];
    estado.deuPresente = !!r.deuPresente;
  }

  // ===================================================================
  // GATE (landing por nome)
  // ===================================================================
  function montarGate() {
    $('#gate-nome').placeholder = C.gate.placeholder || '';
    $('#gate-botao').textContent = C.gate.botao || 'Entrar';
    var form = $('#gate-form');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nome = $('#gate-nome').value.trim();
      var msg = $('#gate-msg');
      if (!nome) return;
      msg.textContent = '…';
      window.API.identificar(nome).then(function (r) {
        if (r && r.ok && r.resultado === 'unico') {
          window.Sessao.salvar(r.token);
          aplicarSessao(r.token, r);
          entrarNoHub();
        } else if (r && r.resultado === 'multiplo') {
          msg.textContent = C.gate.pedirSobrenome;
          msg.className = 'msg msg--erro';
        } else {
          msg.textContent = C.gate.erroNaoEncontrado;
          msg.className = 'msg msg--erro';
        }
      }).catch(function () {
        msg.textContent = 'Erro de conexão. Tente de novo.';
        msg.className = 'msg msg--erro';
      });
    });
  }
  function mostrarGate() { mostrar($('#gate'), true); $('#hub').classList.remove('visivel'); }

  // ===================================================================
  // HUB
  // ===================================================================
  function entrarNoHub() {
    mostrar($('#gate'), false);
    $('#hub').classList.add('visivel');
    hydrateLinks();
    iniciarContagem();
    montarRsvp();
    carregarPresentes();
    atualizarLembrete();
  }

  // ---- links de trajeto (href vem do conteúdo) ----
  function hydrateLinks() {
    var maps = $('#link-maps'), waze = $('#link-waze');
    if (maps) maps.href = C.evento.mapsUrl || '#';
    if (waze) waze.href = C.evento.wazeUrl || '#';
  }

  // ---- contagem regressiva ----
  function iniciarContagem() {
    var alvo = new Date(C.evento.dataISO).getTime();
    var cont = $('#contagem');
    function tick() {
      var d = alvo - Date.now();
      if (isNaN(alvo)) { cont.textContent = ''; return; }
      var neg = d < 0; d = Math.abs(d);
      var dias = Math.floor(d / 86400000);
      var horas = Math.floor(d % 86400000 / 3600000);
      var min = Math.floor(d % 3600000 / 60000);
      var seg = Math.floor(d % 60000 / 1000);
      cont.innerHTML = '';
      [[dias, 'dias'], [horas, 'horas'], [min, 'min'], [seg, 'seg']].forEach(function (par) {
        cont.appendChild(el('div', {}, [
          el('div', { class: 'num', text: String(par[0]) }),
          el('div', { class: 'rot', text: par[1] })
        ]));
      });
      if (neg) { /* evento já ocorreu — a Mariana decide a mensagem */ }
    }
    tick();
    setInterval(tick, 1000);
  }

  // ---- RSVP (lista nominal: uma pessoa por linha, sem "quantas pessoas") ----
  function montarRsvp() {
    $('#rsvp-grupo').textContent = estado.grupo;
    var cont = $('#rsvp-pessoas');
    cont.innerHTML = '';

    estado.pessoas.forEach(function (p) {
      var bloco = el('div', { class: 'pessoa-rsvp' });
      var ehCrianca = String(p.categoria || '').indexOf('crianca') === 0;
      bloco.appendChild(el('strong', { text: p.nome + (ehCrianca ? ' (criança)' : '') }));
      var opcoes = el('div', { class: 'rsvp-opcoes' });
      [['confirmado', 'Vou'], ['recusado', 'Não vou']].forEach(function (par) {
        var lbl = el('label');
        var rb = el('input', { type: 'radio', name: 'rsvp-' + p.id, value: par[0] });
        if (p.status === par[0]) rb.checked = true;
        lbl.appendChild(rb);
        lbl.appendChild(document.createTextNode(' ' + par[1]));
        opcoes.appendChild(lbl);
      });
      bloco.appendChild(opcoes);
      var obs = el('input', { class: 'campo', type: 'text', placeholder: 'Observação (opcional)' });
      obs.setAttribute('data-obs', p.id);
      if (p.obs) obs.value = p.obs;
      bloco.appendChild(obs);
      cont.appendChild(bloco);
    });

    // onsubmit (não addEventListener) evita handler duplicado se remontar.
    $('#rsvp-form').onsubmit = function (ev) {
      ev.preventDefault();
      var msg = $('#rsvp-msg');
      var respostas = estado.pessoas.map(function (p) {
        var sel = document.querySelector('input[name="rsvp-' + p.id + '"]:checked');
        var obsEl = document.querySelector('[data-obs="' + p.id + '"]');
        return {
          id: p.id,
          status: sel ? sel.value : (p.status || 'pendente'),
          obs: obsEl ? obsEl.value : ''
        };
      });
      if (!respostas.some(function (r) { return r.status !== 'pendente'; })) {
        msg.textContent = 'Marque "Vou" ou "Não vou" para pelo menos uma pessoa.';
        msg.className = 'msg msg--erro';
        return;
      }
      msg.textContent = 'Salvando…'; msg.className = 'msg';
      window.API.rsvpSalvar(estado.token, respostas).then(function (resp) {
        if (resp && resp.ok) {
          estado.pessoas = resp.pessoas || estado.pessoas;
          msg.textContent = 'Resposta salva! 🎉'; msg.className = 'msg msg--ok';
        } else {
          msg.textContent = 'Não deu para salvar. Tente de novo.'; msg.className = 'msg msg--erro';
        }
      }).catch(function () { msg.textContent = 'Erro de conexão.'; msg.className = 'msg msg--erro'; });
    };
  }

  function atualizarLembrete() {
    mostrar($('#rsvp-lembrete'), !estado.deuPresente);
  }

  // ---- presentes ----
  function carregarPresentes() {
    var lista = $('#presentes-lista');
    lista.innerHTML = 'Carregando…';
    window.API.presentesListar().then(function (r) {
      lista.innerHTML = '';
      if (!r || !r.ok) { lista.textContent = 'Não foi possível carregar a lista.'; return; }
      r.presentes.forEach(function (p) { lista.appendChild(cardPresente(p)); });
    }).catch(function () { lista.textContent = 'Erro de conexão.'; });
  }

  function cardPresente(p) {
    var esgotado = p.status === 'esgotado';
    var reservado = p.status === 'reservado';
    var filhos = [
      el('strong', { text: p.titulo || '' }),
      el('span', { class: 'selo', text: p.descricao || '' })
    ];
    if (p.valor != null) filhos.push(el('span', { class: 'selo', text: 'R$ ' + p.valor }));

    if (p.tipo === 'livre') {
      var inpV = el('input', { class: 'campo', type: 'number', min: '1', placeholder: 'Valor (R$)' });
      var btnV = el('button', { class: 'botao', text: C.presentes.livreChamada });
      btnV.addEventListener('click', function () {
        var v = Number(inpV.value);
        if (!v || v <= 0) return;
        iniciarPix(window.API.contribuirLivre(estado.token, v, '', p.id));
      });
      filhos.push(inpV, btnV);
    } else if (esgotado) {
      filhos.push(el('span', { class: 'selo', text: '✓ Já presenteado' }));
    } else {
      var btn = el('button', { class: 'botao', text: reservado ? 'Reservado…' : 'Quero dar' });
      if (reservado) btn.disabled = true;
      btn.addEventListener('click', function () {
        iniciarPix(window.API.presenteReservar(estado.token, p.id, ''));
      });
      filhos.push(btn);
    }
    return el('div', { class: 'card-presente' + (esgotado ? ' esgotado' : '') }, filhos);
  }

  // ---- fluxo PIX (modal + polling) ----
  function iniciarPix(promessa) {
    var modal = $('#pix-modal');
    var conteudo = $('#pix-conteudo');
    conteudo.innerHTML = 'Gerando cobrança PIX…';
    mostrar(modal, true);

    promessa.then(function (r) {
      if (!r || !r.ok) {
        conteudo.innerHTML = '';
        conteudo.appendChild(el('p', { class: 'msg msg--erro',
          text: r && r.erro === 'presente_indisponivel' ? 'Esse presente acabou de ser escolhido por outra pessoa.' : 'Não foi possível gerar o PIX.' }));
        return;
      }
      renderPix(conteudo, r.pagamento);
      pollPagamento(r.pagamento.paymentId, conteudo);
    }).catch(function () {
      conteudo.innerHTML = '<p class="msg msg--erro">Erro de conexão.</p>';
    });
  }

  function renderPix(conteudo, pg) {
    conteudo.innerHTML = '';
    var area = el('div', { class: 'pix-area' });
    if (pg.qrCodeBase64) {
      area.appendChild(el('img', { alt: 'QR Code PIX', src: 'data:image/png;base64,' + pg.qrCodeBase64 }));
    }
    area.appendChild(el('div', { text: 'Valor: R$ ' + pg.valor }));
    var copia = el('div', { class: 'copia-cola', text: pg.copiaCola || '' });
    var btnCopiar = el('button', { class: 'botao botao--secundario', text: 'Copiar código PIX' });
    btnCopiar.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(pg.copiaCola || '');
      btnCopiar.textContent = 'Copiado!';
    });
    var statusLinha = el('div', { id: 'pix-status', class: 'lembrete', text: 'Aguardando pagamento…' });
    area.appendChild(copia);
    area.appendChild(btnCopiar);
    area.appendChild(statusLinha);
    conteudo.appendChild(area);
  }

  function pollPagamento(paymentId, conteudo) {
    var tentativas = 0;
    var timer = setInterval(function () {
      tentativas++;
      if (tentativas > 150) { clearInterval(timer); return; } // ~10 min
      window.API.pagamentoStatus(paymentId).then(function (r) {
        if (!r || !r.ok) return;
        var linha = $('#pix-status', conteudo);
        if (r.status === 'confirmado') {
          clearInterval(timer);
          if (linha) { linha.textContent = 'Pagamento confirmado! Muito obrigado 💛'; linha.className = 'msg msg--ok'; }
          estado.deuPresente = true;
          atualizarLembrete();
          carregarPresentes();
        } else if (r.status === 'expirado') {
          clearInterval(timer);
          if (linha) { linha.textContent = 'A cobrança expirou. Feche e tente de novo.'; linha.className = 'msg msg--erro'; }
          carregarPresentes();
        }
      });
    }, 4000);
  }

  // fechar modal PIX
  document.addEventListener('DOMContentLoaded', function () {
    var fechar = $('#pix-fechar');
    if (fechar) fechar.addEventListener('click', function () {
      mostrar($('#pix-modal'), false);
      carregarPresentes();
    });
  });
})();
