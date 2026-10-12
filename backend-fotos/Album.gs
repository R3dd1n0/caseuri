/**
 * Album.gs — validação, limites, pastas e criação da sessão de upload resumível.
 *
 * Fluxo de uma foto/vídeo:
 *   1. acaoCriarSessao: valida ticket + tipo + tamanho + ritmo; decide a pasta
 *      (FOTOS/VIDEOS/OUTROS) pelo tipo; cria a sessão resumível no Drive com as
 *      credenciais do dono do script; registra a linha no Sheets ("iniciado");
 *      devolve a URL de upload de uso único.
 *   2. O navegador faz PUT dos bytes direto nessa URL (ver site/fotos/fotos.js).
 *   3. acaoConfirmar: o navegador avisa o fileId → Sheets vira "concluido".
 */

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
  Logger.log('Planilha pronta. Lembre de preencher as Script Properties (ver docs/SETUP-FOTOS.md).');
}
