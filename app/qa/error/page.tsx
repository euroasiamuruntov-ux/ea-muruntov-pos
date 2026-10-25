import { notFound } from 'next/navigation'

// Faqat sinov uchun: xatolik ekrani (app/error.tsx) ishlashini tekshirish. Jonli (production) saytda mavjud emas.
export default function QaErrorPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  throw new Error('Sinov xatosi')
}
