/**
 * Codigo.gs — entrada do Web App do ÁLBUM (upload de fotos/vídeos do casamento).
 *
 * O Apps Script é só a CAMADA DE CONTROLE: ele valida, aplica limites, cria uma
 * SESSÃO DE UPLOAD resumível no Google Drive e registra os metadados no Sheets.
 * Os BYTES do arquivo NÃO passam por aqui — o navegador do convidado envia o
 * arquivo direto para a URL de sessão devolvida (ver Album.gs). Isso contorna os
 * limites de tamanho/tempo/memória do Apps Script.
 *
 * Nada de segredo/estrutura do Drive é exposto ao convidado: ele recebe apenas
 * uma URL de upload de uso único, amarrada a um único arquivo.
 */

var ROTAS_POST = {
  criarSessao: acaoCriarSessao, // Album.gs
  confirmar:   acaoConfirmar    // Album.gs
};

/** GET: emite ticket e health-check. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'ticket') return json(emitirTicket());
  if (p.action === 'ping')   return json({ ok: true, uploadsAtivos: uploadsAtivos() });
  return json({ ok: false, erro: 'dados_invalidos' });
}

/** POST: ações que alteram estado (corpo text/plain com JSON, evita preflight CORS). */
function doPost(e) {
  var corpo = lerJson(e);
  var handler = ROTAS_POST[corpo.action];
  if (!handler) return json({ ok: false, erro: 'dados_invalidos' });
  try {
    var r = handler(corpo) || {};
    if (r.ok === undefined) r.ok = true;
    return json(r);
  } catch (err) {
    console.error('Erro: ' + (err && err.stack || err));
    return json({ ok: false, erro: 'interno' });
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function lerJson(e) {
  try { return JSON.parse(e.postData.contents); } catch (_) { return {}; }
}

// ---------------------------------------------------------------------------
// Ticket HMAC — porta de entrada leve: anti-bot + chave de rate limit.
// Emitido ao abrir a página (invisível para o convidado). Sem ticket válido,
// o backend não cria sessão de upload.
// ---------------------------------------------------------------------------

function segredoTicket() {
  var s = prop('TICKET_SECRET', '');
  if (!s) throw new Error('Falta a Script Property TICKET_SECRET.');
  return s;
}
function b64url(s) { return Utilities.base64EncodeWebSafe(s).replace(/=+$/, ''); }
function hmac(txt) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(txt, segredoTicket())
  ).replace(/=+$/, '');
}
function emitirTicket() {
  var payload = { id: Utilities.getUuid(), exp: Date.now() + 1000 * 60 * 60 * 3 }; // 3 horas
  var corpo = b64url(JSON.stringify(payload));
  return { ok: true, ticket: corpo + '.' + hmac(corpo), expiraEm: payload.exp };
}
function validarTicket(ticket) {
  if (!ticket || ticket.indexOf('.') < 0) return null;
  var partes = ticket.split('.');
  if (hmac(partes[0]) !== partes[1]) return null;
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString());
  } catch (_) { return null; }
  if (!payload || !payload.exp || Date.now() > payload.exp) return null;
  return payload; // { id, exp }
}

/** Rode UMA vez no editor para gerar um valor para a Script Property TICKET_SECRET. */
function gerarSegredo() {
  Logger.log(Utilities.getUuid() + Utilities.getUuid());
}
