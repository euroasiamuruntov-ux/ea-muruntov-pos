export type CloseRow = { name: string; system_qty: number; actual_qty: number; diff: number; note: string }

/** Kassir smenani yopganda beriladigan hisobot (tizim qoldig'i, sanalgan qoldiq, farq, izoh). jsPDF kerak bo'lganda yuklanadi. */
export async function downloadCloseShiftPdf(openedAt: string, rows: CloseRow[]) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  let y = 20
  const hm = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const now = new Date()
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('EA MURUNTOV - Smena Hisoboti', 105, y, { align: 'center' }); y += 10
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(`Sana: ${now.toLocaleDateString('ru-RU')}`, 105, y, { align: 'center' }); y += 6
  doc.text(`Smena: ${hm(new Date(openedAt))} - ${hm(now)}`, 105, y, { align: 'center' }); y += 10
  doc.setLineWidth(0.5); doc.line(20, y, 190, y); y += 8
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Mahsulot hisobi:', 20, y); y += 8
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setFillColor(240, 240, 240); doc.rect(20, y - 4, 170, 8, 'F')
  doc.text('Mahsulot', 22, y); doc.text('Tizim', 110, y); doc.text('Haqiqiy', 130, y); doc.text('Farq', 155, y); y += 8
  doc.setFont('helvetica', 'normal')
  rows.forEach(r => {
    if (y > 265) { doc.addPage(); y = 20 }
    if (r.diff !== 0) doc.setTextColor(180, 50, 50); else doc.setTextColor(0, 0, 0)
    doc.text(r.name.slice(0, 35), 22, y); doc.text(String(r.system_qty), 115, y); doc.text(String(r.actual_qty), 135, y)
    doc.text(r.diff === 0 ? '-' : (r.diff > 0 ? '+' : '') + String(r.diff), 158, y)
    if (r.note) { y += 5; doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text(`  Izoh: ${r.note}`, 22, y); doc.setFontSize(9); doc.setTextColor(0, 0, 0) }
    doc.setTextColor(0, 0, 0); y += 7
  })
  doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.text('Zarafshon Dasturchilari | EA Muruntov POS', 105, 285, { align: 'center' })
  doc.save(`smena-hisobot-${now.toLocaleDateString('ru-RU').replace(/\./g, '-')}-${hm(now).replace(':', '-')}.pdf`)
}
