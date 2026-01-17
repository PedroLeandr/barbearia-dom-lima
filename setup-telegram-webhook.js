// Script para configurar o webhook do Telegram
require('dotenv').config()

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const VERCEL_URL = process.argv[2] // URL do Vercel passada como argumento

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN não configurado no .env')
  process.exit(1)
}

if (!VERCEL_URL) {
  console.error('❌ URL do Vercel não fornecida')
  console.log('\nUso: node setup-telegram-webhook.js https://seu-app.vercel.app')
  process.exit(1)
}

const webhookUrl = `${VERCEL_URL}/api/telegram/webhook`

async function setupWebhook() {
  try {
    console.log('🔧 Configurando webhook do Telegram...')
    console.log(`📡 URL: ${webhookUrl}`)
    
    // Configurar webhook
    const setWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`
    const response = await fetch(setWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    })
    
    const result = await response.json()
    
    if (result.ok) {
      console.log('✅ Webhook configurado com sucesso!')
      
      // Verificar webhook
      const getWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      const infoResponse = await fetch(getWebhookUrl)
      const info = await infoResponse.json()
      
      console.log('\n📋 Informações do webhook:')
      console.log(`   URL: ${info.result.url}`)
      console.log(`   Pending updates: ${info.result.pending_update_count}`)
      if (info.result.last_error_message) {
        console.log(`   ⚠️  Último erro: ${info.result.last_error_message}`)
      }
    } else {
      console.error('❌ Erro ao configurar webhook:', result.description)
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  }
}

async function deleteWebhook() {
  try {
    console.log('🗑️  Removendo webhook...')
    
    const deleteWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`
    const response = await fetch(deleteWebhookUrl, {
      method: 'POST'
    })
    
    const result = await response.json()
    
    if (result.ok) {
      console.log('✅ Webhook removido com sucesso!')
    } else {
      console.error('❌ Erro ao remover webhook:', result.description)
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

// Se o argumento for "delete", remove o webhook
if (VERCEL_URL === 'delete') {
  deleteWebhook()
} else {
  setupWebhook()
}
