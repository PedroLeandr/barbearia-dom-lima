import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/database'
import { sendBookingNotification } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientName, clientPhone, barberId, serviceId, date, startTime, endTime, userId } = body
    
    // Validar dados obrigatórios
    if (!clientName || !clientPhone || !barberId || !serviceId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Dados obrigatórios faltando' },
        { status: 400 }
      )
    }
    
    console.log('[Booking] Validando barber_id:', barberId)
    
    // Verificar se o barbeiro existe
    const barberCheck = await sql`SELECT id FROM barbers WHERE id = ${barberId}`
    if (barberCheck.length === 0) {
      console.error('[Booking] Barbeiro não encontrado:', barberId)
      return NextResponse.json(
        { error: `Barbeiro '${barberId}' não encontrado` },
        { status: 400 }
      )
    }
    
    console.log('[Booking] Validando service_id:', serviceId)
    
    // Verificar se o serviço existe
    const serviceCheck = await sql`SELECT id FROM services WHERE id = ${serviceId}`
    if (serviceCheck.length === 0) {
      console.error('[Booking] Serviço não encontrado:', serviceId)
      return NextResponse.json(
        { error: `Serviço '${serviceId}' não encontrado` },
        { status: 400 }
      )
    }
    
    console.log('[Booking] Verificando conflito de horário...')
    
    // Verificar se já existe uma marcação no mesmo horário para o mesmo barbeiro
    const conflictCheck = await sql`
      SELECT id FROM bookings 
      WHERE barber_id = ${barberId} 
      AND date = ${date}
      AND (
        (start_time <= ${startTime} AND end_time > ${startTime})
        OR (start_time < ${endTime} AND end_time >= ${endTime})
        OR (start_time >= ${startTime} AND end_time <= ${endTime})
      )
    `
    
    if (conflictCheck.length > 0) {
      console.error('[Booking] Conflito de horário detectado')
      return NextResponse.json(
        { error: 'Este horário já está ocupado. Por favor, escolha outro horário.' },
        { status: 409 }
      )
    }
    
    // Gerar ID único para o agendamento
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    console.log('[Booking] Criando agendamento:', bookingId)
    
    // Inserir agendamento na database
    const result = await sql`
      INSERT INTO bookings (id, client_name, client_phone, barber_id, service_id, date, start_time, end_time, user_id, created_at) 
      VALUES (${bookingId}, ${clientName}, ${clientPhone}, ${barberId}, ${serviceId}, ${date}, ${startTime}, ${endTime}, ${userId || null}, ${new Date()}) 
      RETURNING id
    `
    
    console.log('[Booking] Agendamento criado com sucesso:', result[0].id)
    
    // Buscar informações completas do agendamento para notificação
    const bookingDetails = await sql`
      SELECT 
        b.client_name,
        b.client_phone,
        b.date,
        b.start_time,
        b.end_time,
        ba.name as barber_name,
        s.name as service_name
      FROM bookings b
      JOIN barbers ba ON b.barber_id = ba.id
      JOIN services s ON b.service_id = s.id
      WHERE b.id = ${result[0].id}
    `
    
    // Enviar notificação no Telegram se for para Lima ou Rute
    if (bookingDetails.length > 0) {
      const booking = bookingDetails[0]
      const barberNameLower = booking.barber_name.toLowerCase()
      
      if (barberNameLower.includes('lima') || barberNameLower.includes('rute')) {
        console.log(`[Booking] Enviando notificação para o Telegram (marcação para ${booking.barber_name})`)
        await sendBookingNotification({
          clientName: booking.client_name,
          clientPhone: booking.client_phone,
          barberName: booking.barber_name,
          serviceName: booking.service_name,
          date: booking.date,
          startTime: booking.start_time,
          endTime: booking.end_time
        })
      }
    }
    
    return NextResponse.json({ 
      bookingId: result[0].id,
      message: 'Agendamento criado com sucesso' 
    })
    
  } catch (error: any) {
    console.error('[Booking] Erro ao criar agendamento:', error)
    
    // Tratamento específico de erros
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Dados inválidos: barbeiro ou serviço não existe' },
        { status: 400 }
      )
    }
    
    if (error.code?.includes('ETIMEDOUT') || error.message?.includes('timeout')) {
      return NextResponse.json(
        { error: 'Timeout na conexão com o banco de dados. Tente novamente.' },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      )
    }
    
    // Buscar agendamentos do usuário (guest ou autenticado)
    const result = await sql`
      SELECT 
        b.id,
        b.client_name as "clientName",
        b.client_phone as "clientPhone",
        b.date,
        b.start_time as "startTime",
        b.end_time as "endTime",
        b.created_at as "createdAt",
        s.name as "serviceName",
        ba.name as "barberName"
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      JOIN barbers ba ON b.barber_id = ba.id
      WHERE b.user_id = ${userId}
      ORDER BY b.start_time DESC
    `
    
    return NextResponse.json({ bookings: result })
    
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}