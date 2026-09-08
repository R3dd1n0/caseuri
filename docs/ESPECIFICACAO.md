# Especificação — Site de Casamento

> Documento de planejamento. Nada foi implementado ainda. Serve para alinhar o
> escopo antes de escrever código.

## 1. Visão geral

Site que funciona como **hub para os convidados**: informações do evento,
direções, horário, dress code, confirmação de presença (RSVP) e lista de
presentes. Público pequeno (~50 convidados). Evento em **12/11/2026**.

Restrição forte do cliente: **nenhuma solução que exija pessoa jurídica / CNPJ.**
Tudo com conta de pessoa física (CPF).

## 2. Escopo

**Dentro do escopo:**
- Página única (single-page), mobile-first — todo convidado abre no celular.
- Portão de entrada por nome (ver §6) — identifica o convidado e barra estranhos.
- Seções de conteúdo fixo: história do casal (opcional), data + contagem
  regressiva, local, horário/cronograma, direções, dress code, informações
  gerais (estacionamento, presentes de crianças, etc.).
- **RSVP**: confirmar/desconfirmar presença, por convite/grupo, com nº de
  acompanhantes e campo opcional (restrição alimentar / recado).
- **Lista de presentes** com:
  - itens que **esgotam** quando pagos (sem duplicata);
  - **contribuição livre em dinheiro** (PIX de valor livre, ex.: lua de mel);
  - **confirmação automática via webhook** (Mercado Pago), sem honra;
  - **painel** para o casal ver quem pagou o quê (a própria planilha).
- Aviso **sutil e não agressivo** para quem ainda não escolheu presente.

**Fora do escopo (por ora):**
- App nativo, envio de e-mails automáticos, área de fotos pós-evento.
- Login/senha individual por convidado (decidido: overkill para 50 pessoas).

## 3. Decisões travadas

| Tema | Decisão |
|------|---------|
| Hospedagem (frontend) | **GitHub Pages** (grátis). Domínio próprio depois, se quiser. |
| Idioma | **Só português**. |
| RSVP | **Formulário nativo** no site (não Google Forms). |
| Presentes | **Itens que esgotam + PIX de valor livre.** |
| Confirmação de pagamento | **Webhook automático — Mercado Pago (pessoa física / CPF).** |
| Identidade | **Landing page pede o nome → cruza com a lista de convidados.** |
| Privacidade | O próprio cruzamento de nome é o portão (só convidado entra). |
| Sessão | Salva no dispositivo (localStorage); redigita se trocar de aparelho. |
| Sobrenome como 2º fator | Opcional, a definir. |

## 4. Arquitetura

O site é estático, mas **RSVP, presentes e webhook precisam de estado** — e o
GitHub Pages não guarda dados nem recebe webhook (POST). Por isso:

```
   Navegador do convidado
          │
          │  (site estático: HTML/CSS/JS)
          ▼
   GitHub Pages  ── carrega a página ──┐
                                       │  fetch / POST (identifica, RSVP,
                                       │  criar cobrança PIX, ler status)
                                       ▼
                             Google Apps Script  ◄── webhook (POST) ── Mercado Pago
                             (backend grátis,          (confirma pagamento)
                              conta pessoal)
                                       │
                                       ▼
                             Google Sheets = "banco de dados" + PAINEL do casal
```

- **Frontend**: GitHub Pages. Só HTML/CSS/JS. Nenhum segredo aqui.
- **Backend**: Google Apps Script (Web App), rodando na conta Google pessoal do
  casal. Grátis, sem CNPJ. Guarda os segredos (token do Mercado Pago), cria as
  cobranças PIX, recebe o webhook e escreve na planilha.
- **Dados / painel**: Google Sheets. É onde o casal vê tudo, num formato
  familiar (planilha), sem precisar de dashboard próprio.
- **Pagamento**: Mercado Pago (PSP), conta pessoa física. Gera QR Code PIX
  dinâmico por item e dispara webhook quando o pagamento cai.

## 5. Modelo de dados (abas da planilha)

**Aba `Convidados`** (você pré-carrega antes de publicar):

| coluna | descrição |
|--------|-----------|
| id | identificador do convite/grupo |
| nome_busca | nome(s) que o convidado pode digitar (normalizado p/ match) |
| grupo | rótulo do convite (ex.: "Felipe & Fulana") |
| max_acompanhantes | quantas pessoas esse convite pode confirmar |
| rsvp_status | pendente / confirmado / recusado |
| rsvp_qtd | quantos vão, de fato |
| rsvp_obs | restrição alimentar / recado |
| deu_presente | sim / não (para o aviso não agressivo) |

**Aba `Presentes`**:

| coluna | descrição |
|--------|-----------|
| id | id do presente |
| titulo | nome do presente |
| descricao | texto curto |
| valor | valor em R$ (para itens; vazio se for "valor livre") |
| tipo | `item` (esgota) / `livre` (contribuição de qualquer valor) |
| status | disponível / reservado / esgotado |
| pago_por | nome do convidado que pagou |
| payment_id | id do pagamento no Mercado Pago |
| data_pgto | quando confirmou |
| reservado_em | timestamp do soft-lock (para liberar se não pagar) |

