import { getUser } from '@netlify/identity'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

async function allowed(url: URL) {
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) || !host.includes('.') || host.endsWith('.local')) return false
  const addresses = await lookup(host, { all: true })
  return addresses.length > 0 && addresses.every(({ address, family }) => {
    if (family !== 4) return false
    const [a, b] = address.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)))
  })
}
export default async (req: Request) => {
  if (!(await getUser())) return Response.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  if (req.method !== 'GET') return new Response(null, { status: 405 })
  try {
    let url = new URL(new URL(req.url).searchParams.get('url') || '')
    for (let i = 0; i < 4; i++) {
      if (!(await allowed(url))) return new Response(null, { status: 400 })
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12000) })
      if ([301, 302, 303, 307, 308].includes(response.status)) { url = new URL(response.headers.get('location') || '', url); continue }
      const type = response.headers.get('content-type') || ''
      if (!response.ok || !/^image\/(jpeg|png|webp|gif|avif)(;|$)/i.test(type)) return new Response(null, { status: 422 })
      if (Number(response.headers.get('content-length')) > 4 * 1024 * 1024) return new Response(null, { status: 413 })
      const reader = response.body!.getReader(), chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const result = await reader.read()
        if (result.done) break
        size += result.value.byteLength
        if (size > 4 * 1024 * 1024) { await reader.cancel(); return new Response(null, { status: 413 }) }
        chunks.push(result.value)
      }
      const data = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length }
      return new Response(data, { headers: { 'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
    }
    return new Response(null, { status: 422 })
  } catch { return new Response(null, { status: 502 }) }
}
