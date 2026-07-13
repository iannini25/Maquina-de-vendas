# DEPLOY — Sales4U na VPS (Hostinger)

Guia do zero ao ar: VPS Ubuntu 22.04/24.04, Docker, TLS automático.

## 0. Pré-requisitos

- VPS com **2 vCPU / 4 GB RAM+** (roda com 2 GB usando o swap que o script cria)
- Um domínio (ex.: `seudominio.com`) gerenciado no painel da Hostinger
- Acesso SSH root (ou usuário com sudo)

## 1. Apontar o DNS (faça primeiro — propagação leva tempo)

No painel DNS da Hostinger, crie:

| Tipo  | Nome   | Valor            | Para quê                    |
| ----- | ------ | ---------------- | --------------------------- |
| A     | `app`  | IP da VPS        | Painel (app.seudominio.com) |
| A     | `@`    | IP da VPS        | Landing pages               |
| A     | `evo`  | IP da VPS        | (opcional) QR remoto        |

> Os registros do **Resend** (SPF/DKIM/DMARC) são exibidos dentro do próprio
> Setup Gate ao verificar a credencial — copie de lá para o painel da Hostinger.

## 2. Rodar o setup na VPS

```bash
ssh root@IP_DA_VPS
curl -fsSL https://raw.githubusercontent.com/iannini25/Maquina-de-vendas/main/infra/deploy/setup-vps.sh -o setup-vps.sh
bash setup-vps.sh
```

O script é idempotente e faz: update do SO → swap (se RAM < 4 GB) → Docker →
usuário `deploy` → UFW (22/80/443) → clona o repo em `/opt/sales4u` → gera o
`.env` interativo (pergunta os domínios; gera todos os segredos) → sobe o
compose de produção → agenda backup diário 03:30 com retenção de 7 dias.

## 3. Conferir que subiu

```bash
cd /opt/sales4u
docker compose -f infra/docker-compose.prod.yml ps       # tudo "healthy"
curl -s https://app.SEUDOMINIO.com/api/health             # {"ok":true,...}
```

O TLS é automático (Caddy + Let's Encrypt) — só precisa do DNS propagado.

## 4. Primeiro acesso (Setup Gate)

1. Abra `https://app.seudominio.com` → **Criar workspace** (primeiro signup vira OWNER).
2. O Setup Gate abre travando o sistema. Preencha e **[Verificar]** cada card:
   - **Anthropic** — API key do console.anthropic.com
   - **Voyage** (opcional) — sem ela o RAG usa busca full-text
   - **WhatsApp (Evolution)** — deixe os defaults (instância própria do compose);
     clique Verificar e **escaneie o QR** (WhatsApp → Aparelhos conectados)
   - **Resend** — API key + domínio; copie a **tabela DNS** exibida para a
     Hostinger e clique **Verificar DNS**
   - **S3/MinIO** — verifica sozinho (ambiente)
   - **Domínio** — preencha e verifique
3. **[Liberar sistema]** → Dashboard.

## 5. Smoke test pós-deploy

- [ ] Login/logout funcionam
- [ ] Criar um lead no Pipeline → aparece no kanban e no espelho Leads
- [ ] Mandar um "oi" de outro número para o WhatsApp pareado → mensagem
      aparece no Inbox e a IA responde
- [ ] Publicar uma landing → abrir `https://seudominio.com/p/<slug>` no celular
- [ ] Testar envio de e-mail em Templates de E-mail → [Testar envio]
- [ ] `docker compose … ps` sem restarts em loop

## 6. Atualizar o sistema

```bash
cd /opt/sales4u
git pull
docker compose -f infra/docker-compose.prod.yml up -d --build
```

As migrations rodam sozinhas no start do web.

## 7. Backup & restauração

Backup automático diário em `/backup` (pg + volumes, retenção 7 dias).

Restaurar banco:

```bash
cd /opt/sales4u
gunzip -c /backup/pg-XXXX.sql.gz | docker compose -f infra/docker-compose.prod.yml exec -T postgres psql -U sales4u
```

Restaurar volumes (minio/evolution):

```bash
docker run --rm -v sales4u_minio_data:/data/minio -v sales4u_evolution_instances:/data/evolution -v /backup:/backup alpine tar xzf /backup/volumes-XXXX.tar.gz -C /data
```
