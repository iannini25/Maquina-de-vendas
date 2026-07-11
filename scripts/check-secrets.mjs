#!/usr/bin/env node
// Bloqueia commit/verify se algum padrão de segredo real aparecer em arquivos rastreados.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  { name: "Anthropic key", re: /sk-ant-[a-zA-Z0-9_-]{20,}/ },
  { name: "OpenAI-style key", re: /sk-[a-zA-Z0-9]{40,}/ },
  { name: "Voyage key", re: /pa-[a-zA-Z0-9_-]{30,}/ },
  { name: "Resend key", re: /re_[a-zA-Z0-9_-]{20,}/ },
  { name: "Stripe secret", re: /sk_live_[a-zA-Z0-9]{20,}/ },
  { name: "AWS secret", re: /aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{30,}/i },
  { name: "Private key block", re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
];

const SKIP = [/\.png$/, /\.jpg$/, /\.woff2?$/, /\.ico$/, /docs\/prototype\//, /pnpm-lock\.yaml$/];

const files = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !SKIP.some((re) => re.test(f)));

let bad = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) {
      console.error(`SEGREDO SUSPEITO (${name}) em: ${file}`);
      bad++;
    }
  }
}

if (bad > 0) {
  console.error(`\n${bad} ocorrência(s). Remova antes de commitar.`);
  process.exit(1);
}
console.log("check-secrets: ok");
