# Bot do Telegram - Barbearia Dom Lima

## Modos de operação

O bot pode funcionar de duas formas:

### 1. Modo Local (Polling) - Para desenvolvimento
```bash
npm run telegram-bot
```

### 2. Modo Webhook (Vercel) - Para produção
O bot funciona automaticamente quando deployado no Vercel.

## Configuração no Vercel

### Passo 1: Deploy no Vercel
```bash
vercel --prod
```

### Passo 2: Configurar webhook
Após o deploy, configure o webhook com a URL do seu app:

```bash
npm run setup-webhook https://seu-app.vercel.app
```

### Passo 3: Adicionar variáveis de ambiente no Vercel
No painel do Vercel, adicione as seguintes variáveis:

```
TELEGRAM_BOT_TOKEN=seu-token-aqui
TELEGRAM_CHAT_LIMA_ID=id-do-chat-lima
TELEGRAM_CHAT_RUTE_ID=id-do-chat-rute
DATABASE_URL=sua-connection-string
```

### Remover webhook (voltar para modo local)
```bash
npm run delete-webhook
```

## Comandos disponíveis

### `/start`
Mostra mensagem de boas-vindas e lista de comandos disponíveis.

### `/marcacoes`
1. Escolhe o barbeiro (Lima, Rute ou Todos)
2. Mostra botões com dias que têm marcações
3. Ao clicar, mostra o resumo detalhado

### `/hoje`
Escolhe o barbeiro e mostra marcações do dia atual.

### `/amanha`
Escolhe o barbeiro e mostra marcações do dia seguinte.

## Formato do resumo

```
📅 Marcações para segunda-feira, 17 de janeiro de 2026 - Lima

Total: 3 marcações

1. 🕐 09:00 - 09:45
   👤 João Silva
   📱 (11) 99999-9999
   ✂️ Corte Premium

2. 🕐 10:00 - 11:00
   👤 Maria Santos
   📱 (11) 98888-8888
   ✂️ Combo Corte + Barba

...
```

## Notificações automáticas

O bot envia notificações automáticas quando:
- Uma nova marcação é feita para o Lima (envia para o chat do Lima)
- Uma nova marcação é feita para a Rute (envia para o chat da Rute)

Isso funciona tanto no modo local quanto no Vercel.

## Arquitetura

### Modo Local (telegram-bot.js)
- Usa polling para receber mensagens
- Ideal para desenvolvimento
- Requer processo rodando continuamente

### Modo Vercel (src/app/api/telegram/webhook/route.ts)
- Usa webhooks (serverless)
- Ideal para produção
- Não requer processo rodando
- Escala automaticamente

## Troubleshooting

### Webhook não funciona
1. Verifique se a URL está correta
2. Verifique se as variáveis de ambiente estão configuradas no Vercel
3. Veja os logs no Vercel Dashboard

### Bot não responde
1. Verifique se o webhook está configurado: `npm run setup-webhook https://seu-app.vercel.app`
2. Teste localmente primeiro com `npm run telegram-bot`

### Conflito de instâncias
Se aparecer erro "409 Conflict", significa que há múltiplas instâncias rodando.
Solução: `npm run delete-webhook` e depois escolha um modo (local ou webhook).

