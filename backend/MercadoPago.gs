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

/**
 * Cria uma preferência de Checkout Pro (cartão e afins) e devolve o link.
 * O pagamento em si só nasce quando o convidado paga na tela do MP; por isso
 * a conciliação depois é feita pela external_reference (ver sincronização).
 * Juros de parcelamento ficam por conta de quem paga (padrão do Checkout Pro).
 */
function mpCriarPreferenciaCartao(valor, descricao, externalReference) {
  var token = configSegredo('MP_ACCESS_TOKEN');
  var site = configValor('SITE_URL', 'https://r3dd1n0.github.io/caseuri/');
  var volta = site + (site.indexOf('?') < 0 ? '?' : '&') + 'pgto=cartao';

  var body = {
    items: [{
      title: descricao,
      quantity: 1,
      currency_id: 'BRL',
      unit_price: Math.round(Number(valor) * 100) / 100
    }],
    external_reference: externalReference,
    payer: { email: configValor('PAYER_EMAIL', 'convidados@example.com') },
    back_urls: { success: volta, pending: volta, failure: volta },
    auto_return: 'approved',
    // Foca no cartão: tira boleto (ticket) e Pix (bank_transfer), que já tem
    // botão próprio na página. Parcelamento até 12x, juros por conta do pagador.
    payment_methods: {
      excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }],
      installments: 12
    }
  };
  var notif = configValor('WEBHOOK_URL', '');
  if (notif) body.notification_url = notif;

  var resp = UrlFetchApp.fetch(MP_API + '/checkout/preferences', {
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
    throw new Error('MP pref erro ' + code + ': ' + (json.message || resp.getContentText()));
  }
  return { preferenceId: String(json.id), initPoint: json.init_point || json.sandbox_init_point };
}

/** Busca um pagamento pela external_reference (usado p/ conciliar cartão). */
function mpBuscarPagamentoPorReferencia(externalReference) {
  var token = configSegredo('MP_ACCESS_TOKEN');
  var url = MP_API + '/v1/payments/search?sort=date_created&criteria=desc' +
    '&external_reference=' + encodeURIComponent(externalReference);
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) return null;
  var json = JSON.parse(resp.getContentText() || '{}');
  var results = json.results || [];
  if (!results.length) return null;
  for (var i = 0; i < results.length; i++) {
    if (results[i].status === 'approved') return results[i];
  }
  return results[0]; // o mais recente (pode estar pendente/recusado)
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
  if (pg) {
    if (pg.status === 'confirmado') return;
    var mp = mpConsultarPagamento(paymentId);
    if (!mp) return;
    aplicarStatusPagamento(pg, traduzStatusMp(mp.status), paymentId);
    return;
  }
  // Não é um pagamento nosso (PIX) conhecido: pode ser um pagamento de cartão
  // (Checkout Pro) chegando pelo webhook. Concilia pela external_reference.
  reconciliarCartaoPorPagamento(paymentId);
}

/**
 * Pagamento de cartão vindo do webhook: o id é do MP, mas a nossa linha
 * pendente está indexada por 'cc:<nonce>'. Achamos pela external_reference.
 */
function reconciliarCartaoPorPagamento(paymentId) {
  var mp = mpConsultarPagamento(paymentId);
  if (!mp || !mp.external_reference) return;
  var partes = String(mp.external_reference).split(':');
  if (partes.length < 3) return; // formato de cartão: conviteId:presenteId:nonce
  var pg = acharPagamento('cc:' + partes[2]);
  if (!pg || pg.status === 'confirmado') return;
  aplicarStatusPagamento(pg, traduzStatusMp(mp.status), String(mp.id));
}

/** Aplica o status reconciliado a uma linha do livro-razão. */
function aplicarStatusPagamento(pg, novo, idReal) {
  if (novo === 'confirmado') {
    // Cartão: troca a chave provisória 'cc:<nonce>' pelo id real do pagamento.
    if (idReal && String(pg.payment_id) !== String(idReal)) {
      atualizarLinha(ABAS.PAGAMENTOS, pg._linha, { payment_id: idReal });
      pg.payment_id = idReal;
    }
    confirmarPagamento(pg);
  } else if (novo === 'expirado') {
    atualizarLinha(ABAS.PAGAMENTOS, pg._linha, { status: 'expirado' });
    if (pg.tipo === 'item') liberarItem(pg.presente_id);
  }
}

/** Efetiva um pagamento confirmado: marca o pagamento e esgota o item. */
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
  // "deuPresente" é derivado do livro-razão (status confirmado); nada a gravar
  // na aba Convidados (que agora é uma linha por pessoa).
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
    if (pg.status !== 'pendente') return;
    var pid = String(pg.payment_id || '');
    if (!pid) return;
    if (pid.indexOf('cc:') === 0) {
      // Cartão pendente: procura o pagamento real pela external_reference.
      var extRef = pg.convite_id + ':' + pg.presente_id + ':' + pid.slice(3);
      var mp = mpBuscarPagamentoPorReferencia(extRef);
      if (mp) aplicarStatusPagamento(pg, traduzStatusMp(mp.status), String(mp.id));
    } else {
      sincronizarPagamento(pid); // PIX
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
