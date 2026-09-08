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

  function get(action, params) {
    var qs = Object.keys(params || {}).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    });
    qs.unshift('action=' + encodeURIComponent(action));
    return fetch(baseUrl() + '?' + qs.join('&'), { method: 'GET' })
      .then(function (r) { return r.json(); });
  }

  function post(payload) {
    return fetch(baseUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  window.API = {
    identificar: function (nome) { return post({ action: 'identificar', nome: nome }); },
    sessao: function (token) { return post({ action: 'sessao', token: token }); },
    rsvpSalvar: function (token, status, qtd, obs) {
      return post({ action: 'rsvpSalvar', token: token, status: status, qtd: qtd, obs: obs });
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
