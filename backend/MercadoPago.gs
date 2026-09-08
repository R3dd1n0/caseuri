/**
 * MercadoPago.gs — cria cobranças PIX, recebe o webhook e confirma pagamentos.
 *
 * Princípio de robustez: NUNCA confiar cegamente no POST do webhook. Sempre
 * re-consultar o pagamento na API do MP. Além disso, uma trigger por tempo
 * (verificarPagamentosPendentes) varre pendentes como rede de segurança.
 *
 * Credenciais ficam em Script Properties (ver docs/SETUP.md):
 *   MP_ACCESS_TOKEN  — token de acesso da conta Mercado Pago (pessoa física)
 *   WEBHOOK_URL      — a URL do próprio Web App (para notification_url)
 */

var MP_API = 'https://api.mercadopago.com';

/** Cria uma cobrança PIX e devolve os dados do QR. */
function mpCriarPagamentoPix(valor, descricao, externalReference) {
  var token = configSegredo('MP_ACCESS_TOKEN');
  var body = {
    transaction_amount: Math.round(Number(valor) * 100) / 100,
    description: descricao,
    payment_method_id: 'pix',
    external_reference: externalReference,
    payer: { email: configValor('PAYER_EMAIL', 'convidados@example.com') }
  };
  var notif = configValor('WEBHOOK_URL', '');
  if (notif) body.notification_url = notif;

  var resp = UrlFetchApp.fetch(MP_API + '/v1/payments', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-Idempotency-Key': Utilities.getUuid()
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var json = JSON.parse(resp.getContentText() || '{}');
  if (code >= 300) {
    throw new Error('MP erro ' + code + ': ' + (json.message || resp.getContentText()));
  }

  var tx = (json.point_of_interaction && json.point_of_interaction.transaction_data) || {};
  return {
    paymentId: String(json.id),
    qrCode: tx.qr_code || '',
    qrCodeBase64: tx.qr_code_base64 || '',
    expiraEm: json.date_of_expiration || ''
  };
}

/** Consulta o status de um pagamento. Devolve o status "cru" do MP. */
function mpConsultarPagamento(paymentId) {
  var token = configSegredo('MP_ACCESS_TOKEN');
  var resp = UrlFetchApp.fetch(MP_API + '/v1/payments/' + encodeURIComponent(paymentId), {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) return null;
  return JSON.parse(resp.getContentText() || '{}');
}

/** Traduz o status do MP para o nosso vocabulário. */
function traduzStatusMp(mpStatus) {
  switch (mpStatus) {
    case 'approved': return 'confirmado';
    case 'pending':
    case 'in_process':
    case 'authorized': return 'pendente';
    default: return 'expirado'; // rejected, cancelled, refunded, charged_back...
  }
}

/** Entrada do webhook do Mercado Pago (chamada por doPost). */
function webhookMercadoPago(e, corpo) {
  try {
    var p = (e && e.parameter) || {};
    var tipo = p.type || p.topic || corpo.type || (corpo.action ? String(corpo.action).split('.')[0] : '');
    var id = p['data.id'] || p.id ||
      (corpo.data && corpo.data.id) || corpo['data.id'] || corpo.id;

    if (tipo && String(tipo).indexOf('payment') < 0) {
      return ContentService.createTextOutput('ignorado'); // outros tópicos
    }
    if (id) sincronizarPagamento(String(id));
  } catch (err) {
    console.error('Webhook MP falhou: ' + (err && err.stack || err));
    // Ainda respondemos 200: a trigger de poll é a rede de segurança.
  }
  return ContentService.createTextOutput('ok');
}

/** Consulta o MP e reconcilia UM pagamento no livro-razão. */
function sincronizarPagamento(paymentId) {
  var pg = acharPagamento(paymentId);
  if (!pg || pg.status === 'confirmado') return;

  var mp = mpConsultarPagamento(paymentId);
  if (!mp) return;
  var novo = traduzStatusMp(mp.status);

  if (novo === 'confirmado') {
    confirmarPagamento(pg);
  } else if (novo === 'expirado') {
    atualizarLinha(ABAS.PAGAMENTOS, pg._linha, { status: 'expirado' });
    if (pg.tipo === 'item') liberarItem(pg.presente_id);
  }
}

/** Efetiva um pagamento confirmado: esgota o item e marca deu_presente. */
function confirmarPagamento(pg) {
  atualizarLinha(ABAS.PAGAMENTOS, pg._linha, {
    status: 'confirmado',
    confirmado_em: new Date().toISOString()
  });

  if (pg.tipo === 'item') {
    var presente = acharPresente(pg.presente_id);
    if (presente) {
      atualizarLinha(ABAS.PRESENTES, presente._linha, {
        status: 'esgotado',
        pago_por: pg.grupo,
        payment_id: pg.payment_id,
        data_pgto: new Date().toISOString(),
        reservado_por: '',
        reservado_em: ''
      });
    }
  }

  var c = acharConvite(pg.convite_id);
  if (c) atualizarLinha(ABAS.CONVIDADOS, c._linha, { deu_presente: 'sim' });
}

/** Devolve um item ao catálogo (reserva não paga). */
function liberarItem(presenteId) {
  var presente = acharPresente(presenteId);
  if (presente && presente.status === 'reservado') {
    atualizarLinha(ABAS.PRESENTES, presente._linha, {
      status: 'disponivel', reservado_por: '', reservado_em: ''
    });
  }
}

// ---------------------------------------------------------------------------
// Rede de segurança: trigger por tempo
// ---------------------------------------------------------------------------

/** Varre pagamentos pendentes e reconcilia. Também libera reservas vencidas. */
function verificarPagamentosPendentes() {
  liberarReservasExpiradas();
  var t = lerTabela(ABAS.PAGAMENTOS);
  t.linhas.forEach(function (pg) {
    if (pg.status === 'pendente' && pg.payment_id) {
      sincronizarPagamento(String(pg.payment_id));
    }
  });
}

/** Instala (uma vez) a trigger de poll a cada 5 minutos, sem duplicar. */
function instalarTriggerPagamentos() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'verificarPagamentosPendentes') {
      ScriptApp.deleteTrigger(tr);
    }
  });
  ScriptApp.newTrigger('verificarPagamentosPendentes')
    .timeBased().everyMinutes(5).create();
}
