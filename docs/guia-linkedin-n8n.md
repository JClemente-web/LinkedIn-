# Guia: Automação de LinkedIn com n8n

Este guia descreve uma automação em três partes para o LinkedIn usando n8n, integrada com as ferramentas que você já usa (Notion, Todoist e, opcionalmente, Monday.com):

1. **Publicação automática** — mantém seu perfil ativo publicando conteúdo agendado a partir de um banco de dados do Notion.
2. **Radar de vagas** — coleta vagas do LinkedIn diariamente (via Apify), remove duplicadas, pontua cada vaga com IA comparando com o seu perfil e salva as melhores no Notion.
3. **Assistente de aplicação** — para as vagas aprovadas, gera carta de apresentação personalizada com IA e cria uma tarefa no Todoist com tudo pronto para você aplicar em 1 clique.

Os três workflows estão na pasta [`workflows/`](../workflows/) e podem ser importados diretamente no n8n (**Workflows → Import from File**).

---

## Aviso importante sobre "aplicar automaticamente"

O LinkedIn **proíbe bots que clicam em "Candidatura simplificada" (Easy Apply)** nos Termos de Serviço. Ferramentas que fazem isso usam automação de navegador com sua sessão logada e podem causar **restrição ou banimento permanente da sua conta**.

Por isso, a arquitetura recomendada (e implementada aqui) é **human-in-the-loop**:

- A automação faz 95% do trabalho: encontra, filtra, pontua, resume e prepara a carta de apresentação.
- **Você** faz o clique final de "Aplicar" — a partir de uma tarefa no Todoist que já contém o link direto da vaga, o resumo e a carta pronta.

Isso mantém sua conta segura e, na prática, é mais eficaz: aplicações revisadas por humanos convertem melhor que envios em massa.

---

## Arquitetura geral

```
┌─────────────────────────────────────────────────────────────┐
│ WORKFLOW 1 · Publicação automática (3x por semana)          │
│                                                             │
│ Schedule ──► Notion (posts "Pronto") ──► IA (refina texto)  │
│          ──► LinkedIn (publica) ──► Notion (marca publicado)│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ WORKFLOW 2 · Radar de vagas (diário)                        │
│                                                             │
│ Schedule ──► Apify (scraper de vagas) ──► Remove duplicadas │
│          ──► Filtro por título ──► IA (score 0–10 vs. CV)   │
│          ──► IF score ≥ 7 ──► Notion (Radar de Vagas)       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ WORKFLOW 3 · Assistente de aplicação (a cada 2 horas)       │
│                                                             │
│ Schedule ──► Notion (vagas marcadas "Aplicar")              │
│          ──► IA (carta de apresentação personalizada)       │
│          ──► Notion (salva carta) ──► Todoist (tarefa com   │
│              link da vaga + carta, prazo hoje)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Pré-requisitos

### 1. n8n atualizado (≥ 2.18.0)

O LinkedIn desativou a versão de API `202504` em abril de 2026, o que quebrou o node nativo do LinkedIn em versões antigas do n8n (erro HTTP 426 / "version is not active"). A correção saiu no **n8n 2.18.0**, que envia o header `LinkedIn-Version: 202604`. Se você usa n8n self-hosted, atualize antes de começar. No n8n Cloud já está resolvido.

### 2. App no LinkedIn Developer Portal (para o Workflow 1)

1. Acesse [developer.linkedin.com](https://developer.linkedin.com) e crie um app (precisa vincular a uma Company Page — pode ser uma página vazia criada por você).
2. Na aba **Products**, adicione **"Share on LinkedIn"** e **"Sign In with LinkedIn using OpenID Connect"**. Aguarde o status ficar **"Added"** (verde) — se estiver "Pending", chamadas retornam 403.
3. Na aba **Auth**, copie o **Client ID** e o **Client Secret**, e cadastre a redirect URL do n8n:
   - n8n Cloud: `https://SEU-SUBDOMINIO.n8n.cloud/rest/oauth2-credential/callback`
   - Self-hosted: `https://SEU-DOMINIO/rest/oauth2-credential/callback`
4. No n8n: **Credentials → New → LinkedIn OAuth2 API**, cole Client ID/Secret.
5. **Desligue o toggle "Organization Support"** (você vai postar como perfil pessoal, não como página). Com ele ligado, o LinkedIn bloqueia perfis pessoais.
6. Conclua o fluxo OAuth. O escopo essencial é `w_member_social` (publicar como membro).

