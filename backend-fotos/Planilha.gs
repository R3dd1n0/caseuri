/**
 * Planilha.gs — log de metadados (Google Sheets) + leitura de configuração.
 *
 * Configuração (Script Properties — Projeto > Configurações do projeto):
 *   SHEET_ID        id da planilha de log do álbum
 *   FOLDER_FOTOS    id da pasta FOTOS no Drive
 *   FOLDER_VIDEOS   id da pasta VIDEOS no Drive
 *   FOLDER_OUTROS   id da pasta OUTROS no Drive
 *   TICKET_SECRET   string aleatória (use gerarSegredo() uma vez)
 *   UPLOADS_ATIVOS  "sim" (padrão) | "nao"  -> interruptor geral
 *   TZ              (opcional) fuso, padrão America/Fortaleza
 */

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
