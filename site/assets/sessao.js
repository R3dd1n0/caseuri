/**
 * sessao.js — sessão do convidado no dispositivo (localStorage).
 *
 * Guardamos só o token assinado (não é segredo). Se o navegador bloquear
 * storage, tudo continua funcionando — só não "lembra" entre visitas.
 */
(function () {
  var CHAVE = 'caseuri.token';

  window.Sessao = {
    salvar: function (token) {
      try { localStorage.setItem(CHAVE, token); } catch (e) { /* modo privado, etc. */ }
    },
    obter: function () {
      try { return localStorage.getItem(CHAVE) || null; } catch (e) { return null; }
    },
    limpar: function () {
      try { localStorage.removeItem(CHAVE); } catch (e) { /* ignora */ }
    }
  };
})();
