# Contrato de API — frontend ↔ backend

Backend = **um único Web App** do Google Apps Script. O Apps Script expõe só
duas entradas (`doGet`, `doPost`), então tudo é roteado por um campo **`action`**.

## Convenções

- **Base URL:** a URL do Web App publicado (ver `docs/SETUP.md`). Fica em
  `site/config.js` no frontend (não é segredo).
- **Formato:** JSON nos dois sentidos.
- **CORS / sem preflight:** o frontend faz `POST` com
  `Content-Type: text/plain;charset=utf-8` e o JSON no corpo. Isso evita o
  *preflight* (o Apps Script não deixa customizar headers de CORS). `GET` usa
  query string.
- **Resposta padrão:** todo endpoint devolve
  `{ "ok": true, ... }` ou `{ "ok": false, "erro": "codigo_do_erro" }`.
- **Sessão:** após identificar, o backend devolve um **`token`** assinado
  (HMAC) que embute o `conviteId`. O frontend guarda no `localStorage` e reenvia
  em toda ação autenticada. O token não é segredo, mas é **à prova de
  adulteração** (não dá pra forjar outro `conviteId`).

## Erros comuns (`erro`)
`nome_nao_encontrado` · `precisa_desambiguar` · `token_invalido` ·
`presente_indisponivel` · `pagamento_nao_encontrado` · `dados_invalidos` ·
`interno`.

---

## 1. `identificar` — landing / gate por nome
`POST { action: "identificar", nome: "felipe araujo" }`

Aplica a regra de match (§6.1 da especificação).

- **1 convite casa:**
  `{ ok:true, resultado:"unico", token:"…", grupo:"…", pessoas:[{id,nome,status,obs}], deuPresente:false }`
- **>1 casa:** `{ ok:true, resultado:"multiplo", erro:"precisa_desambiguar" }`
  (frontend pede mais um sobrenome e repete)
- **0 casa:** `{ ok:false, erro:"nome_nao_encontrado" }`

> Lista **nominal**: um convite tem uma ou mais PESSOAS nomeadas (inclusive
> acompanhantes). Não existe "número de acompanhantes". `pessoas[].status` é
> `pendente | confirmado | recusado`.

## 2. `sessao` — revalidar token salvo
`POST { action:"sessao", token:"…" }`
→ `{ ok:true, grupo, pessoas:[{id,nome,status,obs}], deuPresente }` ou
`{ ok:false, erro:"token_invalido" }`.
Usado quando o dispositivo já tem sessão salva (entra direto).

## 3. `rsvpSalvar` — confirmar / recusar presença POR PESSOA
`POST { action:"rsvpSalvar", token, respostas:[ { id, status:"confirmado"|"recusado"|"pendente", obs:"" } ] }`
→ `{ ok:true, grupo, pessoas:[{id,nome,status,obs}], deuPresente }`.
Cada `id` precisa pertencer ao convite do token. Pode ser chamado de novo para
alterar. Não há campo de quantidade.

## 4. `presentesListar` — catálogo público
`GET ?action=presentesListar`
→ `{ ok:true, presentes:[ { id, titulo, descricao, valor, tipo, status } ] }`

- `tipo`: `"item"` (esgota) | `"livre"` (contribuição de qualquer valor).
- `status`: `"disponivel" | "reservado" | "esgotado"`.
- **Não** expõe quem pagou (isso é só do painel do casal).

## 5. `presenteReservar` — escolher item e gerar PIX
`POST { action:"presenteReservar", token, presenteId }`

Faz *soft-lock* (LockService), cria a cobrança PIX no Mercado Pago e devolve o
QR:
```
{ ok:true, pagamento:{ paymentId, qrCode, qrCodeBase64, copiaCola,
                        valor, expiraEm } }
```
Se já não estava disponível: `{ ok:false, erro:"presente_indisponivel" }`.

## 6. `contribuirLivre` — PIX de valor livre (ex.: lua de mel)
`POST { action:"contribuirLivre", token, valor:150, mensagem:"" }`
→ mesmo formato de `pagamento` do item 5. Nunca "esgota".

## 7. `pagamentoStatus` — o frontend faz polling até confirmar
`GET ?action=pagamentoStatus&paymentId=123`
→ `{ ok:true, status:"pendente"|"confirmado"|"expirado" }`.

## 8. `webhook` — **entrada do Mercado Pago** (não é chamada pelo frontend)
`POST` do Mercado Pago para a mesma Base URL. O backend:
1. lê o id do pagamento (query `data.id`/`id` ou corpo JSON);
2. **re-consulta** a API do MP (fonte da verdade, não confia no POST);
3. se aprovado, marca o presente `esgotado`, grava `pago_por` + `payment_id`.
Sempre responde `200` rápido. Uma **trigger por tempo** varre pendentes como
rede de segurança, caso um webhook se perca.

---

## Endpoints administrativos (rodados no editor do Apps Script, não via HTTP)
- `setupPlanilha()` — cria as abas `Convidados`, `Presentes`, `Config` com os
  cabeçalhos.
- `instalarTriggerPagamentos()` — instala a trigger por tempo do poll.
- `verificarPagamentosPendentes()` — o corpo do poll (também chamável à mão).
