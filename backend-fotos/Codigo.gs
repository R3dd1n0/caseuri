/**
 * Codigo.gs — backend COMPLETO do álbum colaborativo (Felipe & Mariana).
 *
 * Tudo num arquivo só, para facilitar o deploy no editor do Apps Script.
 * (No Apps Script todas as funções compartilham o mesmo escopo global, então a
 *  ordem dentro do arquivo não importa.)
 *
 * O Apps Script é só a CAMADA DE CONTROLE: valida, aplica limites, cria uma
 * SESSÃO DE UPLOAD resumível no Google Drive e registra os metadados no Sheets.
 * Os BYTES do arquivo NÃO passam por aqui — o navegador do convidado envia o
 * arquivo direto para a URL de sessão devolvida. Isso contorna os limites de
 * tamanho/tempo/memória do Apps Script. O convidado nunca recebe credencial nem
 * vê a estrutura do Drive: só uma URL de upload de uso único por arquivo.
 *
 * Configuração (Projeto > Configurações do projeto > Propriedades do script):
 *   SHEET_ID        id da planilha de log
 *   FOLDER_FOTOS    id da pasta FOTOS
 *   FOLDER_VIDEOS   id da pasta VIDEOS
 *   FOLDER_OUTROS   id da pasta OUTROS
 *   TICKET_SECRET   string aleatória (use gerarSegredo() uma vez)
 *   UPLOADS_ATIVOS  "sim" (padrão) | "nao"  -> interruptor geral
 *   TZ              (opcional) fuso, padrão America/Fortaleza
 */

// ===========================================================================
// 1) Configuração e planilha de log
// ===========================================================================

var ABA_UPLOADS = 'Uploads';
var COLUNAS_UPLOADS = [
  'id', 'criado_em', 'nome_convidado', 'arquivo_original',
  'tipo', 'tamanho_bytes', 'drive_file_id', 'status'
];

function props() { return PropertiesService.getScriptProperties(); }
function prop(chave, padrao) {
  var v = props().getProperty(chave);
  return (v === null || v === undefined || v === '') ? padrao : v;
}

function planilha() {
  var id = prop('SHEET_ID', '');
  if (!id) throw new Error('Falta a Script Property SHEET_ID.');
  return SpreadsheetApp.openById(id);
}

function abaUploads() {
  var ss = planilha();
  var sh = ss.getSheetByName(ABA_UPLOADS);
  if (!sh) {
    sh = ss.insertSheet(ABA_UPLOADS);
    sh.getRange(1, 1, 1, COLUNAS_UPLOADS.length).setValues([COLUNAS_UPLOADS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function registrarUpload(obj) {
  var sh = abaUploads();
  sh.appendRow(COLUNAS_UPLOADS.map(function (c) {
    return obj.hasOwnProperty(c) ? obj[c] : '';
  }));
}

/** Atualiza status/drive_file_id da linha cujo id bate. */
function atualizarStatus(id, patch) {
  var sh = abaUploads();
  var dados = sh.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]) === String(id)) {
      if (patch.drive_file_id !== undefined) dados[i][6] = patch.drive_file_id;
      if (patch.status !== undefined)        dados[i][7] = patch.status;
      sh.getRange(i + 1, 1, 1, COLUNAS_UPLOADS.length).setValues([dados[i]]);
      return true;
    }
  }
  return false;
}

// ===========================================================================
// 2) Ticket HMAC — porta de entrada leve: anti-bot + chave de rate limit
// ===========================================================================

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

// ===========================================================================
// 3) Limites, validação, pastas e sessão de upload resumível
// ===========================================================================

// ---- Limites (ajuste à vontade) -------------------------------------------
var MAX_FOTO_BYTES  = 50  * 1024 * 1024;   // 50 MB
var MAX_VIDEO_BYTES = 300 * 1024 * 1024;   // 300 MB
var MAX_OUTRO_BYTES = 50  * 1024 * 1024;   // 50 MB
var MAX_POR_TICKET  = 60;                  // teto de arquivos por ticket na janela
var JANELA_MIN      = 60;                  // janela (min) para o teto acima

