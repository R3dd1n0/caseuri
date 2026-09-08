/**
 * Rsvp.gs — confirmar / recusar presença (por convite/grupo).
 */

/** POST rsvpSalvar */
function acaoRsvpSalvar(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) return { ok: false, erro: 'token_invalido' };

  var status = String(params.status || '').toLowerCase();
  if (status !== 'confirmado' && status !== 'recusado') {
    return { ok: false, erro: 'dados_invalidos' };
  }

  var c = acharConvite(conviteId);
  if (!c) return { ok: false, erro: 'token_invalido' };

  var maxAcomp = Number(c.max_acompanhantes) || 1;
  var qtd = status === 'confirmado'
    ? Math.max(1, Math.min(maxAcomp, Number(params.qtd) || 1))
    : 0;
  var obs = String(params.obs || '').slice(0, 500);
  var agora = new Date().toISOString();

  atualizarLinha(ABAS.CONVIDADOS, c._linha, {
    rsvp_status: status,
    rsvp_qtd: qtd,
    rsvp_obs: obs,
    rsvp_atualizado_em: agora
  });

  return { ok: true, rsvp: { status: status, qtd: qtd, obs: obs, atualizadoEm: agora } };
}
