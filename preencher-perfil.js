#!/usr/bin/env node
/*
 * Preenche seus dados pessoais nos 3 workflows de uma vez.
 *
 * Uso:  node preencher-perfil.js
 *
 * O script faz as perguntas, grava as respostas nos arquivos da pasta
 * workflows/ e cria um backup (.bak) de cada um. Depois é só importar
 * os JSONs no n8n. Pode rodar de novo quando quiser atualizar algo.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const PERGUNTAS = [
  {
    token: "__NOME__",
    pergunta: "Seu nome completo",
    exemplo: "ex.: João Clemente",
  },
  {
    token: "__CIDADE_UF__",
    pergunta: "Sua cidade e estado",
    exemplo: "ex.: Macaé/RJ",
  },
  {
    token: "__CONTATO__",
    pergunta: "Telefone e/ou e-mail para contato",
    exemplo: "ex.: (22) 99999-9999 · joao@email.com",
  },
  {
    token: "__CALDEIRARIA__",
    pergunta: "Sua experiência como caldeireiro (tempo e tipos de obra)",
    exemplo: "ex.: 6 anos — montagem industrial, naval e paradas de manutenção",
  },
  {
    token: "__IRATA__",
    pergunta: "Seu IRATA (nível e validade)",
    exemplo: "ex.: Nível 1, válido até 03/2028 — ou: em processo de certificação",
  },
  {
    token: "__PROGRAMACAO__",
    pergunta: "Sua experiência com programação/automação",
    exemplo:
      "ex.: autodidata — automações com n8n, integração de APIs e IA (Enter aceita esse texto)",
    padrao:
      "autodidata — montou automações com n8n, integrações de API e IA",
  },
];

const PASTA_WORKFLOWS = path.join(__dirname, "workflows");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const perguntar = (texto) => new Promise((resolve) => rl.question(texto, resolve));

async function main() {
  console.log("\n=== Preenchimento do perfil nos workflows ===\n");

  const respostas = {};
  for (const p of PERGUNTAS) {
    let resposta = "";
    while (!resposta) {
      resposta = (await perguntar(`${p.pergunta} (${p.exemplo}):\n> `)).trim();
      if (!resposta && p.padrao) resposta = p.padrao;
      if (!resposta) console.log("  Esse campo é importante — preencha, por favor.\n");
    }
    respostas[p.token] = resposta;
    console.log("");
  }
  rl.close();

  const arquivos = fs
    .readdirSync(PASTA_WORKFLOWS)
    .filter((f) => f.endsWith(".json"));

  for (const nome of arquivos) {
    const arquivo = path.join(PASTA_WORKFLOWS, nome);
    let conteudo = fs.readFileSync(arquivo, "utf-8");
    let mudou = false;

    for (const [token, valor] of Object.entries(respostas)) {
      if (conteudo.includes(token)) {
        // os prompts vivem dentro de strings JSON — escapa o valor com segurança
        const valorEscapado = JSON.stringify(valor).slice(1, -1);
        conteudo = conteudo.split(token).join(valorEscapado);
        mudou = true;
      }
    }

    if (mudou) {
      JSON.parse(conteudo); // garante que o arquivo continua um JSON válido
      fs.copyFileSync(arquivo, arquivo + ".bak");
      fs.writeFileSync(arquivo, conteudo, "utf-8");
      console.log(`✔ preenchido: workflows/${nome}`);
    }
  }

  console.log(
    "\nPronto! Agora importe os 3 JSONs da pasta workflows/ no seu n8n" +
      "\n(Workflows → ⋮ → Import from File) e conecte as credenciais." +
      "\nOs arquivos originais ficaram salvos como .bak.\n"
  );
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