**Aba `Config`**: chave PIX, textos, data/hora do evento, endereço, links de mapa, etc.

## 6. Fluxo de identidade (landing page)

1. Convidado abre o link (o mesmo para todos, vai no convite).
2. Landing pede: **"Digite seu nome para entrar."** (campo de texto livre).
3. Frontend envia o nome ao Apps Script; ele **normaliza** (minúsculas, sem
   acento) e procura na aba `Convidados`. A lista **nunca** é exposta ao
   navegador.
4. Bate → devolve um token/id do convite; frontend salva no localStorage e
   libera o site. (Opcional: pedir sobrenome para confirmar.)
5. Não bate → mensagem gentil ("não achamos seu nome, confira ou fale com os
   noivos"). Estranho não entra.
6. Próximas visitas no mesmo aparelho: entra direto (sessão salva).

## 7. Fluxo de RSVP

1. Já identificado, o convidado vê seu grupo ("Felipe & Fulana — até 2 pessoas").
2. Escolhe **confirmar** ou **recusar**; se confirmar, informa quantos vão e um
   recado/restrição opcional.
3. POST para o Apps Script → grava em `Convidados`. Pode alterar depois
   (reabre e muda a resposta).

## 8. Fluxo de presentes (com webhook)

**Item que esgota:**
1. Convidado escolhe um item disponível.
2. Frontend chama o Apps Script → ele marca o item como **`reservado`**
   (soft-lock, some para os outros) e pede ao Mercado Pago uma **cobrança PIX
   dinâmica** no valor do item, amarrada ao item + convidado.
3. Mercado Pago devolve o **QR Code + código copia-e-cola**; o site mostra.
4. Convidado paga no app do banco dele.
5. Mercado Pago dispara **webhook** → Apps Script confere o pagamento
   (re-consultando a API, sem confiar cegamente no POST) → marca **`esgotado`**,
   grava `pago_por` e `payment_id`.
6. Se ninguém pagar em X minutos, o soft-lock expira e o item volta a
   **`disponível`**.

**Contribuição livre (lua de mel):**
- Igual, mas o convidado digita o valor; nunca "esgota" (vários podem contribuir).

**Aviso não agressivo:**
- Como o site sabe quem é o convidado, se `deu_presente = não`, mostra **uma
  linha discreta e calorosa** ("sem pressa 💛"), que vira um "obrigado!" depois.
  Nada de pop-up repetido, badge vermelho ou cobrança.

## 9. Seções do site (rascunho)

1. Capa: nomes, data, contagem regressiva.
2. História do casal (opcional).
3. Quando & onde: data, horário, cronograma.
4. Como chegar: mapa + botões "abrir no Google Maps / Waze".
5. Dress code.
6. Informações gerais (estacionamento, crianças, etc.).
7. Confirmação de presença (RSVP).
8. Lista de presentes (itens + contribuição livre).
9. Recados / contato dos noivos.

## 10. Riscos e limites (honestidade)

- **Segurança é "leve".** Nomes não são segredo; alguém que conheça o nome de um
  convidado poderia entrar como ele. Para 50 conhecidos, é aceitável. O
  sobrenome como 2º fator endurece um pouco, se quiser.
- **Taxas do Mercado Pago.** PIX de pessoa física é gratuito por regra do BC,
  **exceto** justamente QR Code dinâmico e/ou mais de ~30 recebimentos/mês —
  onde pode haver tarifa. Com ~50 convidados, é provável cair nesse caso.
  **Ação:** confirmar as taxas atuais do Mercado Pago para PF **antes** de
  implementar essa parte (as tarifas mudam; vale checar na fonte).
- **Webhook precisa de endpoint público.** O Apps Script é publicado como Web
  App acessível; a robustez vem de **sempre re-consultar** o pagamento na API do
  Mercado Pago (não confiar só no POST).
- **Cotas Apps Script / Sheets**: folgadas para esta escala.
- **localStorage é por dispositivo**: trocar de aparelho = redigitar o nome (ok).

## 11. Sequência de implementação (proposta)

1. Esqueleto do site estático (todas as seções de conteúdo fixo) + landing de
   nome com dados mockados — dá pra ver e ajustar o visual sem backend.
2. Backend Apps Script + planilha: identidade e RSVP funcionando ponta a ponta.
3. Presentes — modo "honra + confirmação manual" primeiro (funciona sem PSP).
4. Integração Mercado Pago: cobrança PIX dinâmica + webhook + esgotar automático
   (depois de confirmar as taxas).
5. Contribuição livre (lua de mel).
6. Aviso não agressivo + polimento + acessibilidade.
7. (Opcional) domínio próprio `.com.br` via registro.br (CPF).

## 12. Pontos em aberto para o cliente decidir

- [ ] Usar sobrenome como 2º fator na landing? (sim / não)
- [ ] Vai querer domínio próprio depois, ou fica no `github.io`?
- [ ] Quais itens/valores entram na lista de presentes? (definir a lista real)
- [ ] Textos: história do casal, dress code, cronograma, endereço exato.
- [ ] Chave PIX (ou conta Mercado Pago) que vai receber.
- [ ] Confirmar as taxas atuais do Mercado Pago PF antes de codar essa etapa.
