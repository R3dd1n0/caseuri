# SETUP — como colocar no ar

Três blocos: **(A)** backend na planilha, **(B)** Mercado Pago, **(C)** site no
GitHub Pages. Nada aqui exige CNPJ. Faça na ordem.

---

## A. Backend (Google Sheets + Apps Script)

1. **Crie uma planilha** nova no Google Sheets (com a conta pessoal de vocês).
   Ela será o banco de dados **e** o painel de controle.
2. Menu **Extensões → Apps Script**. Abre o editor (script vinculado à planilha).
3. **Cole o código.** Escolha UM caminho:

   **Caminho fácil (um arquivo só — recomendado):**
   - No editor já existe um arquivo `Código.gs` com um `myFunction`.
   - Clique nele, selecione tudo (`Ctrl/Cmd+A`), apague, e **cole o conteúdo de
     `bundle/apps-script.gs`** (é o backend inteiro num arquivo). Salve (💾).
   - Só isso. Não precisa criar vários arquivos nem mexer no `appsscript.json`
     (o Apps Script pede as permissões sozinho ao rodar).

   **Caminho modular (vários arquivos):**
   - Use o `+` ao lado de *Files → Script* para criar cada arquivo. **Digite o
     nome SEM `.gs`** (ex.: `Planilha`) — a extensão é automática. Repita para
     `Codigo`, `Planilha`, `Identidade`, `Rsvp`, `Presentes`, `MercadoPago` e
     cole o conteúdo de cada `backend/*.gs`.

   **Caminho linha de comando:** `clasp push` apontando para `backend/`.
4. **Segredos (Script Properties) — cada um entra no seu momento.** Não é
   preciso ter todos agora; eles têm origens diferentes:
   | Propriedade | De onde vem | Quando criar |
   |---|---|---|
   | `TOKEN_SECRET` | **Você inventa** (frase aleatória longa; assina os tokens de sessão) | **Agora** |
   | `WEBHOOK_URL` | A URL do Web App — **só existe após o deploy** (passo 7) | Depois do deploy |
   | `MP_ACCESS_TOKEN` | Painel do Mercado Pago (Bloco B) | Ao configurar o MP |
   | `SHEET_ID` | opcional; só se o script não for vinculado à planilha | — |

   > Em ⚙️ *Project Settings → Script Properties → Add script property*.
   > Agora crie só o **`TOKEN_SECRET`**. Os outros dois você adiciona nos passos
   > 7 e no Bloco B. O código não quebra sem eles — só o PIX fica inativo até o
   > `MP_ACCESS_TOKEN` existir.
5. No editor, rode a função **`setupPlanilha`** uma vez (selecione no topo e
   ▶️ *Run*). Autorize os escopos quando pedir. Isso cria as abas
   `Convidados`, `Presentes`, `Pagamentos`, `Config` com exemplos.
   *(este passo não usa segredo algum.)*
6. **Publique o Web App:** *Deploy → New deployment → tipo Web app*:
   - *Execute as:* **Você (mesmo)**
   - *Who has access:* **Anyone** (necessário p/ o site e o webhook do MP)
   - Copie a **URL do Web App** (termina em `/exec`).
7. Cole essa URL na Script Property **`WEBHOOK_URL`** (é lida em tempo de
   execução; não precisa republicar).
8. Rode **`instalarTriggerPagamentos`** uma vez — instala a checagem de
   pagamentos a cada 5 min (rede de segurança do webhook).

> A cada mudança no código, faça *Deploy → Manage deployments → editar → nova
> versão* para publicar. A URL continua a mesma.

---

## B. Mercado Pago (pessoa física / CPF)

1. Tenha uma conta Mercado Pago pessoal (CPF).
2. Acesse **Mercado Pago Developers → Suas integrações → Criar aplicação**.
3. Pegue o **Access Token de produção** e cole na Script Property
   `MP_ACCESS_TOKEN`.
4. **Webhook:** o backend já manda `notification_url` em cada cobrança, então
   normalmente **não precisa** configurar nada no painel. Se quiser reforçar,
   em *Webhooks* aponte a mesma URL do Web App para o tópico **Pagamentos**.
5. ⚠️ **Taxas:** PIX de pessoa física é gratuito por regra do BC, **exceto**
   QR Code dinâmico e/ou +30 recebimentos/mês, onde pode haver tarifa.
   **Confirme as taxas atuais** na sua conta antes de divulgar a lista.

> Para testar sem gastar, use as credenciais de **teste** do MP e um usuário de
> teste; depois troque pelo token de produção.

---

## C. Site (GitHub Pages)

1. Edite **`site/config.js`** e coloque a URL do Web App em `BASE_URL`.
2. Faça commit/push na branch `main`.
3. No GitHub: **Settings → Pages → Source: GitHub Actions**. O workflow
   `.github/workflows/pages.yml` publica só a pasta `site/`.
4. A URL pública aparece na aba *Actions*/*Pages* (algo como
   `https://<usuario>.github.io/<repo>/`).

Pronto. Para testar localmente: `python3 -m http.server` dentro de `site/` e
abra `http://localhost:8000` (com o `BASE_URL` já apontando para o Web App).

---

## Conteúdo e dados (depois, sem mexer no código)
- **Textos/data/nomes:** `site/conteudo.js`. **Cores/fontes:** variáveis no topo
  de `site/assets/base.css`.
- **Convidados:** aba `Convidados` — lista **nominal, uma linha por pessoa**.
  Pessoas do mesmo convite compartilham o mesmo `convite_id` (uma confirma pelas
  outras). Acompanhantes também entram como linhas próprias; **não** há campo de
  quantidade. Ex.:
  | id | convite_id | grupo | nome |
  |----|-----------|-------|------|
  | p001 | c001 | Família Silva | Felipe Araujo Silva |
  | p002 | c001 | Família Silva | Mariana Souza Silva |
  > Se você já rodou o `setupPlanilha` numa versão anterior, o cabeçalho antigo
  > da aba `Convidados` ficou diferente. **Apague a aba `Convidados`** e rode
  > `setupPlanilha` de novo para recriá-la no formato novo.
- **Presentes:** aba `Presentes` (tipo `item` esgota; tipo `livre` é
  contribuição de qualquer valor).
- A **lista de convidados nunca vai para o GitHub** — vive só na planilha.
