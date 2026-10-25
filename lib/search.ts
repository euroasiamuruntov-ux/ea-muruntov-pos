// Taom nomi bo'yicha qidiruv: katta-kichik harf, apostrof turlari va ortiqcha bo'shliq e'tiborga olinmaydi.
// "osh but" -> "Osh (butun)" ni topadi; "gʻ/g'/g" farqi ham sezilmaydi.

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻʼ'’‘`´]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesQuery(name: string, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  const n = normalize(name)
  return q.split(' ').every(part => n.includes(part))
}
