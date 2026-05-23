const TRIAL_KEY = 'ea_trial'
const MAX_USES = 3
const SESSION_MS = 60 * 60 * 1000  // 1 soat
const DAY_MS = 24 * 60 * 60 * 1000 // 24 soat

type TrialData = {
  date: number      // kun boshlanishi
  uses: number      // bugun necha marta ishlatildi
  startedAt: number // joriy sessiya boshlangan vaqt
  active: boolean   // sessiya faolmi
}

export function getTrialData(): TrialData | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(TRIAL_KEY)
  if (!raw) return null
  return JSON.parse(raw)
}

export function canStartTrial(): { ok: boolean; reason?: string } {
  const data = getTrialData()
  const now = Date.now()

  // Birinchi marta
  if (!data) return { ok: true }

  // Yangi kun
  if (now - data.date > DAY_MS) return { ok: true }

  // Faol sessiya bor
  if (data.active && now - data.startedAt < SESSION_MS) {
    return { ok: true } // hali vaqt bor
  }

  // Limit tekshirish
  if (data.uses >= MAX_USES) {
    return { ok: false, reason: 'Bugungi 3 ta test sessiyasi tugadi. Ertaga urinib ko\'ring!' }
  }

  return { ok: true }
}

export function startTrial() {
  const data = getTrialData()
  const now = Date.now()
  const isNewDay = !data || now - data.date > DAY_MS

  const newData: TrialData = {
    date: isNewDay ? now : data!.date,
    uses: isNewDay ? 1 : data!.uses + 1,
    startedAt: now,
    active: true,
  }
  localStorage.setItem(TRIAL_KEY, JSON.stringify(newData))
}

export function endTrial() {
  const data = getTrialData()
  if (!data) return
  localStorage.setItem(TRIAL_KEY, JSON.stringify({ ...data, active: false }))
}

export function getRemainingMs(): number {
  const data = getTrialData()
  if (!data || !data.active) return 0
  const elapsed = Date.now() - data.startedAt
  return Math.max(0, SESSION_MS - elapsed)
}

// Timerni o'chirish uchun (to'lov olgach)
export function disableTrial() {
  localStorage.removeItem(TRIAL_KEY)
}