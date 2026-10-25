import { beforeEach, describe, expect, it, vi } from 'vitest'

const query = vi.hoisted(() => ({ result: { error: null } as { error: unknown } | Error }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        limit: () => ({
          abortSignal: () => (query.result instanceof Error ? Promise.reject(query.result) : Promise.resolve(query.result)),
        }),
      }),
    }),
  },
}))

import { GET } from './route'

describe('GET /api/health', () => {
  beforeEach(() => { query.result = { error: null } })

  it('baza javob bersa 200 va ok:true', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it("baza xato qaytarsa (masalan to'xtatilgan loyiha) 503", async () => {
    query.result = { error: { message: 'project is paused' } }
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: 'db_unreachable' })
  })

  it("tarmoq uzilsa 503 va xato matni chiqmaydi", async () => {
    query.result = new Error('fetch failed: secret-host.supabase.co')
    const res = await GET()
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toContain('secret-host')
  })
})
