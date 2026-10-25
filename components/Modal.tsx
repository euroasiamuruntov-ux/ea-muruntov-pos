'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

// Hamma oynalar uchun yagona ko'rinish. Esc tugmasi bilan yopiladi.
//  sheet  - pastdan chiqadi (kichik amallar: to'lov, kirim, chiqim)
//  center - o'rtada, ichida ro'yxat (smena qoldiqlari, qarzdorlar, menyu)
type Props = {
  title: string
  onClose?: () => void
  variant?: 'sheet' | 'center'
  size?: 'md' | 'lg'
  titleClassName?: string
  footer?: React.ReactNode
  children: React.ReactNode
}

export default function Modal({ title, onClose, variant = 'sheet', size = 'md', titleClassName = '', footer, children }: Props) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeButton = onClose && (
    <button type="button" aria-label="Yopish" onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><X size={14}/></button>
  )

  if (variant === 'center') {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div role="dialog" aria-label={title} className={`bg-white rounded-2xl w-full ${size === 'lg' ? 'max-w-lg' : 'max-w-md'} flex flex-col max-h-[92vh]`}>
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
            <div className={`font-black text-base ${titleClassName}`}>{title}</div>
            {closeButton}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
          {footer && <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">{footer}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div role="dialog" aria-label={title} className="bg-white rounded-t-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className={`font-black text-lg ${titleClassName}`}>{title}</div>
          {closeButton}
        </div>
        {children}
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  )
}
