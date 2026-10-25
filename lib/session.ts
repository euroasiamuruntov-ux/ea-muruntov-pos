// Kirgan xodim ma'lumoti brauzerda saqlanadi. Buzilgan yoki bo'sh bo'lsa sahifa yiqilmaydi, login'ga qaytariladi.
export type SessionUser = { id: string; name: string; role: string }

const KEY = 'pos_user'

export function getStoredUser(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const u = JSON.parse(raw)
    return u && typeof u.id === 'string' && typeof u.role === 'string' ? (u as SessionUser) : null
  } catch {
    return null
  }
}

export function storeUser(user: SessionUser) {
  window.localStorage.setItem(KEY, JSON.stringify(user))
}

export function clearStoredUser() {
  try { window.localStorage.removeItem(KEY) } catch { /* e'tiborsiz */ }
}
