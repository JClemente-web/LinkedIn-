# LinkedIn + n8n — Automação de perfil e busca de vagas

Automação em três workflows n8n para manter o LinkedIn ativo e acelerar a busca de vagas, integrada com Notion e Todoist:

| # | Workflow | O que faz | Frequência |
|---|---|---|---|
| 1 | [`workflows/1-linkedin-auto-post.json`](workflows/1-linkedin-auto-post.json) | Publica posts no LinkedIn a partir de uma fila no Notion, refinados por IA | Seg/Qua/Sex 9h |
| 2 | [`workflows/2-linkedin-job-radar.json`](workflows/2-linkedin-job-radar.json) | Coleta vagas do LinkedIn (Apify), pontua com IA vs. seu perfil e salva as melhores no Notion | Diário 8h |
| 3 | [`workflows/3-linkedin-application-assistant.json`](workflows/3-linkedin-application-assistant.json) | Para vagas aprovadas, gera carta de apresentação por IA e cria tarefa no Todoist pronta para aplicar | A cada 2h |

## Como começar

1. Leia o **[guia completo](docs/guia-linkedin-n8n.md)** — inclui pré-requisitos (app no LinkedIn Developer Portal, token da Apify, bancos do Notion, Todoist), instruções de configuração passo a passo, ideias de evolução e solução de problemas.
2. Importe cada JSON no n8n em **Workflows → Import from File**.
3. Selecione suas credenciais nos nodes e edite os blocos marcados com `EDITE ESTE BLOCO` nos prompts de IA (seu perfil, stack e tom de voz).

> **Importante:** aplicar automaticamente (bot clicando em "Easy Apply") viola os Termos do LinkedIn e arrisca banimento. A arquitetura aqui é *human-in-the-loop*: a automação encontra, filtra, pontua e prepara a carta — o clique final de aplicar é seu. Detalhes no guia.
