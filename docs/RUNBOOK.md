# RUNBOOK — operação do VendaFlow

Comandos e soluções para o dia a dia. Tudo parte de `/opt/vendaflow`.

```bash
alias dc='docker compose -f infra/docker-compose.prod.yml --env-file .env'
```

## Logs

```bash
dc logs -f web        # painel + APIs + webhooks
dc logs -f worker     # SDR de IA, cadências, e-mails, ingestão
dc logs -f evolution  # WhatsApp
dc logs -f caddy      # TLS/proxy
```

## Reiniciar serviços

```bash
dc restart worker          # só o worker (seguro; jobs voltam da fila)
dc restart web
dc up -d --build web       # rebuild após git pull
```

## Problemas comuns

### WhatsApp desconectou (QR)
Sintoma: mensagens não saem; Inbox para de receber.
1. Configurações → WhatsApp (Evolution) → **Verificar** → escaneie o novo QR.
2. Se o card não gerar QR: `dc restart evolution` e verifique de novo.
3. Instâncias ficam no volume `evolution_instances` — não é preciso reparear
   após restart normal.

### DNS não propagou / TLS não emite
- `dig +short app.seudominio.com` deve responder o IP da VPS.
- Caddy tenta de novo sozinho; veja `dc logs caddy | grep -i acme`.
- Porta 80/443 abertas? `ufw status`.

### E-mail caindo em spam
- Confirme o domínio **verified** no Resend (Setup → card Resend → Verificar DNS).
- SPF/DKIM/DMARC precisam estar todos verdes; DMARC `p=none` no início.
- Use um subdomínio de envio dedicado (ex.: `mail.seudominio.com`).

### IA não responde no WhatsApp
1. `dc logs -f worker | grep agent-reply` — procure `credential.missing`.
2. Configurações → Anthropic → **Testar** (a chave pode ter expirado/limite).
3. Lead pode estar **Pausado** (você assumiu a conversa) — devolva pra IA no Inbox.
4. Fora do horário ativo da persona? SDR de IA → Persona → janela de horário.

### Banco cheio / disco
```bash
df -h
docker system prune -f              # imagens antigas
find /backup -mtime +7 -delete      # forçar retenção
```

## Rotacionar chaves

- **Chaves de API (Anthropic, Resend etc.)**: Configurações → card → Substituir → Verificar. Aplicação é imediata.
- **APP_ENCRYPTION_KEY** (avançado — segredos do banco são cifrados com ela):
  1. NÃO troque a chave sem re-cifrar: os segredos existentes ficariam ilegíveis.
  2. Caminho seguro: anote as chaves de API atuais, troque `APP_ENCRYPTION_KEY`
     no `.env`, `dc up -d web worker`, e re-salve cada credencial no painel.
- **AUTH_SECRET**: pode trocar direto no `.env` + `dc up -d web` (derruba as
  sessões ativas; todos precisam logar de novo).

## Verificações rápidas de saúde

```bash
curl -s https://app.seudominio.com/api/health   # web + banco
dc exec redis redis-cli ping                     # PONG
dc exec postgres pg_isready -U vendaflow
```
