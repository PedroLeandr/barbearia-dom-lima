// Bot do Telegram para gerenciar marcações
require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const { neon } = require('@neondatabase/serverless')

const token = process.env.TELEGRAM_BOT_TOKEN
const sql = neon(process.env.DATABASE_URL)

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN não configurado!')
  process.exit(1)
}

const bot = new TelegramBot(token, { polling: true })

console.log('🤖 Bot iniciado e aguardando comandos...')

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id
  bot.sendMessage(chatId, 
    '👋 Olá! Sou o bot da Barbearia Dom Lima.\n\n' +
    'Comandos disponíveis:\n' +
    '📅 /marcacoes - Ver marcações por dia\n' +
    '📋 /hoje - Ver marcações de hoje\n' +
    '📆 /amanha - Ver marcações de amanhã'
  )
})

// Comando /marcacoes - Mostra botões para escolher o barbeiro
bot.onText(/\/marcacoes/, async (msg) => {
  const chatId = msg.chat.id
  
  const keyboard = [
    [
      { text: '💈 Lima', callback_data: 'barber_lima' },
      { text: '💈 Rute', callback_data: 'barber_rute' }
    ],
    [
      { text: '👥 Todos os barbeiros', callback_data: 'barber_all' }
    ]
  ]
  
  bot.sendMessage(chatId, '💈 Escolha o barbeiro:', {
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
})

// Comando /hoje - Mostra marcações de hoje
bot.onText(/\/hoje/, async (msg) => {
  const chatId = msg.chat.id
  const today = new Date().toISOString().split('T')[0]
  
  const keyboard = [
    [
      { text: '💈 Lima', callback_data: `d_${today.replace(/-/g, '')}_lima` },
      { text: '💈 Rute', callback_data: `d_${today.replace(/-/g, '')}_rute` }
    ],
    [
      { text: '👥 Todos', callback_data: `d_${today.replace(/-/g, '')}_all` }
    ]
  ]
  
  bot.sendMessage(chatId, '💈 Ver marcações de hoje de:', {
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
})

// Comando /amanha - Mostra marcações de amanhã
bot.onText(/\/amanha/, async (msg) => {
  const chatId = msg.chat.id
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  
  const keyboard = [
    [
      { text: '💈 Lima', callback_data: `d_${tomorrowStr.replace(/-/g, '')}_lima` },
      { text: '💈 Rute', callback_data: `d_${tomorrowStr.replace(/-/g, '')}_rute` }
    ],
    [
      { text: '👥 Todos', callback_data: `d_${tomorrowStr.replace(/-/g, '')}_all` }
    ]
  ]
  
  bot.sendMessage(chatId, '💈 Ver marcações de amanhã de:', {
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
})

// Callback para quando clicar em um barbeiro ou dia
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id
  const data = query.data
  
  // Escolha de barbeiro
  if (data.startsWith('barber_')) {
    const barber = data.replace('barber_', '')
    await showDatesForBarber(chatId, barber)
    bot.answerCallbackQuery(query.id)
  }
  
  // Escolha de dia
  else if (data.startsWith('d_')) {
    // Formato: d_YYYYMMDD_barber
    const parts = data.split('_')
    const shortDate = parts[1]
    const barber = parts[2]
    
    // Converter de YYYYMMDD para YYYY-MM-DD
    const year = shortDate.substring(0, 4)
    const month = shortDate.substring(4, 6)
    const day = shortDate.substring(6, 8)
    const date = `${year}-${month}-${day}`
    
    await sendBookingsForDate(chatId, date, barber)
    bot.answerCallbackQuery(query.id)
  }
})

// Função para mostrar dias com marcações de um barbeiro
async function showDatesForBarber(chatId, barber) {
  try {
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + 30)
    
    let result
    
    if (barber === 'all') {
      // Buscar todos os dias com marcações
      result = await sql`
        SELECT DISTINCT date
        FROM bookings
        WHERE date >= ${today.toISOString().split('T')[0]}
        AND date <= ${futureDate.toISOString().split('T')[0]}
        ORDER BY date ASC
      `
    } else {
      // Buscar dias com marcações do barbeiro específico
      result = await sql`
        SELECT DISTINCT b.date
        FROM bookings b
        JOIN barbers ba ON b.barber_id = ba.id
        WHERE b.date >= ${today.toISOString().split('T')[0]}
        AND b.date <= ${futureDate.toISOString().split('T')[0]}
        AND ba.id = ${barber}
        ORDER BY b.date ASC
      `
    }
    
    if (result.length === 0) {
      const barberName = barber === 'all' ? 'nenhum barbeiro' : barber === 'lima' ? 'Lima' : 'Rute'
      bot.sendMessage(chatId, `📭 Não há marcações para ${barberName} nos próximos 30 dias.`)
      return
    }
    
    // Criar botões inline com os dias (máximo 2 por linha)
    const keyboard = []
    for (let i = 0; i < result.length; i += 2) {
      const row = []
      
      for (let j = i; j < Math.min(i + 2, result.length); j++) {
        // Converter para string se for Date
        const dateStr = result[j].date instanceof Date 
          ? result[j].date.toISOString().split('T')[0]
          : result[j].date
          
        const date = new Date(dateStr + 'T00:00:00')
        const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' })
        const dayMonth = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        
        // Usar formato curto: d_YYYYMMDD_barber
        const shortDate = dateStr.replace(/-/g, '')
        
        row.push({
          text: `${dayName} ${dayMonth}`,
          callback_data: `d_${shortDate}_${barber}`
        })
      }
      
      keyboard.push(row)
    }
    
    const barberName = barber === 'all' ? 'todos os barbeiros' : barber === 'lima' ? 'Lima' : 'Rute'
    bot.sendMessage(chatId, `📅 Marcações de *${barberName}*\n\nSelecione um dia:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    })
    
  } catch (error) {
    console.error('Erro ao buscar marcações:', error)
    bot.sendMessage(chatId, '❌ Erro ao buscar marcações. Tente novamente.')
  }
}

// Função para enviar marcações de uma data específica
async function sendBookingsForDate(chatId, date, barber = 'all') {
  try {
    let result
    
    if (barber === 'all') {
      // Buscar todas as marcações do dia
      result = await sql`
        SELECT 
          b.client_name,
          b.client_phone,
          b.start_time,
          b.end_time,
          ba.name as barber_name,
          s.name as service_name
        FROM bookings b
        JOIN barbers ba ON b.barber_id = ba.id
        JOIN services s ON b.service_id = s.id
        WHERE b.date = ${date}
        ORDER BY b.start_time ASC
      `
    } else {
      // Buscar marcações do barbeiro específico
      result = await sql`
        SELECT 
          b.client_name,
          b.client_phone,
          b.start_time,
          b.end_time,
          ba.name as barber_name,
          s.name as service_name
        FROM bookings b
        JOIN barbers ba ON b.barber_id = ba.id
        JOIN services s ON b.service_id = s.id
        WHERE b.date = ${date}
        AND ba.id = ${barber}
        ORDER BY b.start_time ASC
      `
    }
    
    if (result.length === 0) {
      const dateObj = new Date(date + 'T00:00:00')
      const dateFormatted = dateObj.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        day: '2-digit', 
        month: 'long' 
      })
      const barberName = barber === 'all' ? '' : barber === 'lima' ? ' para Lima' : ' para Rute'
      bot.sendMessage(chatId, `📭 Não há marcações${barberName} em ${dateFormatted}.`)
      return
    }
    
    // Formatar data
    const dateObj = new Date(date + 'T00:00:00')
    const dateFormatted = dateObj.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: 'long',
      year: 'numeric'
    })
    
    // Criar mensagem com resumo
    const barberName = barber === 'all' ? '' : ` - ${barber === 'lima' ? 'Lima' : 'Rute'}`
    let message = `📅 *Marcações para ${dateFormatted}${barberName}*\n\n`
    message += `Total: ${result.length} marcação${result.length > 1 ? 'ões' : ''}\n\n`
    
    result.forEach((booking, index) => {
      // Garantir que start_time e end_time sejam Date objects
      const startTimeObj = booking.start_time instanceof Date 
        ? booking.start_time 
        : new Date(booking.start_time)
      const endTimeObj = booking.end_time instanceof Date 
        ? booking.end_time 
        : new Date(booking.end_time)
        
      const startTime = startTimeObj.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      const endTime = endTimeObj.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      
      message += `${index + 1}. 🕐 *${startTime} - ${endTime}*\n`
      message += `   👤 ${booking.client_name}\n`
      message += `   📱 ${booking.client_phone}\n`
      if (barber === 'all') {
        message += `   💈 ${booking.barber_name}\n`
      }
      message += `   ✂️ ${booking.service_name}\n\n`
    })
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    
  } catch (error) {
    console.error('Erro ao buscar marcações:', error)
    bot.sendMessage(chatId, '❌ Erro ao buscar marcações. Tente novamente.')
  }
}

// Tratamento de erros
bot.on('polling_error', (error) => {
  console.error('❌ Erro de polling:', error.message)
})

// Mensagens não reconhecidas
bot.on('message', (msg) => {
  const chatId = msg.chat.id
  const text = msg.text
  
  // Ignorar comandos já tratados
  if (text && text.startsWith('/')) {
    return
  }
  
  // Responder a mensagens de texto normais
  if (text && !text.startsWith('/')) {
    bot.sendMessage(chatId, 
      '❓ Comando não reconhecido.\n\n' +
      'Use /marcacoes para ver as marcações por dia.'
    )
  }
})