var TIPOS_FOTO = {
  'image/jpeg': 1, 'image/jpg': 1, 'image/png': 1,
  'image/webp': 1, 'image/heic': 1, 'image/heif': 1
};
var TIPOS_VIDEO = {
  'video/mp4': 1, 'video/quicktime': 1, 'video/x-quicktime': 1, 'video/3gpp': 1
};

/** Interruptor geral: Script Property UPLOADS_ATIVOS = "nao" desliga tudo. */
function uploadsAtivos() {
  return String(prop('UPLOADS_ATIVOS', 'sim')).toLowerCase() !== 'nao';
}

/** Classifica em foto | video | outro, pelo mime e, na falta, pela extensão. */
function categoria(mime, nome) {
  var m = String(mime || '').toLowerCase();
  if (TIPOS_FOTO[m]) return 'foto';
  if (TIPOS_VIDEO[m] || m.indexOf('video/') === 0) return 'video';
  if (m.indexOf('image/') === 0) return 'foto';
  var ext = ((String(nome || '').match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
  if ({ jpg: 1, jpeg: 1, png: 1, webp: 1, heic: 1, heif: 1 }[ext]) return 'foto';
  if ({ mp4: 1, mov: 1, m4v: 1, '3gp': 1 }[ext]) return 'video';
  return 'outro';
}

function pastaDe(cat) {
  var mapa = {
    foto:  prop('FOLDER_FOTOS', ''),
    video: prop('FOLDER_VIDEOS', ''),
    outro: prop('FOLDER_OUTROS', '')
  };
  var id = mapa[cat] || mapa.outro;
  if (!id) throw new Error('Pasta nao configurada para a categoria: ' + cat);
  return id;
}

function limiteDe(cat) {
  return cat === 'video' ? MAX_VIDEO_BYTES : (cat === 'foto' ? MAX_FOTO_BYTES : MAX_OUTRO_BYTES);
}

/** Remove acentos, caracteres de caminho e lixo; limita tamanho. */
function sanitizarNome(nome) {
  var n = String(nome || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '');
  n = n.replace(/[\/\\\r\n\t]+/g, ' ').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, ' ').trim();
  return (n || 'arquivo').slice(0, 120);
}

/** Nome final: carimbo de data + nome do convidado (se houver) + nome original. */
function nomeFinal(nomeConvidado, nomeArq) {
  var tz = prop('TZ', 'America/Fortaleza');
  var carimbo = Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');
  var quem = sanitizarNome(nomeConvidado || '').replace(/\s+/g, '_');
  var base = sanitizarNome(nomeArq);
  return (carimbo + (quem ? ('_' + quem) : '') + '_' + base).slice(0, 180);
}

/** Rate limit simples por ticket, via CacheService (não persiste além da janela). */
function checarRitmo(ticketId) {
  var cache = CacheService.getScriptCache();
  var chave = 'cnt_' + ticketId;
  var atual = Number(cache.get(chave) || '0');
  if (atual >= MAX_POR_TICKET) return false;
  cache.put(chave, String(atual + 1), JANELA_MIN * 60);
  return true;
}

/** POST criarSessao — valida e devolve a URL de upload resumível. */
function acaoCriarSessao(c) {
  if (!uploadsAtivos()) return { ok: false, erro: 'uploads_desativados' };

  var tk = validarTicket(c.ticket);
  if (!tk) return { ok: false, erro: 'ticket_invalido' };

  var a = c.arquivo || {};
  var nome = String(a.nome || '');
  var mime = String(a.tipo || '');
  var tam  = Number(a.tamanho || 0);
  if (!nome || !tam || tam <= 0) return { ok: false, erro: 'dados_invalidos' };

  var cat = categoria(mime, nome);
  if (tam > limiteDe(cat)) return { ok: false, erro: 'arquivo_grande', limite: limiteDe(cat), categoria: cat };
  if (!checarRitmo(tk.id))  return { ok: false, erro: 'limite_envios' };

  var mimeFinal = mime || (cat === 'foto' ? 'image/jpeg' : (cat === 'video' ? 'video/mp4' : 'application/octet-stream'));
  var nomeArq   = nomeFinal(c.nome, nome);
  var uploadUrl = criarSessaoResumivel(nomeArq, mimeFinal, tam, pastaDe(cat));

  var id = Utilities.getUuid();
  registrarUpload({
    id: id,
    criado_em: new Date().toISOString(),
    nome_convidado: String(c.nome || '').slice(0, 80),
    arquivo_original: nome.slice(0, 160),
    tipo: mimeFinal,
    tamanho_bytes: tam,
    drive_file_id: '',
    status: 'iniciado'
  });

  return { ok: true, registroId: id, uploadUrl: uploadUrl, categoria: cat };
}

/**
 * Cria a sessão resumível na API do Drive, com as credenciais do dono do script.
 * A URL devolvida (header Location) já carrega a autorização: o convidado faz o
 * PUT dos bytes nela sem precisar de nenhuma credencial.
 */
function criarSessaoResumivel(nome, mime, tam, pastaId) {
  var url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': mime,
      'X-Upload-Content-Length': String(tam)
    },
    payload: JSON.stringify({ name: nome, mimeType: mime, parents: [pastaId] }),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code >= 300) throw new Error('Drive sessao ' + code + ': ' + resp.getContentText());
  var h = resp.getAllHeaders();
  var loc = h['Location'] || h['location'];
  if (!loc) throw new Error('Sessao sem header Location.');
  return loc;
}

