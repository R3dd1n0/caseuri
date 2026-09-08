/**
 * Codigo.gs — ponto de entrada do Web App e roteamento.
 *
 * O Apps Script só expõe doGet/doPost. Tudo é roteado pelo campo `action`.
 * Nenhum conteúdo/segredo mora aqui: segredos vêm de Script Properties
 * (ver `configSegredo`) e o conteúdo do site mora no frontend.
 */

// Mapa de ações -> função handler. Cada handler recebe (params) e devolve objeto.
var ROTAS = {
  identificar:      acaoIdentificar,      // Identidade.gs
  sessao:           acaoSessao,           // Identidade.gs
  rsvpSalvar:       acaoRsvpSalvar,       // Rsvp.gs
  presentesListar:  acaoPresentesListar,  // Presentes.gs
  presenteReservar: acaoPresenteReservar, // Presentes.gs
  contribuirLivre:  acaoContribuirLivre,  // Presentes.gs
  pagamentoStatus:  acaoPagamentoStatus   // Presentes.gs
};

/** GET: ações de leitura (query string). */
function doGet(e) {
  return rotear(e, (e && e.parameter) || {});
}

/**
 * POST: ações de escrita (corpo text/plain com JSON) e o webhook do Mercado Pago.
 * O webhook é tratado à parte porque não segue o formato { action, ... }.
 */
function doPost(e) {
  var corpo = lerCorpoJson(e);

  // Heurística de webhook do Mercado Pago: vem sem `action`, mas com
  // indícios de notificação de pagamento (query `type`/`topic` ou corpo com id).
  var p = (e && e.parameter) || {};
  var pareceWebhook = !corpo.action &&
    (p.type || p.topic || p['data.id'] || p.id || corpo.type || corpo.action === undefined && (corpo.data || corpo.resource));
  if (pareceWebhook && !corpo.action) {
    return webhookMercadoPago(e, corpo); // MercadoPago.gs
  }

  return rotear(e, corpo);
}

/** Despacha para o handler certo com base em `action`. */
function rotear(e, params) {
  try {
    var acao = params.action;
    var handler = ROTAS[acao];
    if (!handler) return jsonResposta({ ok: false, erro: 'dados_invalidos' });
    var resultado = handler(params) || {};
    if (resultado.ok === undefined) resultado.ok = true;
    return jsonResposta(resultado);
  } catch (err) {
    console.error('Erro em rotear: ' + (err && err.stack || err));
    return jsonResposta({ ok: false, erro: 'interno' });
  }
}

// ---------------------------------------------------------------------------
// Helpers de I/O
// ---------------------------------------------------------------------------

/** Serializa a resposta como JSON. */
function jsonResposta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Lê o corpo do POST como JSON (text/plain evita preflight de CORS). */
function lerCorpoJson(e) {
  try {
    if (e && e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
  } catch (err) {
    console.warn('Corpo POST não é JSON válido: ' + err);
  }
  return {};
}

// ---------------------------------------------------------------------------
// Token de sessão (HMAC) — identidade não-secreta, porém à prova de adulteração
// ---------------------------------------------------------------------------

/** Gera token = base64url(conviteId) + "." + hmac. */
function assinarToken(conviteId) {
  var id = String(conviteId);
  var assinatura = _hmac(id);
  return _b64url(id) + '.' + assinatura;
}

/** Verifica o token e devolve o conviteId, ou null se inválido. */
function verificarToken(token) {
  if (!token || token.indexOf('.') < 0) return null;
  var partes = token.split('.');
  var id;
  try { id = _b64urlDecode(partes[0]); } catch (e) { return null; }
  var esperado = _hmac(id);
  // Comparação simples; volume é baixíssimo (timing não é ameaça relevante aqui).
  return esperado === partes[1] ? id : null;
}

function _hmac(texto) {
  var chave = configSegredo('TOKEN_SECRET');
  var bytes = Utilities.computeHmacSha256Signature(texto, chave);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}
function _b64url(s) {
  return Utilities.base64EncodeWebSafe(s).replace(/=+$/, '');
}
function _b64urlDecode(s) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString();
}

/** Exige token válido; lança erro amigável se inválido. */
function exigirConvite(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) { var e = new Error('token_invalido'); e.amigavel = true; throw e; }
  return conviteId;
}
