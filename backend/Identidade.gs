/**
 * Identidade.gs — landing/gate por nome.
 *
 * Regra de match (spec §6.1): primeiro nome obrigatório + qualquer subconjunto
 * dos sobrenomes (em qualquer ordem), ignorando acentos e partículas.
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

/** Um convite casa se QUALQUER um dos seus nomes casa com o digitado. */
function conviteCasa(digitado, campoNomes) {
  var nomes = String(campoNomes || '').split(';');
  for (var i = 0; i < nomes.length; i++) {
    if (nomes[i].trim() && nomeCasa(digitado, nomes[i])) return true;
  }
  return false;
}

/** POST identificar */
function acaoIdentificar(params) {
  var digitado = params && params.nome;
  if (!digitado || tokensNome(digitado).length === 0) {
    return { ok: false, erro: 'dados_invalidos' };
  }

  var t = lerTabela(ABAS.CONVIDADOS);
  var candidatos = t.linhas.filter(function (c) {
    return conviteCasa(digitado, c.nomes);
  });

  if (candidatos.length === 0) return { ok: false, erro: 'nome_nao_encontrado' };
  if (candidatos.length > 1) {
    return { ok: true, resultado: 'multiplo', erro: 'precisa_desambiguar' };
  }

  var c = candidatos[0];
  return {
    ok: true,
    resultado: 'unico',
    token: assinarToken(c.id),
    grupo: c.grupo,
    maxAcompanhantes: Number(c.max_acompanhantes) || 1,
    rsvp: rsvpDoConvite(c),
    deuPresente: String(c.deu_presente).toLowerCase() === 'sim'
  };
}

/** POST sessao — revalida token salvo no dispositivo. */
function acaoSessao(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) return { ok: false, erro: 'token_invalido' };
  var c = acharConvite(conviteId);
  if (!c) return { ok: false, erro: 'token_invalido' };
  return {
    ok: true,
    grupo: c.grupo,
    maxAcompanhantes: Number(c.max_acompanhantes) || 1,
    rsvp: rsvpDoConvite(c),
    deuPresente: String(c.deu_presente).toLowerCase() === 'sim'
  };
}

/** Busca uma linha de convite pelo id. */
function acharConvite(conviteId) {
  var t = lerTabela(ABAS.CONVIDADOS);
  return t.linhas.filter(function (c) { return String(c.id) === String(conviteId); })[0] || null;
}

/** Monta o objeto rsvp exposto ao frontend. */
function rsvpDoConvite(c) {
  return {
    status: c.rsvp_status || 'pendente',
    qtd: Number(c.rsvp_qtd) || 0,
    obs: c.rsvp_obs || '',
    atualizadoEm: c.rsvp_atualizado_em || ''
  };
}