/** POST confirmar — o navegador avisa que terminou (ou falhou) o PUT. */
function acaoConfirmar(c) {
  var tk = validarTicket(c.ticket);
  if (!tk) return { ok: false, erro: 'ticket_invalido' };
  if (!c.registroId) return { ok: false, erro: 'dados_invalidos' };
  atualizarStatus(c.registroId, {
    status: (c.status === 'erro') ? 'erro' : 'concluido',
    drive_file_id: String(c.fileId || '')
  });
  return { ok: true };
}

/** Rode UMA vez no editor para criar a aba de log na planilha. */
function setupAlbum() {
  abaUploads();
  Logger.log('Planilha pronta. Confira as Script Properties (ver docs/SETUP-FOTOS.md).');
}

/**
 * DIAGNÓSTICO — rode no editor e veja o Registro de execução.
 * Confirma se o token do dono tem acesso ao Drive (escopo drive + UrlFetch).
 * HTTP 200 = escopos OK; qualquer outra coisa (ou pedido de autorização) = falta escopo.
 */
function testarDrive() {
  var token = ScriptApp.getOAuthToken();
  var fid = prop('FOLDER_FOTOS', '');
  Logger.log('FOLDER_FOTOS = ' + fid);
  var resp = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + fid + '?fields=id,name,mimeType&supportsAllDrives=true',
    { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
  );
  Logger.log('Drive HTTP ' + resp.getResponseCode());
  Logger.log(resp.getContentText().slice(0, 300));
}

// ===========================================================================
// 4) Entrada do Web App (doGet / doPost) + roteamento
// ===========================================================================

var ROTAS_POST = {
  criarSessao: acaoCriarSessao,
  confirmar:   acaoConfirmar
};

/** GET: emite ticket e health-check. */
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === 'ticket') return json(emitirTicket());
    if (p.action === 'ping')   return json({ ok: true, uploadsAtivos: uploadsAtivos() });
    return json({ ok: false, erro: 'dados_invalidos' });
  } catch (err) {
    console.error('Erro doGet: ' + (err && err.stack || err));
    return json({ ok: false, erro: 'interno' });
  }
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
