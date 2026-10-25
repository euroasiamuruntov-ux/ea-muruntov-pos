import { describe, expect, it } from 'vitest'
import { matchesQuery, normalize } from './search'

describe('qidiruv', () => {
  it("bo'sh so'rov hammasini topadi", () => {
    expect(matchesQuery('Osh (butun)', '')).toBe(true)
    expect(matchesQuery('Osh (butun)', '   ')).toBe(true)
  })
  it("katta-kichik harf farq qilmaydi", () => {
    expect(matchesQuery('Somsa', 'SOM')).toBe(true)
  })
  it("so'zlar tartibsiz va qisman yozilishi mumkin", () => {
    expect(matchesQuery('Osh (butun)', 'osh but')).toBe(true)
    expect(matchesQuery('Osh (butun)', 'butun osh')).toBe(true)
    expect(matchesQuery('Osh (yarim)', 'osh but')).toBe(false)
  })
  it('apostrof turlari farq qilmaydi', () => {
    expect(matchesQuery("Go'sht", 'gosht')).toBe(true)
    expect(matchesQuery('Goʻsht', "go'sht")).toBe(true)
  })
  it('topilmasa false', () => {
    expect(matchesQuery('Cola 1L', 'choy')).toBe(false)
  })
  it('normalize', () => {
    expect(normalize("  Osh   (Butun) ")).toBe('osh butun')
  })
})
