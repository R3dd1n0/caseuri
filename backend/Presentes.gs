/**
 * Presentes.gs — catálogo, reserva (soft-lock), contribuição livre e status.
 *
 * Fluxo: reservar/contribuir cria uma cobrança PIX no Mercado Pago e registra
 * um pagamento PENDENTE no livro-razão (aba Pagamentos). A confirmação real
 * acontece no webhook / na trigger de poll (MercadoPago.gs), que é a fonte da
 * verdade — aqui nunca marcamos "esgotado" por conta própria.
 */

/** GET presentesListar — catálogo público (sem expor quem pagou). */
function acaoPresentesListar() {
  liberarReservasExpiradas(); // higiene: devolve itens com soft-lock vencido
  var t = lerTabela(ABAS.PRESENTES);
  var presentes = t.linhas.map(function (p) {
    return {
      id: p.id,
      titulo: p.titulo,
      descricao: p.descricao,
      valor: p.valor === '' ? null : Number(p.valor),
      tipo: p.tipo || 'item',
      status: p.status || 'disponivel'
    };
  });
  return { ok: true, presentes: presentes };
}

/** POST presenteReservar — escolhe um item e gera o PIX. */
function acaoPresenteReservar(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) return { ok: false, erro: 'token_invalido' };

  var presenteId = params.presenteId;
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  var presente;
  try {
    liberarReservasExpiradas();
    presente = acharPresente(presenteId);
    if (!presente) return { ok: false, erro: 'dados_invalidos' };

    if (presente.tipo === 'item') {
      if (presente.status !== 'disponivel') {
        return { ok: false, erro: 'presente_indisponivel' };
      }
      // Soft-lock: marca reservado ANTES de gerar o PIX (impede corrida).
      atualizarLinha(ABAS.PRESENTES, presente._linha, {
        status: 'reservado',
        reservado_por: conviteId,
        reservado_em: new Date().toISOString()
      });
    }
  } finally {
    lock.releaseLock();
  }

  var valor = Number(presente.valor);
  if (!valor || valor <= 0) {
    if (presente.tipo === 'item') {
      atualizarLinha(ABAS.PRESENTES, presente._linha, {
        status: 'disponivel', reservado_por: '', reservado_em: ''
      });
    }
    return { ok: false, erro: 'dados_invalidos' };
  }

  return gerarCobranca(conviteId, {
    tipo: presente.tipo === 'livre' ? 'livre' : 'item',
    presenteId: presente.id,
    titulo: presente.titulo,
    valor: valor,
    mensagem: params.mensagem || '',
    revertePresente: presente.tipo === 'item' ? presente : null
  });
}

/** POST contribuirLivre — PIX de valor livre (nunca esgota). */
function acaoContribuirLivre(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) return { ok: false, erro: 'token_invalido' };

  var valor = Number(params.valor);
  if (!valor || valor <= 0) return { ok: false, erro: 'dados_invalidos' };

  return gerarCobranca(conviteId, {
    tipo: 'livre',
    presenteId: params.presenteId || 'livre',
    titulo: 'Contribuição livre',
    valor: valor,
    mensagem: params.mensagem || '',
    revertePresente: null
  });
}

/** GET pagamentoStatus — o frontend faz polling até confirmar. */
function acaoPagamentoStatus(params) {
  var pg = acharPagamento(params && params.paymentId);
  if (!pg) return { ok: false, erro: 'pagamento_nao_encontrado' };
  return { ok: true, status: pg.status || 'pendente' };
}

// ---------------------------------------------------------------------------
// Núcleo compartilhado
// ---------------------------------------------------------------------------

/** Cria a cobrança no MP + registra pagamento pendente. Reverte item se falhar. */
function gerarCobranca(conviteId, dados) {
  var c = acharConvite(conviteId);
  var grupo = c ? c.grupo : conviteId;
  var descricao = (configValor('MP_DESCRICAO_PREFIXO', 'Presente de casamento')) +
    ' - ' + dados.titulo;

  var cobranca;
  try {
    cobranca = mpCriarPagamentoPix(dados.valor, descricao, conviteId + ':' + dados.presenteId);
  } catch (err) {
    console.error('Falha ao criar cobrança MP: ' + err);
    if (dados.revertePresente) {
      atualizarLinha(ABAS.PRESENTES, dados.revertePresente._linha, {
        status: 'disponivel', reservado_por: '', reservado_em: ''
      });
    }
    return { ok: false, erro: 'interno' };
  }

  inserirLinha(ABAS.PAGAMENTOS, {
    payment_id: cobranca.paymentId,
    convite_id: conviteId,
    grupo: grupo,
    tipo: dados.tipo,
    presente_id: dados.presenteId,
    titulo: dados.titulo,
    valor: dados.valor,
    status: 'pendente',
    mensagem: dados.mensagem,
    criado_em: new Date().toISOString(),
    confirmado_em: ''
  });

  return {
    ok: true,
    pagamento: {
      paymentId: cobranca.paymentId,
      qrCode: cobranca.qrCode,
      qrCodeBase64: cobranca.qrCodeBase64,
      copiaCola: cobranca.qrCode,
      valor: dados.valor,
      expiraEm: cobranca.expiraEm || ''
    }
  };
}

function acharPresente(id) {
  var t = lerTabela(ABAS.PRESENTES);
  return t.linhas.filter(function (p) { return String(p.id) === String(id); })[0] || null;
}

function acharPagamento(paymentId) {
  var t = lerTabela(ABAS.PAGAMENTOS);
  return t.linhas.filter(function (p) { return String(p.payment_id) === String(paymentId); })[0] || null;
}

/** Devolve ao catálogo itens cujo soft-lock venceu sem pagamento confirmado. */
function liberarReservasExpiradas() {
  var minutos = Number(configValor('SOFTLOCK_MINUTOS', 30)) || 30;
  var limite = Date.now() - minutos * 60 * 1000;
  var t = lerTabela(ABAS.PRESENTES);
  t.linhas.forEach(function (p) {
    if (p.status === 'reservado' && p.reservado_em) {
      var quando = Date.parse(p.reservado_em);
      if (quando && quando < limite) {
        atualizarLinha(ABAS.PRESENTES, p._linha, {
          status: 'disponivel', reservado_por: '', reservado_em: ''
        });
        marcarPagamentosExpirados(p.id, p.reservado_por);
      }
    }
  });
}

/** Marca como expirado o(s) pagamento(s) pendente(s) daquele item/convite. */
function marcarPagamentosExpirados(presenteId, conviteId) {
  var t = lerTabela(ABAS.PAGAMENTOS);
  t.linhas.forEach(function (pg) {
    if (pg.status === 'pendente' && String(pg.presente_id) === String(presenteId) &&
        String(pg.convite_id) === String(conviteId)) {
      atualizarLinha(ABAS.PAGAMENTOS, pg._linha, { status: 'expirado' });
    }
  });
}
