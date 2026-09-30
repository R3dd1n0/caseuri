/**
 * Recados.gs — mural de recados (os convidados escrevem para os noivos).
 *
 * Privado: nada é exibido no site. O casal lê tudo na aba "Recados" da
 * planilha. A aba é criada sozinha no primeiro recado (via aba()).
 */

/** POST recadoEnviar — grava um recado. Token é opcional (dá contexto). */
function acaoRecadoEnviar(params) {
  var mensagem = String((params && params.mensagem) || '').trim();
  if (!mensagem) return { ok: false, erro: 'dados_invalidos' };
  if (mensagem.length > 2000) mensagem = mensagem.slice(0, 2000);

  var nome = String((params && params.nome) || '').trim().slice(0, 120);

  // Se houver token válido, registra de qual convite veio (leitura humana).
  var convite = '';
  var conviteId = verificarToken(params && params.token);
  if (conviteId) convite = grupoDoConvite(conviteId) || String(conviteId);

  inserirLinha(ABAS.RECADOS, {
    id: Utilities.getUuid(),
    nome: nome,
    mensagem: mensagem,
    convite: convite,
    criado_em: new Date().toISOString()
  });

  return { ok: true };
}
