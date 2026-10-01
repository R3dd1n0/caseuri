/**
 * app.js — orquestração do site (gate, hub, RSVP, presentes, PIX).
 *
 * Estrutura, não estilo. Todo texto vem de window.CONTEUDO; o visual vem das
 * variáveis CSS. A lógica não depende de nenhum conteúdo específico.
 */
(function () {
  var C = window.CONTEUDO;
  var estado = { token: null, grupo: '', pessoas: [], deuPresente: false, ocultarPresentes: false };

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
    // data-bind-paragrafos="a.b" -> um <p> por item do array
    (raiz || document).querySelectorAll('[data-bind-paragrafos]').forEach(function (n) {
      var arr = caminho(C, n.getAttribute('data-bind-paragrafos'));
      if (!Array.isArray(arr)) return;
      n.innerHTML = '';
      arr.forEach(function (txt) { n.appendChild(el('p', { text: txt })); });
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
    estado.ocultarPresentes = !!r.ocultarPresentes;
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
      var botao = $('#gate-botao');
      if (!nome) return;
      msg.textContent = 'Entrando…'; msg.className = 'msg';
      botao.disabled = true;
      var demorou = 'O servidor demorou a responder. Toque em Entrar de novo.';
      window.API.identificar(nome).then(function (r) {
        if (r && r.ok && r.resultado === 'unico') {
          window.Sessao.salvar(r.token);
          aplicarSessao(r.token, r);
          entrarNoHub();
        } else if (r && r.resultado === 'multiplo') {
          msg.textContent = C.gate.pedirSobrenome; msg.className = 'msg msg--erro';
          botao.disabled = false;
        } else if (r && r.ok === false && r.erro === 'nome_nao_encontrado') {
          msg.textContent = C.gate.erroNaoEncontrado; msg.className = 'msg msg--erro';
          botao.disabled = false;
        } else {
          // resposta inesperada/incompleta (ex.: servidor acordando)
          msg.textContent = demorou; msg.className = 'msg msg--erro';
          botao.disabled = false;
        }
      }).catch(function () {
        msg.textContent = demorou; msg.className = 'msg msg--erro';
        botao.disabled = false;
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
    ocultarSecoesVazias();
    montarSlideshow();
    montarDressRefs();
    iniciarContagem();
    montarRsvp();
    carregarPresentes();
    montarMural();
    atualizarLembrete();
    tratarRetornoCartao();
  }

  // Oculta seções opcionais cujo corpo está vazio no conteudo.js.
  function ocultarSecoesVazias() {
    var opcionais = { info: 'secoes.informacoes.corpo' };
    Object.keys(opcionais).forEach(function (id) {
      var sec = $('#' + id);
      var val = caminho(C, opcionais[id]);
      if (sec) sec.hidden = !val || String(val).trim() === '';
    });
  }

  // ---- Slideshow de fotos ("nossas fotos passando") ----
  var galeriaFotos = [];
  var fotoAtual = 0;
  var slides = [], slideIdx = 0, slideTimer = null;
  function montarSlideshow() {
    var palco = $('#slideshow-fotos');
    if (!palco) return;
    var fotos = (C.secoes.historia && C.secoes.historia.fotos) || [];
    galeriaFotos = fotos.slice();
    palco.innerHTML = ''; slides = []; slideIdx = 0;
    fotos.forEach(function (f, i) {
      var im = el('img', {
        class: 'slide' + (i === 0 ? ' ativo' : ''),
        src: 'assets/historia/full-' + f.img + '.jpg',
        alt: 'Felipe e Mariana em ' + f.ano,
        loading: i < 2 ? 'eager' : 'lazy'
      });
      im.addEventListener('click', function () { abrirFoto(i); });
      palco.appendChild(im); slides.push(im);
    });
    var dots = $('#slideshow-dots');
    if (dots) {
      dots.innerHTML = '';
      fotos.forEach(function (_, i) {
        var b = el('button', { type: 'button', class: 'dot' + (i === 0 ? ' ativo' : ''), 'aria-label': 'Foto ' + (i + 1) });
        b.addEventListener('click', function () { irSlide(i, true); });
        dots.appendChild(b);
      });
    }
    mostrar($('#slideshow'), fotos.length > 0);
    if (fotos.length > 1) reiniciarTimerSlide();
  }
  function irSlide(i, acaoUsuario) {
    if (!slides.length) return;
    if (slides[slideIdx]) slides[slideIdx].classList.remove('ativo');
    slideIdx = (i + slides.length) % slides.length;
    slides[slideIdx].classList.add('ativo');
    var dots = document.querySelectorAll('#slideshow-dots .dot');
    for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('ativo', k === slideIdx);
    if (acaoUsuario) reiniciarTimerSlide();
  }
  function reiniciarTimerSlide() {
    if (slideTimer) clearInterval(slideTimer);
    slideTimer = setInterval(function () { irSlide(slideIdx + 1, false); }, 4500);
  }

  // ---- Referências do dress code (fotos all black passando) ----
  function montarDressRefs() {
    var palco = $('#dress-refs'); if (!palco) return;
    var srcs = ['dress-ref-2', 'dress-ref-3', 'dress-ref-4', 'dress-ref-5'];
    palco.innerHTML = '';
    var imgs = srcs.map(function (s, i) {
      var im = el('img', { class: 'dref' + (i === 0 ? ' ativo' : ''),
        src: 'assets/fotos/' + s + '.jpg', alt: 'Referência all black', loading: 'lazy' });
      palco.appendChild(im); return im;
    });
    var idx = 0;
    if (imgs.length > 1) setInterval(function () {
      imgs[idx].classList.remove('ativo');
      idx = (idx + 1) % imgs.length;
      imgs[idx].classList.add('ativo');
    }, 3500);
  }
  function abrirFoto(i) {
    if (!galeriaFotos.length) return;
    fotoAtual = (i + galeriaFotos.length) % galeriaFotos.length;
    var f = galeriaFotos[fotoAtual];
    var img = $('#foto-img'), ano = $('#foto-ano');
    if (img) img.src = 'assets/historia/full-' + f.img + '.jpg';
    if (ano) ano.textContent = f.ano;
    mostrar($('#foto-modal'), true);
  }
  function passarFoto(d) { abrirFoto(fotoAtual + d); }
  function fecharFoto() {
    mostrar($('#foto-modal'), false);
    var img = $('#foto-img'); if (img) img.removeAttribute('src');
  }

  // ---- Mural de recados (privado: o convidado escreve para os noivos) ----
  function montarMural() {
    var form = $('#recado-form'); if (!form) return;
    var nome = $('#recado-nome'), msg = $('#recado-msg');
    if (nome) nome.placeholder = C.mural.placeholderNome || '';
    if (msg) msg.placeholder = C.mural.placeholderMensagem || '';
    form.onsubmit = function (ev) {
      ev.preventDefault();
      var status = $('#recado-status');
      var texto = ((msg && msg.value) || '').trim();
      if (!texto) { if (msg) msg.focus(); return; }
      var quem = ((nome && nome.value) || '').trim();
      status.textContent = 'Enviando…'; status.className = 'msg';
      window.API.recadoEnviar(estado.token, quem, texto).then(function (r) {
        if (r && r.ok) {
          status.textContent = C.mural.sucesso; status.className = 'msg msg--ok';
          if (msg) msg.value = '';
        } else {
          status.textContent = C.mural.erro; status.className = 'msg msg--erro';
        }
      }).catch(function () { status.textContent = C.mural.erro; status.className = 'msg msg--erro'; });
    };
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
      bloco.appendChild(el('strong', { text: p.nome }));
      if (String(p.categoria || '').indexOf('crianca') === 0) {
        bloco.appendChild(el('span', { class: 'selo', text: 'criança' }));
      }
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
    // Sem lista de presentes (colegas), não faz sentido o lembrete sobre ela.
    mostrar($('#rsvp-lembrete'), !estado.deuPresente && !estado.ocultarPresentes);
  }

  // ---- presentes ----
  function carregarPresentes() {
    // Convites marcados como colegas de trabalho não veem a lista de presentes.
    var sec = $('#presentes');
    if (estado.ocultarPresentes) { if (sec) sec.hidden = true; return; }
    if (sec) sec.hidden = false;
    var lista = $('#presentes-lista');
    var obrig = $('#presentes-obrigado');
    if (obrig) {
      if (estado.deuPresente) {
        obrig.textContent = (estado.grupo ? estado.grupo + ', ' : '') + C.presentes.obrigado;
      }
      mostrar(obrig, estado.deuPresente);
    }
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
      var inpV = el('input', { class: 'campo', type: 'number', min: '1', placeholder: 'Valor em reais' });
      filhos.push(inpV);
      filhos.push(blocoPagar(
        function () { var v = Number(inpV.value); if (!v || v <= 0) { inpV.focus(); return null; } return v; },
        function (v) { return window.API.contribuirLivre(estado.token, v, '', p.id); },
        function (v) { return window.API.cartaoLivre(estado.token, v, '', p.id); }
      ));
    } else if (esgotado) {
      filhos.push(el('span', { class: 'selo', text: '✓ Já presenteado' }));
    } else if (reservado) {
      var res = el('button', { class: 'botao', text: 'Reservado' }); res.disabled = true;
      filhos.push(res);
    } else {
      filhos.push(blocoPagar(
        function () { return true; }, // item não tem valor a validar
        function () { return window.API.presenteReservar(estado.token, p.id, ''); },
        function () { return window.API.cartaoItem(estado.token, p.id, ''); }
      ));
    }
    return el('div', { class: 'card-presente' + (esgotado ? ' esgotado' : '') }, filhos);
  }

  /**
   * Bloco de pagamento: mostra só "Quero presentear". Ao clicar, revela a
   * escolha Pix/Cartão (pedido da Mariana: não expor os dois botões de cara).
   * getValor() devolve o valor (livre) ou true (item); null aborta.
   */
  function blocoPagar(getValor, pixFn, cartaoFn) {
    var wrap = el('div', { class: 'card-acao' });
    var btnAbrir = el('button', { class: 'botao', type: 'button', text: C.presentes.botaoPresentear });
    wrap.appendChild(btnAbrir);

    btnAbrir.addEventListener('click', function () {
      var v = getValor();
      if (v === null) return; // valor inválido (contribuição livre)
      wrap.innerHTML = '';
      wrap.appendChild(el('p', { class: 'metodo-label', text: C.presentes.escolhaMetodo }));
      var btnPix = el('button', { class: 'botao', type: 'button', text: C.presentes.pagarPix });
      var btnCard = el('button', { class: 'botao botao--secundario', type: 'button', text: C.presentes.pagarCartao });
      var trava = function (t) { btnPix.disabled = t; btnCard.disabled = t; };
      btnPix.addEventListener('click', function () {
        trava(true); btnPix.textContent = 'Gerando Pix…';
        iniciarPix(pixFn(v), function () { trava(false); btnPix.textContent = C.presentes.pagarPix; });
      });
      btnCard.addEventListener('click', function () {
        trava(true); btnCard.textContent = 'Abrindo…';
        iniciarCartao(cartaoFn(v), function () { trava(false); btnCard.textContent = C.presentes.pagarCartao; });
      });
      wrap.appendChild(el('div', { class: 'acoes' }, [btnPix, btnCard]));
    });
    return wrap;
  }

  // ---- fluxo CARTÃO (redireciona pro Checkout Pro do Mercado Pago) ----
  function iniciarCartao(promessa, onFail) {
    var msg = $('#presentes-msg');
    promessa.then(function (r) {
      if (r && r.ok && r.url) { window.location.href = r.url; return; } // sai do site
      var m = r && r.erro === 'presente_indisponivel'
            ? 'Esse presente acabou de ser escolhido por outra pessoa.'
            : 'Não conseguimos abrir o pagamento no cartão. Tente de novo.';
      if (msg) { msg.textContent = m; msg.className = 'msg msg--erro'; }
      if (onFail) onFail();
    }).catch(function () {
      if (msg) { msg.textContent = 'Erro de conexão. Tente de novo.'; msg.className = 'msg msg--erro'; }
      if (onFail) onFail();
    });
  }

  // Volta do Checkout Pro: o MP redireciona pra cá com ?pgto=cartao&status=...
  function tratarRetornoCartao() {
    var q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    if (!q || q.get('pgto') !== 'cartao') return;
    var status = q.get('status') || q.get('collection_status') || '';
    try { history.replaceState({}, '', location.pathname); } catch (e) {}

    var sec = $('#presentes');
    if (sec && !sec.hidden) {
      sec.open = true; // é um <details>: garante que fique aberto ao voltar do cartão
      try { sec.scrollIntoView({ behavior: 'smooth' }); } catch (e) {}
    }
    var alvo = $('#presentes-msg');
    var texto, classe;
    if (status === 'approved') {
      texto = 'Pagamento no cartão recebido' + (estado.grupo ? ', obrigado ' + estado.grupo : ', muito obrigado') + ' 💛';
      classe = 'msg msg--ok';
    } else if (status === 'pending' || status === 'in_process') {
      texto = 'Seu pagamento no cartão está sendo processado. Assim que aprovar, a gente registra.';
      classe = 'msg';
    } else {
      texto = 'O pagamento no cartão não foi concluído. Você pode tentar de novo quando quiser.';
      classe = 'msg msg--erro';
    }
    if (alvo) { alvo.textContent = texto; alvo.className = classe; }
    // Rede: o webhook confirma no servidor; aqui só atualizamos a lista algumas
    // vezes pra refletir o item esgotado sem o convidado precisar recarregar.
    if (status === 'approved') {
      var n = 0;
      var it = setInterval(function () { n++; carregarPresentes(); if (n >= 6) clearInterval(it); }, 5000);
    }
  }

  // ---- fluxo PIX (modal + polling) ----
  function iniciarPix(promessa, onFail) {
    var modal = $('#pix-modal');
    var conteudo = $('#pix-conteudo');
    conteudo.innerHTML = '';
    conteudo.appendChild(el('p', { class: 'lembrete', text: 'Gerando seu Pix, um instante…' }));
    mostrar(modal, true);

    promessa.then(function (r) {
      if (!r || !r.ok) {
        var m = r && r.erro === 'presente_indisponivel'
              ? 'Esse presente acabou de ser escolhido por outra pessoa.'
              : r && r.erro === 'ocupado'
              ? 'Estamos gerando outro Pix neste instante. Feche e tente de novo em alguns segundos.'
              : 'Não conseguimos gerar o Pix agora. Feche e tente de novo.';
        conteudo.innerHTML = '';
        conteudo.appendChild(el('p', { class: 'msg msg--erro', text: m }));
        if (onFail) onFail();
        return;
      }
      renderPix(conteudo, r.pagamento);
      pollPagamento(r.pagamento.paymentId, conteudo);
    }).catch(function () {
      conteudo.innerHTML = '';
      conteudo.appendChild(el('p', { class: 'msg msg--erro', text: 'Erro de conexão. Feche e tente de novo.' }));
      if (onFail) onFail();
    });
  }

  function renderPix(conteudo, pg) {
    conteudo.innerHTML = '';
    var area = el('div', { class: 'pix-area' });
    if (pg.qrCodeBase64) {
      area.appendChild(el('img', { alt: 'QR Code Pix', src: 'data:image/png;base64,' + pg.qrCodeBase64 }));
    }
    area.appendChild(el('div', { text: 'Valor: R$ ' + pg.valor }));
    var copia = el('div', { class: 'copia-cola', text: pg.copiaCola || '' });
    var btnCopiar = el('button', { class: 'botao botao--secundario', text: 'Copiar código Pix' });
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
          if (linha) {
            linha.textContent = (estado.grupo ? 'Obrigado, ' + estado.grupo + '! ' : 'Muito obrigado! ') + 'Pagamento confirmado 💛';
            linha.className = 'msg msg--ok';
          }
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

  // fechar modal PIX + sair (logout)
  document.addEventListener('DOMContentLoaded', function () {
    var fechar = $('#pix-fechar');
    if (fechar) fechar.addEventListener('click', function () {
      mostrar($('#pix-modal'), false);
      carregarPresentes();
    });
    var sair = $('#sair');
    if (sair) sair.addEventListener('click', function (e) {
      e.preventDefault();
      window.Sessao.limpar();
      location.reload();
    });

    // ---- Lightbox de fotos ----
    var modal = $('#foto-modal');
    var x = $('#foto-fechar'), prev = $('#foto-prev'), next = $('#foto-next');
    if (x) x.addEventListener('click', fecharFoto);
    if (prev) prev.addEventListener('click', function () { passarFoto(-1); });
    if (next) next.addEventListener('click', function () { passarFoto(1); });
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) fecharFoto(); });
    document.addEventListener('keydown', function (e) {
      if (!modal || modal.hidden) return;
      if (e.key === 'Escape') fecharFoto();
      else if (e.key === 'ArrowLeft') passarFoto(-1);
      else if (e.key === 'ArrowRight') passarFoto(1);
    });
    // swipe no celular
    var x0 = null;
    if (modal) {
      modal.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      modal.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 40) passarFoto(dx < 0 ? 1 : -1);
      }, { passive: true });
    }

    // ---- navbar fixa: aparece depois da capa ----
    var navbar = $('#navbar'), capaEl = $('#capa');
    function onScrollNav() {
      if (!navbar || !capaEl) return;
      var lim = capaEl.offsetHeight * 0.7;
      navbar.classList.toggle('visivel', window.scrollY > lim);
    }
    window.addEventListener('scroll', onScrollNav, { passive: true });
    var topo = $('#nav-topo');
    if (topo) topo.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    // ---- controles do slideshow ----
    var sprev = $('#slide-prev'), snext = $('#slide-next');
    if (sprev) sprev.addEventListener('click', function () { irSlide(slideIdx - 1, true); });
    if (snext) snext.addEventListener('click', function () { irSlide(slideIdx + 1, true); });
    var palco = $('#slideshow-palco'), sx = null;
    if (palco) {
      palco.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      palco.addEventListener('touchend', function (e) {
        if (sx === null) return;
        var dx = e.changedTouches[0].clientX - sx; sx = null;
        if (Math.abs(dx) > 40) irSlide(slideIdx + (dx < 0 ? 1 : -1), true);
      }, { passive: true });
    }
  });
})();
