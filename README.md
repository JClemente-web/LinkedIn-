# LinkedIn + n8n — Automação de perfil e busca de vagas

Automação em três workflows n8n para manter o LinkedIn ativo e acelerar a busca de vagas, integrada com Notion e Todoist:

| # | Workflow | O que faz | Frequência |
|---|---|---|---|
| 1 | [`workflows/1-linkedin-auto-post.json`](workflows/1-linkedin-auto-post.json) | Publica posts no LinkedIn a partir de uma fila no Notion, refinados por IA | Seg/Qua/Sex 9h |
| 2 | [`workflows/2-linkedin-job-radar.json`](workflows/2-linkedin-job-radar.json) | Coleta vagas do LinkedIn (Apify), pontua com IA vs. seu perfil e salva as melhores no Notion | Diário 8h |
| 3 | [`workflows/3-linkedin-application-assistant.json`](workflows/3-linkedin-application-assistant.json) | Para vagas aprovadas, gera carta de apresentação por IA e cria tarefa no Todoist pronta para aplicar | A cada 2h |

## Como começar

### Opção A — Docker (recomendado): n8n já sobe com os workflows dentro

Requer apenas [Docker](https://docs.docker.com/get-docker/) instalado (funciona em qualquer VPS, servidor ou máquina local):

```bash
git clone https://github.com/JClemente-web/LinkedIn-.git
cd LinkedIn-

# Crie o .env com a chave de criptografia das credenciais
cp .env.example .env
# edite o .env e cole em N8N_ENCRYPTION_KEY o resultado de:  openssl rand -hex 24

docker compose up -d
```

Abra **http://localhost:5678**, crie sua conta de administrador (primeiro acesso) e pronto: os 3 workflows já estarão lá, importados automaticamente. A importação roda só na primeira inicialização — restarts não criam duplicatas.

> Testado com n8n 2.29.10. Guarde bem o `N8N_ENCRYPTION_KEY`: sem ele, as credenciais salvas ficam ilegíveis.

### Opção B — n8n já instalado via npm/Node.js (localhost:5678)

Se você já roda o n8n na sua máquina com Node.js:

1. **Confira a versão** (precisa ser ≥ 2.18.0 por causa da API do LinkedIn):

```bash
n8n --version
# se estiver antiga:
npm update -g n8n
```

2. **Baixe os workflows**: clone o repositório (`git clone https://github.com/JClemente-web/LinkedIn-.git`) ou baixe o ZIP no GitHub (botão verde **Code → Download ZIP**).

3. **Importe** — do jeito mais simples, pela interface: abra http://localhost:5678, e em **Workflows → ⋮ (três pontinhos) → Import from File**, selecione um a um os 3 arquivos da pasta `workflows/`. Ou, se preferir terminal (com o n8n parado):

```bash
n8n import:workflow --separate --input=caminho/para/LinkedIn-/workflows
```

4. **Fuso horário dos agendamentos**: dentro de cada workflow, abra **Settings (⋮ no canto) → Timezone** e escolha `America/Sao_Paulo`, senão os horários (8h, 9h) rodam em UTC.

**Avisos específicos do n8n local:**

- Os agendamentos só disparam **enquanto o n8n estiver rodando** — se você fechar o terminal ou desligar o PC, nada roda. Deixe o n8n aberto nos horários dos gatilhos, ou rode os workflows manualmente, ou configure o n8n para iniciar com o sistema.
- Se o LinkedIn recusar o callback OAuth em `http://localhost:5678` na hora de conectar a credencial, inicie o n8n com `n8n start --tunnel` — isso gera uma URL https temporária que o LinkedIn aceita como redirect. As demais credenciais (Notion, Todoist, OpenAI, Apify) usam token/API key e funcionam normalmente no localhost.

### Opção C — n8n Cloud (sem instalar nada)

1. Crie uma conta em [n8n.io](https://n8n.io).
2. Importe cada JSON da pasta [`workflows/`](workflows/) em **Workflows → Import from File**.

### Antes de importar: perfil já preenchido

Os 3 workflows já vêm com os dados de **João Vítor Clemente Ferreira** (Rio de Janeiro/RJ). Se precisar atualizar algo (ex.: quando o IRATA Nível 1 sair ou o curso de caldeireiro terminar), rode:

```bash
# opcional — só se quiser reescrever os dados
node preencher-perfil.js
```

> Se estiver usando a Opção A (Docker), o n8n já sobe com os workflows preenchidos.

### Depois de logar (todas as opções)

1. Siga a seção **Pré-requisitos** do **[guia completo](docs/guia-linkedin-n8n.md)** para conectar as credenciais (LinkedIn OAuth, Notion, Todoist, OpenAI, Apify) — esse passo é sempre manual porque exige login nas suas contas.
2. Rode cada workflow manualmente uma vez para testar e depois ative os agendamentos (toggle **Active**).

## Estratégia de carreira

- Análise do seu LinkedIn (o que está forte, o que está desalinhado e o que mudar): **[docs/analise-linkedin.md](docs/analise-linkedin.md)**
- Plano das trilhas (BI · RH · campo · TI): **[docs/estrategia-carreira.md](docs/estrategia-carreira.md)**

> **Importante:** aplicar automaticamente (bot clicando em "Easy Apply") viola os Termos do LinkedIn e arrisca banimento. A arquitetura aqui é *human-in-the-loop*: a automação encontra, filtra, pontua e prepara a carta — o clique final de aplicar é seu. Detalhes no guia.
