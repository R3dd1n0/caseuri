/**
 * Identidade.gs — landing/gate por nome (lista NOMINAL, uma linha por pessoa).
 *
 * Regra de match (spec §6.1): primeiro nome obrigatório + qualquer subconjunto
 * dos sobrenomes (em qualquer ordem), ignorando acentos e partículas.
 * A pessoa é identificada; a sessão vale para o CONVITE dela (todas as pessoas
 * nomeadas no mesmo convite_id).
 */

var PARTICULAS = { 'de': 1, 'da': 1, 'do': 1, 'das': 1, 'dos': 1, 'e': 1, 'di': 1, 'du': 1 };

/** minúsculas, sem acento, sem pontuação, espaços colapsados. */
function normalizarTexto(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quebra em tokens já sem partículas. */
function tokensNome(s) {
  return normalizarTexto(s).split(' ').filter(function (t) {
    return t && !PARTICULAS[t];
  });
}

/**
 * O que a pessoa digitou casa com um nome completo?
 * digitado = [primeiro, ...sobrenomes]; alvo = [PRIMEIRO, ...SOBRENOMES].
 * Casa se primeiro==PRIMEIRO e todos os sobrenomes digitados existem no alvo.
 */
function nomeCasa(digitado, alvo) {
  var d = tokensNome(digitado);
  var a = tokensNome(alvo);
  if (d.length === 0 || a.length === 0) return false;
  if (d[0] !== a[0]) return false;

  var sobrenomesAlvo = {};
  for (var i = 1; i < a.length; i++) sobrenomesAlvo[a[i]] = true;
  for (var j = 1; j < d.length; j++) {
    if (!sobrenomesAlvo[d[j]]) return false;
  }
  return true;
}

/** POST identificar */
function acaoIdentificar(params) {
  var digitado = params && params.nome;
  if (!digitado || tokensNome(digitado).length === 0) {
    return { ok: false, erro: 'dados_invalidos' };
  }

  var t = lerTabela(ABAS.CONVIDADOS);
  var convitesCasados = {};
  t.linhas.forEach(function (p) {
    // Crianças não logam: não entram na busca por nome (mas ficam no convite).
    if (String(p.categoria || 'adulto').indexOf('crianca') === 0) return;
    if (nomeCasa(digitado, p.nome)) convitesCasados[p.convite_id] = true;
  });
  var ids = Object.keys(convitesCasados);

  if (ids.length === 0) return { ok: false, erro: 'nome_nao_encontrado' };
  if (ids.length > 1) {
    return { ok: true, resultado: 'multiplo', erro: 'precisa_desambiguar' };
  }

  var resp = conviteResposta(ids[0]);
  resp.resultado = 'unico';
  resp.token = assinarToken(ids[0]);
  return resp;
}

/** POST sessao — revalida token salvo no dispositivo. */
function acaoSessao(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) return { ok: false, erro: 'token_invalido' };
  var info = conviteInfo(conviteId);
  if (!info) return { ok: false, erro: 'token_invalido' };
  return conviteResposta(conviteId);
}

/** Monta a resposta pública de um convite (sem _linha). */
function conviteResposta(conviteId) {
  var info = conviteInfo(conviteId);
  return {
    ok: true,
    grupo: info ? info.grupo : '',
    pessoas: (info ? info.pessoas : []).map(function (p) {
      return { id: p.id, nome: p.nome, categoria: p.categoria, status: p.status, obs: p.obs };
    }),
    deuPresente: conviteDeuPresente(conviteId)
  };
}

/** Lê um convite: rótulo + pessoas (com _linha para escrita). */
function conviteInfo(conviteId) {
  var t = lerTabela(ABAS.CONVIDADOS);
  var pessoas = t.linhas.filter(function (p) {
    return String(p.convite_id) === String(conviteId);
  }).map(function (p) {
    return {
      id: p.id, nome: p.nome, grupo: p.grupo, categoria: p.categoria || 'adulto',
      status: p.rsvp_status || 'pendente', obs: p.rsvp_obs || '', _linha: p._linha
    };
  });
  if (pessoas.length === 0) return null;
  return { conviteId: conviteId, grupo: pessoas[0].grupo || '', pessoas: pessoas };
}

/** Rótulo do convite (para registrar em Pagamentos). */
function grupoDoConvite(conviteId) {
  var info = conviteInfo(conviteId);
  return info ? (info.grupo || conviteId) : conviteId;
}

/** O convite já deu presente? Derivado do livro-razão (pagamento confirmado). */
function conviteDeuPresente(conviteId) {
  var t = lerTabela(ABAS.PAGAMENTOS);
  return t.linhas.some(function (pg) {
    return String(pg.convite_id) === String(conviteId) && pg.status === 'confirmado';
  });
}
