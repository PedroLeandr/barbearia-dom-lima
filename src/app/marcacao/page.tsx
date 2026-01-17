'use client'
import { useState, useMemo, Suspense, useEffect } from 'react'
import { Calendar, Clock, User, Scissors, CheckCircle, Check, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUserData } from '@/hooks/useUserData'

interface Service {
  id: string
  name: string
  price: string
  duration: number
}

interface BookingSlot {
  barberId: string
  date: string
  start: string
  duration: number
}

type Step = 'personal' | 'service' | 'barber' | 'datetime' | 'confirm'

const BASE_SLOT = 30 // minutos

function BookingPageContent() {
  const searchParams = useSearchParams()
  const isGuest = searchParams.get('guest') === 'true'
  const { userData, updateField } = useUserData()
  
  const [currentStep, setCurrentStep] = useState<Step>('personal')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    service: '',
    barber: '',
    date: '',
    time: ''
  })
  const [showSuccess, setShowSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [occupiedSlots, setOccupiedSlots] = useState<{ start: string; duration: number }[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)

  // Carregar dados salvos do localStorage ao montar
  useEffect(() => {
    if (userData.name || userData.phone) {
      setFormData(prev => ({
        ...prev,
        name: userData.name,
        phone: userData.phone
      }))
    }
  }, [userData])

  const services: Service[] = [
    { id: 'corte-basico', name: 'Corte Básico', price: 'R$ 50', duration: 30 },
    { id: 'corte-premium', name: 'Corte Premium', price: 'R$ 90', duration: 45 },
    { id: 'barba-completa', name: 'Barba Completa', price: 'R$ 60', duration: 30 },
    { id: 'combo', name: 'Combo Corte + Barba', price: 'R$ 120', duration: 60 },
    { id: 'executive', name: 'Executive VIP', price: 'R$ 150', duration: 90 }
  ]

  const barbers = [
    { id: 'lima', name: 'Lima', specialty: 'Especialista em cortes clássicos', image: 'https://i.pravatar.cc/150?img=12' },
    { id: 'rute', name: 'Rute', specialty: 'Expert em barbas e degradês', image: 'https://i.pravatar.cc/150?img=36' }
  ]

  // Buscar horários ocupados quando barbeiro e data forem selecionados
  const fetchOccupiedSlots = async (barberId: string, date: string) => {
    setIsLoadingSlots(true)
    try {
      const response = await fetch(`/api/bookings/available?barberId=${barberId}&date=${date}`)
      if (response.ok) {
        const data = await response.json()
        setOccupiedSlots(data.occupiedSlots || [])
      } else {
        setOccupiedSlots([])
      }
    } catch (error) {
      console.error('Erro ao buscar horários ocupados:', error)
      setOccupiedSlots([])
    } finally {
      setIsLoadingSlots(false)
    }
  }

  const steps = [
    { id: 'personal' as Step, label: 'Seus Dados', icon: User },
    { id: 'service' as Step, label: 'Serviço', icon: Scissors },
    { id: 'barber' as Step, label: 'Barbeiro', icon: User },
    { id: 'datetime' as Step, label: 'Data e Hora', icon: Calendar },
    { id: 'confirm' as Step, label: 'Confirmar', icon: CheckCircle }
  ]

  const generateDates = () => {
    const dates = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push({
        value: date.toISOString().split('T')[0],
        fullLabel: date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
        shortLabel: date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }),
        day: date.getDate(),
        weekday: date.toLocaleDateString('pt-BR', { weekday: 'short' })
      })
    }
    return dates
  }

  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  const generateSlots = (open: string, close: string, bookings: BookingSlot[], duration: number) => {
    const slots: string[] = []
    const startMin = toMin(open)
    const endMin = toMin(close)

    const occupied = bookings
      .map(b => ({ start: toMin(b.start), end: toMin(b.start) + b.duration }))
      .sort((a, b) => a.start - b.start)

    let current = startMin
    while (current + duration <= endMin) {
      const conflict = occupied.find(b => current < b.end && current + duration > b.start)
      if (!conflict) {
        slots.push(toTime(current))
        current += BASE_SLOT
      } else {
        current = conflict.end
      }
    }

    return slots
  }

  const selectedService = services.find(s => s.id === formData.service)
  const selectedBarber = barbers.find(b => b.id === formData.barber)

  const availableSlots = useMemo(() => {
    if (!formData.service || !formData.barber || !formData.date) return []
    const service = services.find(s => s.id === formData.service)
    if (!service) return []

    // Usar os horários ocupados do banco de dados
    const bookings = occupiedSlots.map(slot => ({
      barberId: formData.barber,
      date: formData.date,
      start: slot.start,
      duration: slot.duration
    }))

    return generateSlots('09:00', '18:30', bookings, service.duration)
  }, [formData.service, formData.barber, formData.date, occupiedSlots])

  // Buscar horários ocupados quando barbeiro ou data mudarem
  useEffect(() => {
    if (formData.barber && formData.date) {
      fetchOccupiedSlots(formData.barber, formData.date)
    } else {
      setOccupiedSlots([])
    }
  }, [formData.barber, formData.date])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBarber || !selectedService) return
    
    setIsSubmitting(true)
    
    try {
      let userId = null
      
      if (isGuest) {
        // Para usuários guest, pegar o ID do localStorage
        userId = localStorage.getItem('guestUserId')
        if (!userId) {
          throw new Error('ID de usuário guest não encontrado')
        }
      }
      
      // Criar o agendamento
      const bookingData = {
        clientName: formData.name,
        clientPhone: formData.phone,
        barberId: formData.barber,
        serviceId: formData.service,
        date: formData.date,
        startTime: `${formData.date}T${formData.time}:00`,
        endTime: calculateEndTime(formData.date, formData.time, selectedService.duration),
        userId: userId // Para usuários guest
      }
      
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData)
      })
      
      if (!response.ok) {
        throw new Error('Erro ao criar agendamento')
      }
      
      // Recarregar horários disponíveis
      if (formData.barber && formData.date) {
        await fetchOccupiedSlots(formData.barber, formData.date)
      }
      
      setShowSuccess(true)
      setTimeout(() => {
        window.location.href = '/'
      }, 3000)
      
    } catch (error) {
      console.error('Erro ao criar agendamento:', error)
      alert('Erro ao criar agendamento. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const calculateEndTime = (date: string, time: string, duration: number) => {
    const startDateTime = new Date(`${date}T${time}:00`)
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000)
    return endDateTime.toISOString()
  }

  const canProceedFromPersonal = formData.name && formData.phone
  const canProceedFromService = formData.service
  const canProceedFromBarber = formData.barber
  const canProceedFromDateTime = formData.date && formData.time

  const getCurrentStepIndex = () => steps.findIndex(s => s.id === currentStep)
  const isStepCompleted = (step: Step) => {
    const currentIndex = getCurrentStepIndex()
    const stepIndex = steps.findIndex(s => s.id === step)
    return stepIndex < currentIndex
  }
  const getSelectedDate = () => generateDates().find(d => d.value === formData.date)

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="bg-neutral-800 rounded-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Agendamento Confirmado!</h2>
          <p className="text-gray-300 mb-6">Seu horário foi reservado com sucesso.</p>
          <Link href="/">
            <Button className="w-full">Voltar ao Início</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pt-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {isGuest ? 'Agendamento Rápido' : 'Novo Agendamento'}
          </h1>
          <div className="w-20" />
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = isStepCompleted(step.id)
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  isActive ? 'border-blue-500 bg-blue-500 text-white' :
                  isCompleted ? 'border-green-500 bg-green-500 text-white' :
                  'border-gray-600 text-gray-400'
                }`}>
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-600'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Form Content */}
        <div className="bg-neutral-800 rounded-lg p-6">
          {currentStep === 'personal' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Seus Dados</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome completo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormData({...formData, name: value})
                      updateField('name', value)
                    }}
                    className="w-full p-3 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    placeholder="Digite seu nome"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Telefone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormData({...formData, phone: value})
                      updateField('phone', value)
                    }}
                    className="w-full p-3 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 'service' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Escolha o Serviço</h2>
              <div className="space-y-3">
                {services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => setFormData({...formData, service: service.id})}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      formData.service === service.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-neutral-600 hover:border-neutral-500'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-white">{service.name}</h3>
                        <p className="text-sm text-gray-400">{service.duration} minutos</p>
                      </div>
                      <span className="text-lg font-bold text-white">{service.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'barber' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Escolha o Barbeiro</h2>
              <div className="space-y-4">
                {barbers.map((barber) => (
                  <div
                    key={barber.id}
                    onClick={() => setFormData({...formData, barber: barber.id})}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      formData.barber === barber.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-neutral-600 hover:border-neutral-500'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <img
                        src={barber.image}
                        alt={barber.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                      <div>
                        <h3 className="font-medium text-white">{barber.name}</h3>
                        <p className="text-sm text-gray-400">{barber.specialty}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'datetime' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Data e Horário</h2>
              
              {/* Date Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-white mb-3">Escolha a data</h3>
                <div className="grid grid-cols-2 gap-2">
                  {generateDates().slice(0, 8).map((date) => (
                    <button
                      key={date.value}
                      onClick={() => setFormData({...formData, date: date.value, time: ''})}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        formData.date === date.value
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-neutral-600 hover:border-neutral-500'
                      }`}
                    >
                      <div className="text-sm text-gray-400">{date.weekday}</div>
                      <div className="text-white font-medium">{date.day}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Selection */}
              {formData.date && (
                <div>
                  <h3 className="text-lg font-medium text-white mb-3">Horários disponíveis</h3>
                  {isLoadingSlots ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      <p className="text-gray-400 mt-2">Carregando horários...</p>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">Nenhum horário disponível para esta data</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setFormData({...formData, time: slot})}
                          className={`p-3 rounded-lg border transition-colors ${
                            formData.time === slot
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-neutral-600 hover:border-neutral-500'
                          }`}
                        >
                          <Clock className="w-4 h-4 mx-auto mb-1 text-gray-400" />
                          <div className="text-white text-sm">{slot}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === 'confirm' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Confirme seu Agendamento</h2>
              
              <div className="space-y-6">
                {/* Dados Pessoais */}
                <div className="bg-neutral-700 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <User className="w-5 h-5 text-blue-500 mr-2" />
                    <h3 className="font-medium text-white">Dados Pessoais</h3>
                  </div>
                  <div className="space-y-2 ml-7">
                    <p className="text-gray-300">
                      <span className="text-gray-400">Nome:</span> <span className="text-white font-medium">{formData.name}</span>
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-400">Telefone:</span> <span className="text-white font-medium">{formData.phone}</span>
                    </p>
                  </div>
                </div>

                {/* Serviço */}
                {selectedService && (
                  <div className="bg-neutral-700 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <Scissors className="w-5 h-5 text-blue-500 mr-2" />
                      <h3 className="font-medium text-white">Serviço</h3>
                    </div>
                    <div className="ml-7">
                      <p className="text-white font-medium">{selectedService.name}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-gray-400 text-sm">Duração: {selectedService.duration} min</p>
                        <p className="text-blue-400 font-semibold">{selectedService.price}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Barbeiro */}
                {selectedBarber && (
                  <div className="bg-neutral-700 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <User className="w-5 h-5 text-blue-500 mr-2" />
                      <h3 className="font-medium text-white">Barbeiro</h3>
                    </div>
                    <div className="flex items-center ml-7">
                      <img
                        src={selectedBarber.image}
                        alt={selectedBarber.name}
                        className="w-12 h-12 rounded-full object-cover mr-3"
                      />
                      <div>
                        <p className="text-white font-medium">{selectedBarber.name}</p>
                        <p className="text-gray-400 text-sm">{selectedBarber.specialty}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Data e Horário */}
                {formData.date && formData.time && (
                  <div className="bg-neutral-700 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <Calendar className="w-5 h-5 text-blue-500 mr-2" />
                      <h3 className="font-medium text-white">Data e Horário</h3>
                    </div>
                    <div className="space-y-2 ml-7">
                      <p className="text-gray-300">
                        <span className="text-gray-400">Data:</span> <span className="text-white font-medium">{getSelectedDate()?.fullLabel}</span>
                      </p>
                      <p className="text-gray-300">
                        <span className="text-gray-400">Horário:</span> <span className="text-white font-medium">{formData.time}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Aviso */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-300 text-sm">
                    ⚠️ Ao confirmar, você receberá uma notificação com os detalhes do seu agendamento.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => {
                const currentIndex = getCurrentStepIndex()
                if (currentIndex > 0) {
                  setCurrentStep(steps[currentIndex - 1].id)
                }
              }}
              disabled={getCurrentStepIndex() === 0}
            >
              Anterior
            </Button>

            {currentStep !== 'confirm' ? (
              <Button
                onClick={() => {
                  const currentIndex = getCurrentStepIndex()
                  if (currentIndex < steps.length - 1) {
                    setCurrentStep(steps[currentIndex + 1].id)
                  }
                }}
                disabled={
                  (currentStep === 'personal' && !canProceedFromPersonal) ||
                  (currentStep === 'service' && !canProceedFromService) ||
                  (currentStep === 'barber' && !canProceedFromBarber) ||
                  (currentStep === 'datetime' && !canProceedFromDateTime)
                }
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? 'Confirmando...' : 'Confirmar Agendamento'}
                <CheckCircle className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    }>
      <BookingPageContent />
    </Suspense>
  )
}