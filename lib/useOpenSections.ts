'use client'
import { useCallback, useState } from 'react'

function read(storageKey: string, defaults: string[]): string[] {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : defaults
  } catch {
    return defaults   // xotira o'chirilgan yoki buzilgan bo'lsa ham ishlayveradi
  }
}

// Qaysi bo'limlar ochiq ekani brauzerda eslab qolinadi (planshet/telefon qayta ochilganda ham).
export function useOpenSections(storageKey: string, defaults: string[] = []) {
  const [open, setOpen] = useState<string[]>(() => read(storageKey, defaults))

  const save = useCallback((next: string[]) => {
    setOpen(next)
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* e'tiborsiz */ }
  }, [storageKey])

  const isOpen = (id: string) => open.includes(id)
  const toggle = (id: string) => save(open.includes(id) ? open.filter(x => x !== id) : [...open, id])
  const setAll = (ids: string[], value: boolean) =>
    save(value ? Array.from(new Set([...open, ...ids])) : open.filter(x => !ids.includes(x)))

  return { isOpen, toggle, setAll }
}
