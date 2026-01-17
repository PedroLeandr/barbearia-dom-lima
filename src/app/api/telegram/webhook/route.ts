import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/database'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Função para enviar mensagem via Telegram
async function sendMessage(chatId: number, text: string, options: any = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...options
    })
  })
  
  return response.json()
}

// Função para responder callback query
async function answerCallbackQuery(callbackQueryId: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId })
  })
}

// Função para mostrar dias com marcações de um barbeiro
async function showDatesForBarber(chatId: number, barber: string) {
  try {
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + 30)
    
    let result
    
    if (barber === 'all') {
      result = await sql`
        SELECT DISTINCT date
        FROM bookings
        WHERE date >= ${today.toISOString().split('T')[0]}
        AND date <= ${futureDate.toISOString().split('T')[0]}
        ORDER BY date ASC
      `
    } else {
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
      await sendMessage(chatId, `📭 Não há marcações para ${barberName} nos próximos 30 dias.`)
      return
    }
    
    const keyboard = []
    for (let i = 0; i < result.length; i += 2) {
      const row = []
      
      for (let j = i; j < Math.min(i + 2, result.length); j++) {
        const dateStr = result[j].date instanceof Date 
          ? result[j].date.toISOString().split('T')[0]
          : result[j].date
          
        const date = new Date(dateStr + 'T00:00:00')
        const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' })
        const dayMonth = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        
        const shortDate = dateStr.replace(/-/g, '')
        
        row.push({
          text: `${dayName} ${dayMonth}`,
          callback_data: `d_${shortDate}_${barber}`
        })
      }
      
      keyboard.push(row)
    }
    
    const barberName = barber === 'all' ? 'todos os barbeiros' : barber === 'lima' ? 'Lima' : 'Rute'
    await sendMessage(chatId, `📅 Marcações de *${barberName}*\n\nSelecione um dia:`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    })
    
  } catch (error) {
    console.error('Erro ao buscar marcações:', error)
    await sendMessage(chatId, '❌ Erro ao buscar marcações. Tente novamente.')
  }
}

// Função para enviar marcações de uma data específica
async function sendBookingsForDate(chatId: number, date: string, barber: string = 'all') {
  try {
    let result
    
    if (barber === 'all') {
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
      await sendMessage(chatId, `📭 Não há marcações${barberName} em ${dateFormatted}.`)
      return
    }
    
    const dateObj = new Date(date + 'T00:00:00')
    const dateFormatted = dateObj.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: 'long',
      year: 'numeric'
    })
    
    const barberName = barber === 'all' ? '' : ` - ${barber === 'lima' ? 'Lima' : 'Rute'}`
    let message = `📅 *Marcações para ${dateFormatted}${barberName}*\n\n`
    message += `Total: ${result.length} marcação${result.length > 1 ? 'ões' : ''}\n\n`
    
    result.forEach((booking: any, index: number) => {
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
    
    await sendMessage(chatId, message, { parse_mode: 'Markdown' })
    
  } catch (error) {
    console.error('Erro ao buscar marcações:', error)
    await sendMessage(chatId, '❌ Erro ao buscar marcações. Tente novamente.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Processar mensagem de texto
    if (body.message) {
      const chatId = body.message.chat.id
      const text = body.message.text
      
      if (text === '/start') {
        await sendMessage(chatId, 
          '👋 Olá! Sou o bot da Barbearia Dom Lima.\n\n' +
          'Comandos disponíveis:\n' +
          '📅 /marcacoes - Ver marcações por dia\n' +
          '📋 /hoje - Ver marcações de hoje\n' +
          '📆 /amanha - Ver marcações de amanhã'
        )
      }
      else if (text === '/marcacoes') {
        const keyboard = [
          [
            { text: '💈 Lima', callback_data: 'barber_lima' },
            { text: '💈 Rute', callback_data: 'barber_rute' }
          ],
          [
            { text: '👥 Todos os barbeiros', callback_data: 'barber_all' }
          ]
        ]
        
        await sendMessage(chatId, '💈 Escolha o barbeiro:', {
          reply_markup: { inline_keyboard: keyboard }
        })
      }
      else if (text === '/hoje') {
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
        
        await sendMessage(chatId, '💈 Ver marcações de hoje de:', {
          reply_markup: { inline_keyboard: keyboard }
        })
      }
      else if (text === '/amanha') {
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
        
        await sendMessage(chatId, '💈 Ver marcações de amanhã de:', {
          reply_markup: { inline_keyboard: keyboard }
        })
      }
      else if (text && !text.startsWith('/')) {
        await sendMessage(chatId, 
          '❓ Comando não reconhecido.\n\n' +
          'Use /marcacoes para ver as marcações por dia.'
        )
      }
    }
    
    // Processar callback query (botões)
    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id
      const data = body.callback_query.data
      const callbackQueryId = body.callback_query.id
      
      if (data.startsWith('barber_')) {
        const barber = data.replace('barber_', '')
        await showDatesForBarber(chatId, barber)
      }
      else if (data.startsWith('d_')) {
        const parts = data.split('_')
        const shortDate = parts[1]
        const barber = parts[2]
        
        const year = shortDate.substring(0, 4)
        const month = shortDate.substring(4, 6)
        const day = shortDate.substring(6, 8)
        const date = `${year}-${month}-${day}`
        
        await sendBookingsForDate(chatId, date, barber)
      }
      
      await answerCallbackQuery(callbackQueryId)
    }
    
    return NextResponse.json({ ok: true })
    
  } catch (error) {
    console.error('Erro no webhook:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
