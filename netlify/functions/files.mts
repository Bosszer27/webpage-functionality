import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import { eq, like } from 'drizzle-orm'
import { database } from '../../db/index.js'
import { vault } from '../../db/schema.js'
export default async (req: Request) => {
  if (!(await getUser())) return Response.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  try {
    const store = getStore({ name: 'vault-files', consistency: 'strong' })
    const db = database()
    const id = new URL(req.url).searchParams.get('id')
    if (id && !/^[a-zA-Z0-9-]{1,100}$/.test(id)) return new Response(null, { status: 400 })
    if (req.method === 'GET') {
      if (!id) {
        const rows = await db.select().from(vault).where(like(vault.key, 'file-%'))
        return Response.json(rows.map(row => row.value), { headers: { 'Cache-Control': 'no-store' } })
      }
      const data = await store.get('file-' + id, { type: 'arrayBuffer' }) as ArrayBuffer | null
      if (!data) return new Response(null, { status: 404 })
      const [row] = await db.select().from(vault).where(eq(vault.key, 'file-' + id))
      const meta = row?.value as { name: string } | undefined
      if (!meta) return new Response(null, { status: 404 })
      return new Response(new Blob([data]).stream(), { headers: { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`, 'X-Content-Type-Options': 'nosniff' } })
    }
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return new Response(null, { status: 403 })
    if (!id) return new Response(null, { status: 400 })
    if (req.method === 'DELETE') { await db.delete(vault).where(eq(vault.key, 'file-' + id)); await store.delete('file-' + id); return Response.json({ saved: true }) }
    if (req.method !== 'POST') return new Response(null, { status: 405 })
    const part = new URL(req.url).searchParams.get('part')
    if (part !== null) {
      if (!/^[0-3]$/.test(part)) return new Response(null, { status: 400 })
      const bytes = await req.arrayBuffer()
      if (bytes.byteLength > 3 * 1024 * 1024) return new Response(null, { status: 413 })
      await store.set('upload-' + id + '-' + part, bytes)
      return Response.json({ saved: true })
    }
    const input = await req.json()
    if (typeof input.name !== 'string' || input.name.length > 500 || !Number.isInteger(input.parts) || input.parts < 1 || input.parts > 4 || !Number.isInteger(input.size) || input.size < 0 || input.size > 10 * 1024 * 1024) return new Response(null, { status: 400 })
    const chunks: ArrayBuffer[] = []
    for (let i = 0; i < input.parts; i++) {
      const bytes = await store.get('upload-' + id + '-' + i, { type: 'arrayBuffer' }) as ArrayBuffer | null
      if (!bytes) return new Response(null, { status: 400 })
      chunks.push(bytes)
    }
    const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    if (size !== input.size || size > 10 * 1024 * 1024) return new Response(null, { status: 413 })
    const meta = { id, name: input.name, type: String(input.type || ''), size, date: Date.now() }
    const buffer = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { buffer.set(new Uint8Array(chunk), offset); offset += chunk.byteLength }
    await store.set('file-' + id, buffer.buffer)
    await db.insert(vault).values({ key: 'file-' + id, value: meta }).onConflictDoUpdate({ target: vault.key, set: { value: meta } })
    await Promise.all(chunks.map((_, i) => store.delete('upload-' + id + '-' + i)))
    return Response.json(meta)
  } catch { return Response.json({ error: 'จัดการไฟล์ไม่สำเร็จ กรุณาลองใหม่' }, { status: 503 }) }
}
