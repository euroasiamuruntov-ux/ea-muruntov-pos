import { fmt } from './format'
import { formatEquivalents, formatKg, formatPortions, portionLabel, type OshProduct } from './osh'
import type { ShiftReport } from './report'

/** Rahbar uchun smena hisoboti PDF. jsPDF og'ir, shuning uchun faqat kerak bo'lganda yuklanadi. */
export async function downloadShiftPdf(report: ShiftReport, oshList: OshProduct[]) {
  const { default: jsPDF } = await import('jspdf')
  const { pay, osh, rows } = report
  const doc = new jsPDF()
  let y = 20
  doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text('EA MURUNTOV - Smena Hisoboti', 105, y, { align: 'center' }); y += 10
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(`Sana: ${new Date().toLocaleDateString('ru-RU')}`, 105, y, { align: 'center' }); y += 8
  doc.setLineWidth(0.5); doc.line(20, y, 190, y); y += 8
  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.text('Moliyaviy korsatkichlar:', 20, y); y += 8
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  const stats = [
    ['Jami buyurtmalar:', `${report.orderCount} ta`],
    ['Haqiqiy tushum:', `${fmt(pay.actual)} som`],
    ['Naqd:', `${fmt(pay.cash)} som`],
    ['Click:', `${fmt(pay.click)} som`],
    ['Karta:', `${fmt(pay.card)} som`],
    ['Qarz:', `${fmt(pay.debt)} som`],
    ['Ichki istemol:', `${report.ichkiOrders.length} ta`],
  ]
  stats.forEach(([l, v]) => { doc.text(l, 25, y); doc.text(v, 140, y); y += 7 })
  y += 4; doc.line(20, y, 190, y); y += 8
  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.text('Mahsulot hisobi:', 20, y); y += 8
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text('Mahsulot', 20, y); doc.text('Boshl.', 90, y); doc.text('Kirim', 110, y)
  doc.text('Sotildi', 130, y); doc.text('Chiqim', 150, y); doc.text('Qoldiq', 170, y); y += 6
  rows.forEach(p => {
    if (y > 270) { doc.addPage(); y = 20 }
    doc.text(p.name.slice(0, 30), 20, y)
    doc.text(String(p.initial), 92, y); doc.text(String(p.stockIn), 112, y)
    doc.text(String(p.sold), 132, y); doc.text(String(p.writeOff), 152, y)
    doc.text(String(p.remaining), 172, y); y += 6
  })
  if (osh.hasActivity) {
    y += 4
    if (y > 250) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text('Osh (umumiy qozon):', 20, y); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    const kgOf = (h: number) => formatKg(h, oshList)
    const label = (id: string, name: string) => portionLabel(oshList.find(o => o.id === id) || { id, name })
    const lines = [
      `Boshlangich: ${kgOf(osh.initial)} | Kirim: +${kgOf(osh.kirimHissa)} (= ${formatEquivalents(osh.kirimHissa, oshList)}) | Qoshimcha tayyorlangan (avto): +${kgOf(osh.auto)}`,
      `Sotildi: -${kgOf(osh.soldHissa)}${osh.sold.length ? ' (' + osh.sold.map(x => `${x.qty} ${label(x.id, x.name)}`).join(' + ') + ')' : ''} | Chiqim: -${kgOf(osh.writeOff)}`,
      `Qoldiq: ${kgOf(osh.remaining)} (= ${formatEquivalents(osh.remaining, oshList)})`,
    ]
    if (osh.unexplained !== 0) {
      lines.push(`Hisobda farq: ${osh.unexplained > 0 ? '+' : '-'}${kgOf(Math.abs(osh.unexplained))} (${formatPortions(Math.abs(osh.unexplained), oshList)}) - tizimga yozilmagan`)
    }
    lines.forEach(l => { doc.text(l.slice(0, 110), 22, y); y += 5 })
  }
  doc.setFontSize(8); doc.setTextColor(150)
  doc.text('Zarafshon Dasturchilari | EA Muruntov POS', 105, 285, { align: 'center' })
  doc.save(`ea-muruntov-${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.pdf`)
}
