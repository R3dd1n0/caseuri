# Álbum colaborativo — Felipe & Mariana (ETAPA 2: MVP de upload)

Convidado aponta a câmera → abre `felipemariana.com.br/fotos` → escolhe fotos/vídeos →
sobem **direto para o seu Google Drive**. O Apps Script é só a camada de controle
(valida, limita, cria a sessão de upload, registra no Sheets). Os bytes **não**
passam pelo Apps Script.

```
site/fotos/            frontend (vai pro ar em /fotos pelo mesmo GitHub Pages)
  index.html
  fotos.css
  fotos.js
  fotos-config.js      <- cole aqui a URL do Web App do álbum
backend-fotos/         código do Apps Script do álbum (fonte, para versionar)
  Codigo.gs            backend inteiro num arquivo só
  appsscript.json      manifesto (scopes)
```

---

## 1) Google Drive — criar as pastas

1. No Drive da **sua conta** (a mesma do site), crie a pasta **CASAMENTO FELIPE E MARIANA**.
2. Dentro dela, crie: **FOTOS**, **VIDEOS**, **OUTROS**.
3. Pegue o **ID de cada pasta**: abra a pasta e copie o trecho final da URL:
   `https://drive.google.com/drive/folders/`**`1AbC...xyz`** ← esse é o ID.
   Anote os 3 IDs (FOTOS, VIDEOS, OUTROS).

> Não compartilhe essas pastas publicamente. O convidado nunca acessa o Drive —
> ele só recebe uma URL de upload de uso único por arquivo.

## 2) Google Sheets — planilha de log

1. Crie uma planilha nova (ex.: **Álbum Felipe e Mariana**).
2. Copie o **ID** da URL: `https://docs.google.com/spreadsheets/d/`**`1Xyz...`**`/edit`.
   (A aba `Uploads` é criada sozinha no passo 4.)

## 3) Apps Script — criar o projeto

1. Vá em https://script.google.com → **Novo projeto**.
2. No arquivo `Código.gs` que já vem aberto, apague tudo e cole o conteúdo de
   `backend-fotos/Codigo.gs` (é o backend inteiro num arquivo só).
3. Clique na engrenagem **Configurações do projeto** → marque **“Mostrar arquivo appsscript.json”**.
   Abra `appsscript.json` e substitua pelo conteúdo de `backend-fotos/appsscript.json`.

## 4) Configurar (Script Properties) e preparar a planilha

1. **Configurações do projeto → Propriedades do script → Adicionar propriedade.** Crie:

   | Propriedade | Valor |
   |---|---|
   | `SHEET_ID` | id da planilha (passo 2) |
   | `FOLDER_FOTOS` | id da pasta FOTOS |
   | `FOLDER_VIDEOS` | id da pasta VIDEOS |
   | `FOLDER_OUTROS` | id da pasta OUTROS |
   | `TICKET_SECRET` | uma string aleatória (ver abaixo) |
   | `UPLOADS_ATIVOS` | `sim` |

2. **Gerar o `TICKET_SECRET`:** no editor, selecione a função `gerarSegredo` → **Executar** →
   copie o valor do **Registro de execução** e cole na propriedade `TICKET_SECRET`.
3. **Preparar a planilha:** selecione a função `setupAlbum` → **Executar**.
   Na primeira execução o Google vai pedir **autorização** — aceite com a sua conta
   (é o seu próprio script acessando o seu Drive/Sheets).

## 4b) Ativar a Drive API no projeto Cloud (passo obrigatório)

O backend fala com o Drive pela API REST (necessário para o upload resumível), e
essa API precisa estar **ativada** no projeto Google Cloud do seu Apps Script.
Se faltar, o upload falha com `403 — Google Drive API has not been used... or it is disabled`.

1. No Apps Script: **Configurações do projeto → Projeto do Google Cloud Platform** —
   anote o **número do projeto** (ex.: `872612344345`).
2. Abra: `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=NUMERO`
   (troque `NUMERO`). Logado na **mesma conta**.
3. Clique em **Ativar** e aguarde 1–2 minutos.
4. Teste rodando a função `testarDrive` no editor → deve logar `Drive HTTP 200`.

## 5) Deploy como Web App

1. **Implantar → Nova implantação →** tipo **App da Web**.
2. Configure:
   - **Executar como:** *Eu (sua conta)*
   - **Quem pode acessar:** *Qualquer pessoa*
