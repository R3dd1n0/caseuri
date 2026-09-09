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

  // Re-tenta em falha de rede/JSON (o Apps Script às vezes "acorda" devagar).
  function comRetry(fn, tentativas) {
    tentativas = tentativas || 3;
    return fn().catch(function (e) {
      if (tentativas <= 1) throw e;
      return new Promise(function (res) { setTimeout(res, 600); })
        .then(function () { return comRetry(fn, tentativas - 1); });
    });
  }

  function lerJson(r) {
    if (!r.ok) throw new Error('http_' + r.status);
    return r.json();
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

  function post(payload) {
    return comRetry(function () {
      return fetch(baseUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(lerJson);
    });
  }

  window.API = {
    identificar: function (nome) { return post({ action: 'identificar', nome: nome }); },
    sessao: function (token) { return post({ action: 'sessao', token: token }); },
    rsvpSalvar: function (token, respostas) {
      return post({ action: 'rsvpSalvar', token: token, respostas: respostas });
    },
    presentesListar: function () { return get('presentesListar', {}); },
    presenteReservar: function (token, presenteId, mensagem) {
      return post({ action: 'presenteReservar', token: token, presenteId: presenteId, mensagem: mensagem || '' });
    },
    contribuirLivre: function (token, valor, mensagem, presenteId) {
      return post({ action: 'contribuirLivre', token: token, valor: valor, mensagem: mensagem || '', presenteId: presenteId || 'livre' });
    },
    pagamentoStatus: function (paymentId) { return get('pagamentoStatus', { paymentId: paymentId }); }
  };
})();
