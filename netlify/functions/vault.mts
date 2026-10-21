import { getUser } from '@netlify/identity'
import { eq, like } from 'drizzle-orm'
import { database } from '../../db/index.js'
import { vault } from '../../db/schema.js'
import { z } from 'zod'

const keySchema = z.string().regex(/^vault_(launchers|links|prompts|plugins|teams|seo_kw|seo_check|movies|posts|collector|seeded_v[4-7]|seeded_collector)$/)
const mutation = z.object({ key: keySchema, value: z.unknown().optional(), upserts: z.array(z.record(z.string(), z.unknown())).max(10000).optional(), removed: z.array(z.string()).max(10000).optional() })
export default async (req: Request) => {
  if (!(await getUser())) return Response.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  try {
    const db = database()
    if (req.method === 'GET') {
      const rows = await db.select().from(vault).where(like(vault.key, 'vault_%'))
      return Response.json(Object.fromEntries(rows.map(r => [r.key, r.value])), { headers: { 'Cache-Control': 'no-store' } })
    }
    if (req.method !== 'POST') return new Response(null, { status: 405 })
    if ((req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) || !req.headers.get('content-type')?.includes('application/json')) return new Response(null, { status: 403 })
    const text = await req.text()
    if (text.length > 4_000_000) return new Response(null, { status: 413 })
    const input = mutation.parse(JSON.parse(text))
    if (input.key.includes('seeded_') ? typeof input.value !== 'boolean' : !input.upserts) return new Response(null, { status: 400 })
    await db.transaction(async tx => {
      await tx.insert(vault).values({ key: input.key, value: [] }).onConflictDoNothing()
      const [row] = await tx.select().from(vault).where(eq(vault.key, input.key)).for('update')
      let value = input.value
      if (input.upserts) {
        if (!input.upserts.every(item => typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(item.id))) throw new Error('invalid')
        const removed = new Set(input.removed || [])
        const updates = new Map(input.upserts.map(item => [item.id, item]))
        const current = Array.isArray(row.value) ? row.value as Record<string, unknown>[] : []
        value = current.filter(item => !removed.has(String(item.id))).map(item => {
          const update = updates.get(item.id)
          updates.delete(item.id)
          return update || item
        })
        value = [...updates.values(), ...(value as unknown[])]
      }
      if (value === undefined) throw new Error('invalid')
      await tx.update(vault).set({ value }).where(eq(vault.key, input.key))
    })
    return Response.json({ saved: true })
  } catch (error) {
    return Response.json({ error: 'บันทึกหรือโหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่' }, { status: error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503 })
  }
}