3. **Implantar** → copie a **URL do app da Web** (termina em `/exec`).
4. Cole essa URL em `site/fotos/fotos-config.js` no campo `BASE_URL`.

> A cada alteração no código do Apps Script, faça **Implantar → Gerenciar implantações →
> editar (lápis) → Versão: Nova versão → Implantar**. Se criar uma implantação nova do
> zero, a URL muda e você precisa atualizar o `fotos-config.js`.

## 6) IDs das pastas — resumo

Os IDs ficam **só no Apps Script** (Script Properties), nunca no frontend. O frontend
conhece apenas a URL do Web App. Assim a estrutura do seu Drive não é exposta.

## 7) Deploy do frontend (GitHub Pages)

O site já publica a pasta `site/` em `felipemariana.com.br`. Ao enviar `site/fotos/`
para a branch `main`, ele aparece em **`felipemariana.com.br/fotos`** automaticamente
(workflow “Deploy site (GitHub Pages)”). Confirme antes que o `fotos-config.js` está
com a URL `/exec` correta.

## 8) Domínio

Nada a fazer: é o mesmo domínio do site, no caminho `/fotos`. Sem subdomínio, sem DNS novo.

## 9) QR Code

Gere um QR apontando para `https://felipemariana.com.br/fotos`:
- Google Chrome: abra a página → menu **⋮ → Transmitir, salvar e compartilhar → Criar código QR**.
- Ou qualquer gerador confiável (ex.: o próprio buscador “gerar QR code”), colando a URL.
Imprima em tamanho bom (≥ 4 cm) e teste apontando a câmera antes da festa.

## 10) Testar localmente (Claude Code)

```bash
cd site/fotos
python3 -m http.server 8099
# abra http://localhost:8099 no navegador
```
O upload real exige a URL `/exec` já preenchida no `fotos-config.js` (o Drive/Sheets
são sempre os de verdade — não há emulação local do Apps Script).

## 11) Testar o upload real

1. Abra a página (local ou já no ar).
2. (Opcional) digite um nome. Toque em **Adicionar fotos e vídeos** e escolha alguns.
3. Acompanhe as barras de progresso; ao fim aparece “enviado ✓”.
4. Confira: os arquivos aparecem nas pastas **FOTOS/VIDEOS** do Drive e uma linha por
   arquivo na aba **Uploads** da planilha (status `concluido`, com `drive_file_id`).
5. Teste um **vídeo grande** (ex.: 100–300 MB) para validar o caminho resumível.

## 12) Erros mais prováveis e como resolver

| Sintoma | Causa provável | Solução |
|---|---|---|
| “Configuração pendente” | `fotos-config.js` sem a URL | Cole a URL `/exec` |
| Botão fica “Preparando…” e não libera | Web App não acessível / `ticket` falhou | Confira o deploy (**Qualquer pessoa**) e a URL `/exec` |
| `ticket_invalido` | `TICKET_SECRET` ausente/trocado | Defina a propriedade e **republique nova versão** |
| `arquivo_grande` | passou do limite (50 MB foto / 300 MB vídeo) | Ajuste os limites no topo de `Album.gs` e republique |
| `Pasta nao configurada` | falta `FOLDER_*` nas propriedades | Preencha os 3 IDs |
| Falha logo no primeiro envio (interno) | autorização do Drive não concedida | Rode `setupAlbum` uma vez e aceite as permissões |
| `uploads_desativados` | `UPLOADS_ATIVOS = nao` | Troque para `sim` (ou use `nao` para desligar após a festa) |
| PUT falha (status 0/CORS) | URL de sessão expirada ou rede caiu | Use **“tentar de novo”**; o resto da fila não é afetado |
| HEIC não abre depois | navegador não renderiza HEIC | Normal — o arquivo está salvo; exibição fica para a galeria (Etapa 5) |

---

### Limites embutidos (ajustáveis em `Album.gs`)
- Foto: **50 MB** · Vídeo: **300 MB** · Outros: 50 MB
- **60 arquivos por ticket** a cada **60 min** (anti-abuso)
- Tipos: JPG/JPEG/PNG/WEBP/HEIC/HEIF e MP4/MOV/3GP (demais caem em OUTROS)
- Interruptor geral: Script Property `UPLOADS_ATIVOS = nao` desliga os envios.
