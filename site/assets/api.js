/**
 * api.js — cliente do backend (Web App do Apps Script).
 *
 * Padrão anti-preflight: POST com Content-Type text/plain e JSON no corpo;
 * GET com query string. Ver docs/API.md.
 */
(function () {
  function baseUrl() {
    var u = (window.CONFIG && window.CONFIG.BASE_URL) || '';
    if (!u || u.indexOf('COLE_AQUI') === 0) {
      throw new Error('config.js sem BASE_URL — ver docs/SETUP.md');
    }
    return u;
  }

  // Re-tenta em falha de rede/JSON/resposta vazia (o Apps Script "acorda"
  // devagar no 1º acesso e às vezes devolve corpo vazio nesse meio-tempo).
  function comRetry(fn, tentativas) {
    tentativas = tentativas || 5;
    return fn().catch(function (e) {
      if (tentativas <= 1) throw e;
      return new Promise(function (res) { setTimeout(res, 800); })
        .then(function () { return comRetry(fn, tentativas - 1); });
    });
  }

  // Trata corpo vazio como falha (dispara o retry) em vez de virar "{}".
  function lerJson(r) {
    if (!r.ok) throw new Error('http_' + r.status);
    return r.text().then(function (t) {
      if (!t || !t.trim()) throw new Error('resposta_vazia');
      return JSON.parse(t);
    });
  }

  function get(action, params) {
    var qs = Object.keys(params || {}).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    });
    qs.unshift('action=' + encodeURIComponent(action));
    return comRetry(function () {
      return fetch(baseUrl() + '?' + qs.join('&'), { method: 'GET' }).then(lerJson);
    });
  }

  // retry=false para ações que CRIAM cobrança (não podem repetir e gerar
  // Pix/cobrança em duplicidade). retry=true só para leituras/idempotentes.
  function post(payload, retry) {
    var fn = function () {
      return fetch(baseUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(lerJson);
    };
    return retry ? comRetry(fn) : fn();
  }

  window.API = {
    identificar: function (nome) { return post({ action: 'identificar', nome: nome }, true); },
    sessao: function (token) { return post({ action: 'sessao', token: token }, true); },
    rsvpSalvar: function (token, respostas) {
      return post({ action: 'rsvpSalvar', token: token, respostas: respostas }, true);
    },
    presentesListar: function () { return get('presentesListar', {}); },
    presenteReservar: function (token, presenteId, mensagem) {
      // sem retry: cria reserva + cobrança
      return post({ action: 'presenteReservar', token: token, presenteId: presenteId, mensagem: mensagem || '' }, false);
    },
    contribuirLivre: function (token, valor, mensagem, presenteId) {
      // sem retry: cria cobrança
      return post({ action: 'contribuirLivre', token: token, valor: valor, mensagem: mensagem || '', presenteId: presenteId || 'livre' }, false);
    },
    // Cartão (Checkout Pro): reserva igual ao Pix, mas devolve um link p/ redirecionar.
    cartaoItem: function (token, presenteId, mensagem) {
      return post({ action: 'presenteReservar', token: token, presenteId: presenteId, mensagem: mensagem || '', metodo: 'cartao' }, false);
    },
    cartaoLivre: function (token, valor, mensagem, presenteId) {
      return post({ action: 'contribuirLivre', token: token, valor: valor, mensagem: mensagem || '', presenteId: presenteId || 'livre', metodo: 'cartao' }, false);
    },
    pagamentoStatus: function (paymentId) { return get('pagamentoStatus', { paymentId: paymentId }); },
    // Mural de recados (com retry: é idempotente o suficiente e não gera cobrança)
    recadoEnviar: function (token, nome, mensagem) {
      return post({ action: 'recadoEnviar', token: token, nome: nome || '', mensagem: mensagem || '' }, true);
    }
  };
})();
