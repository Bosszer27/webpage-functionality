import { getUser } from '@netlify/identity'
import { readFile } from 'node:fs/promises'
import type { Config } from '@netlify/functions'
export default async (req: Request) => {
  const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' }
  if (!(await getUser())) return new Response(null, { status: 302, headers: { ...headers, Location: '/' } })
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response(null, { status: 405, headers })
  const html = await readFile(new URL('../../private/vault.html', import.meta.url), 'utf8').catch(() => readFile('private/vault.html', 'utf8'))
  return new Response(req.method === 'HEAD' ? null : html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } })
}
export const config: Config = { path: ['/work', '/work/'] }