> Se mudar escopos depois, **delete e recrie a credencial** — só salvar não força o LinkedIn a pedir as permissões novas.

### 3. Conta na Apify (para o Workflow 2)

O LinkedIn não oferece API pública de busca de vagas, então usamos um scraper hospedado na Apify (que roda sem login e sem cookies — não toca na sua conta):

1. Crie uma conta em [apify.com](https://apify.com) (o plano gratuito dá ~US$ 5/mês de créditos, suficiente para rodadas diárias moderadas).
2. Em **Settings → API & Integrations**, crie um **API token**.
3. Actor recomendado: [`k1ra/linkedin-jobs-scraper`](https://apify.com/k1ra/linkedin-jobs-scraper) (sem login, retorna descrição completa, salário, senioridade e link de aplicação). Alternativas: `fetchclub/linkedin-jobs-scraper`, `patrickvicente/linkedin-job-scraper`.
4. No n8n, o workflow 2 chama a Apify via node HTTP Request usando o endpoint `run-sync-get-dataset-items` (sem precisar instalar node comunitário). Crie uma credencial **Header Auth** com nome `Authorization` e valor `Bearer SEU_TOKEN_APIFY`.

### 4. Notion

Crie dois bancos de dados e conecte a integração do n8n a eles (menu ••• → Connections → sua integração n8n):

**a) "Fila de Posts LinkedIn"** — alimenta o Workflow 1:

| Propriedade | Tipo | Valores |
|---|---|---|
| Título | Title | tema do post |
| Rascunho | Text | texto bruto/ideias do post |
| Status | Select | `Ideia`, `Pronto`, `Publicado` |
| Publicado em | Date | preenchido pelo workflow |

**b) "Radar de Vagas"** — alimentado pelo Workflow 2 e lido pelo Workflow 3:

| Propriedade | Tipo | Valores |
|---|---|---|
| Vaga | Title | título da vaga |
| Empresa | Text | |
| Localização | Text | |
| Link | URL | link de aplicação |
| Score | Number | 0–10 dado pela IA |
| Análise | Text | justificativa da IA |
| Status | Select | `Novo`, `Aplicar`, `Aplicado`, `Descartado` |
| Carta | Text | carta gerada pelo Workflow 3 |

### 5. Todoist

Crie uma credencial Todoist no n8n (API token em Todoist → Settings → Integrations → Developer) e um projeto chamado **"Vagas"**.

### 6. OpenAI (ou outro LLM)

Crie uma credencial OpenAI no n8n. Os workflows usam `gpt-4o-mini` (barato e suficiente); troque pelo modelo que preferir. Se preferir Anthropic/Gemini, basta trocar o node de chat model.

---

## Workflow 1 — Publicação automática no LinkedIn

**Arquivo:** [`workflows/1-linkedin-auto-post.json`](../workflows/1-linkedin-auto-post.json)

**O que faz:** segunda/quarta/sexta às 9h, busca no Notion o post mais antigo com Status = `Pronto`, pede à IA para refinar o rascunho no seu tom de voz (com ganchos, parágrafos curtos e hashtags), publica no LinkedIn e marca a página como `Publicado`.

**Fluxo de trabalho no dia a dia:** você só alimenta o banco do Notion com ideias e rascunhos; quando um post estiver bom, muda o Status para `Pronto`. O resto é automático.

**Ajustes após importar:**
- Selecione suas credenciais (Notion, OpenAI, LinkedIn) em cada node.
- No node "Buscar post pronto", selecione o banco "Fila de Posts LinkedIn".
- No node "Refinar post com IA", edite o prompt de sistema com seu tom de voz, área de atuação e exemplos de posts seus.
- No node LinkedIn, selecione sua pessoa (Person) autenticada.

