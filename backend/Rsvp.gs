/**
 * Rsvp.gs — confirmar / recusar presença POR PESSOA (lista nominal).
 *
 * Recebe uma lista de respostas [{ id, status, obs? }], uma por pessoa do
 * convite. Cada id precisa pertencer ao convite do token (não dá para editar
 * pessoas de outro convite).
 */

/** POST rsvpSalvar */
function acaoRsvpSalvar(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) return { ok: false, erro: 'token_invalido' };

  var respostas = params.respostas;
  if (!respostas || !respostas.length) return { ok: false, erro: 'dados_invalidos' };

  var info = conviteInfo(conviteId);
  if (!info) return { ok: false, erro: 'token_invalido' };

  // Índice das pessoas deste convite, por id (barra edição cruzada).
  var porId = {};
  info.pessoas.forEach(function (p) { porId[String(p.id)] = p; });

  var agora = new Date().toISOString();
  var atualizou = false;

  respostas.forEach(function (r) {
    var pessoa = porId[String(r && r.id)];
    var status = String(r && r.status || '').toLowerCase();
    if (!pessoa) return;
    if (status !== 'confirmado' && status !== 'recusado' && status !== 'pendente') return;
    atualizarLinha(ABAS.CONVIDADOS, pessoa._linha, {
      rsvp_status: status,
      rsvp_obs: String(r.obs || '').slice(0, 500),
      rsvp_atualizado_em: agora
    });
    atualizou = true;
  });

  if (!atualizou) return { ok: false, erro: 'dados_invalidos' };
  return conviteResposta(conviteId);
}
