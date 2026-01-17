// Script de teste para verificar se o bot do Telegram está funcionando
require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')

const token = process.env.TELEGRAM_BOT_TOKEN
const chatId = process.env.TELEGRAM_CHAT_ID

if (!token || !chatId) {
  console.error('❌ Variáveis de ambiente não configuradas!')
  console.log('TELEGRAM_BOT_TOKEN:', token ? '✓ Configurado' : '✗ Faltando')
  console.log('TELEGRAM_CHAT_ID:', chatId ? '✓ Configurado' : '✗ Faltando')
  process.exit(1)
}

const bot = new TelegramBot(token, { polling: false })

const testMessage = `
🔔 *Teste de Notificação*

Este é um teste do sistema de notificações da Barbearia Dom Lima.

Se você recebeu esta mensagem, o bot está funcionando corretamente! ✅
`.trim()

bot.sendMessage(chatId, testMessage, { parse_mode: 'Markdown' })
  .then(() => {
    console.log('✅ Mensagem de teste enviada com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erro ao enviar mensagem:', error.message)
    process.exit(1)
  })