**Dica de alcance:** posts com imagem têm ~2x mais engajamento. Depois que o fluxo básico estiver rodando, dá para adicionar upload de imagem via HTTP Request na [Images API](https://learn.microsoft.com/linkedin/marketing/integrations/community-management/shares/images-api) do LinkedIn.

---

## Workflow 2 — Radar de vagas com score por IA

**Arquivo:** [`workflows/2-linkedin-job-radar.json`](../workflows/2-linkedin-job-radar.json)

**O que faz:** todo dia às 8h:
1. Roda o scraper da Apify com suas palavras-chave e localização.
2. Remove vagas já vistas em execuções anteriores (dedupe persistente pelo link).
3. Filtra por palavras-chave no título (ajuste à sua área).
4. Envia título + empresa + descrição para a IA junto com o **seu miniperfil** (embutido no prompt) e recebe um JSON com `score` (0–10), `justificativa` e `pontos_de_atencao`.
5. Vagas com score ≥ 7 viram páginas no banco "Radar de Vagas" do Notion com Status = `Novo`.

**Ajustes após importar:**
- No node "Buscar vagas (Apify)": edite o JSON de input com suas `keywords`, `location` e limite de vagas. Selecione a credencial Header Auth da Apify.
- No node "Filtrar por título": troque as palavras-chave de exemplo pelas da sua área.
- No node "Pontuar com IA": **substitua o bloco `PERFIL DO CANDIDATO` no prompt pelo seu resumo profissional real** (stack, senioridade, pretensão, preferência remoto/híbrido, idiomas). Quanto melhor o perfil, melhor o score.
- No node do Notion, selecione o banco "Radar de Vagas".

**Custo estimado:** com 50 vagas/dia, o actor da Apify consome centavos por execução e o `gpt-4o-mini` custa menos de US$ 0,01/dia.

---

## Workflow 3 — Assistente de aplicação

**Arquivo:** [`workflows/3-linkedin-application-assistant.json`](../workflows/3-linkedin-application-assistant.json)

**O que faz:** a cada 2 horas, busca no Notion vagas com Status = `Aplicar` (as que você aprovou manualmente no radar):
1. A IA escreve uma carta de apresentação curta e personalizada (em PT ou EN conforme o idioma da vaga), usando a análise de fit do Workflow 2.
2. Salva a carta na própria página do Notion e muda o Status para `Aplicado` (ou seja, "encaminhado para aplicação").
3. Cria uma tarefa no Todoist no projeto "Vagas", com prazo hoje, contendo: link direto da vaga, resumo e a carta — pronto para copiar/colar e aplicar em 1 clique.

**Seu ritual diário fica assim:**
1. De manhã, abra o "Radar de Vagas" no Notion e mude para `Aplicar` as vagas que valem a pena (2 min).
2. Ao longo do dia, as tarefas aparecem no Todoist com tudo mastigado.
3. Clique no link, cole a carta, aplique, conclua a tarefa.

**Ajustes após importar:** selecione credenciais (Notion, OpenAI, Todoist), o banco "Radar de Vagas" e o projeto "Vagas" no Todoist. No prompt da carta, preencha o bloco `SOBRE MIM` com sua experiência real.

---

## Ideias para evoluir depois

- **Notificação no Telegram/WhatsApp** com o resumo diário das melhores vagas (node Telegram é o mais simples no n8n).
- **Monday.com como pipeline de candidaturas**: espelhar o Radar de Vagas num board com colunas `Aplicado → Entrevista → Proposta`, usando o node Monday.com do n8n.
- **Comentários estratégicos**: um workflow que busca posts de pessoas-chave da sua área (via Apify) e sugere comentários por IA para você revisar — comentar bem gera mais visibilidade que postar.
- **Adaptação de currículo por vaga**: a IA sugere quais bullets do seu CV enfatizar para cada vaga aprovada, salvando no Notion junto da carta.
- **Métricas**: uma vez por semana, registrar nº de aplicações, respostas e entrevistas num banco do Notion para medir taxa de conversão e ajustar keywords do radar.
- **Outras fontes de vagas**: os mesmos workflows funcionam para Gupy, Indeed e Remotive (a Remotive tem [API pública gratuita](https://remotive.com/api/remote-jobs), sem scraper).

## Solução de problemas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| HTTP 426 "version is not active" ao postar | n8n < 2.18.0 com header antigo | Atualize o n8n, ou use HTTP Request com header `LinkedIn-Version: 202604` |
| 403 ao postar no LinkedIn | Produto "Share on LinkedIn" pendente, ou toggle Organization Support ligado, ou escopo faltando | Confira Products = Added; desligue Organization Support; recrie a credencial |
| OAuth do LinkedIn falha | Redirect URL diferente da cadastrada | A URL no Developer Portal deve ser idêntica (sem barra final) |
| Apify retorna vazio | Keywords/location sem resultados ou actor pausado | Teste o input direto no console da Apify primeiro |
| Vagas duplicadas no Notion | Node "Remove Duplicates" resetado | Ele guarda histórico por workflow; não delete/recrie o node sem necessidade |
