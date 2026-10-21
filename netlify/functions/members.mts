import { getUser } from '@netlify/identity'
import { and, eq, lt } from 'drizzle-orm'
import { database } from '../../db/index.js'
import { members, sessions } from '../../db/schema.js'

export default async (req: Request) => {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
  const user = await getUser()
  if (!user) return Response.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401, headers })
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return new Response(null, { status: 405, headers })
  if (req.method !== 'GET' && req.headers.get('origin') !== new URL(req.url).origin) return new Response(null, { status: 403, headers })
  try {
    const db = database()
    if (req.method !== 'GET') {
      const id = new URL(req.url).searchParams.get('session') || ''
      if (!/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 400, headers })
      if (req.method === 'DELETE') {
        await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.memberId, user.id)))
        return Response.json({ saved: true }, { headers })
      }
      const name = (user.name || 'สมาชิก').slice(0, 100)
      await db.insert(members).values({ id: user.id, name }).onConflictDoUpdate({ target: members.id, set: { name } })
      await db.insert(sessions).values({ id, memberId: user.id, seenAt: new Date() }).onConflictDoUpdate({ target: sessions.id, set: { seenAt: new Date() }, setWhere: eq(sessions.memberId, user.id) })
      await db.delete(sessions).where(lt(sessions.seenAt, new Date(Date.now() - 86400000)))
    }
    const [people, presence] = await Promise.all([db.select().from(members).orderBy(members.joinedAt), db.select().from(sessions)])
    const active = new Set(presence.filter(s => s.seenAt.getTime() > Date.now() - 90000).map(s => s.memberId))
    return Response.json({ me: user.id, members: people.map(p => ({ id: p.id, name: p.name, online: active.has(p.id) })) }, { headers })
  } catch {
    return Response.json({ error: 'โหลดรายชื่อสมาชิกไม่สำเร็จ กรุณาลองใหม่' }, { status: 503, headers })
  }
}
