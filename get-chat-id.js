// Script para descobrir o Chat ID do Telegram
require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN não configurado!')
  process.exit(1)
}

const bot = new TelegramBot(token, { polling: true })

console.log('🤖 Bot iniciado!')
console.log('📱 Envie qualquer mensagem para o bot no Telegram...')
console.log('   (Procure pelo bot usando o token ou nome do bot)')
console.log('')

bot.on('message', (msg) => {
  console.log('✅ Mensagem recebida!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 INFORMAÇÕES DO CHAT:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Chat ID: ${msg.chat.id}`)
  console.log(`Tipo: ${msg.chat.type}`)
  console.log(`Nome: ${msg.chat.first_name || msg.chat.title || 'N/A'}`)
  console.log(`Username: @${msg.chat.username || 'N/A'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log(`✏️  Adicione esta linha no seu arquivo .env:`)
  console.log(`TELEGRAM_CHAT_ID="${msg.chat.id}"`)
  console.log('')
  
  bot.sendMessage(msg.chat.id, '✅ Chat ID capturado com sucesso! Verifique o terminal.')
    .then(() => {
      console.log('✅ Mensagem de confirmação enviada!')
      console.log('Você pode fechar este script agora (Ctrl+C)')
    })
    .catch(console.error)
})

bot.on('polling_error', (error) => {
  console.error('❌ Erro:', error.message)
})
