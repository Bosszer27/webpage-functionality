import { getUser } from '@netlify/identity'
import * as cheerio from 'cheerio'
import type {} from '@netlify/functions'
import { z } from 'zod'

function hasCode(text: string, code: string) {
  return (
    text
      .toUpperCase()
      .match(/[A-Z0-9]+(?:-[A-Z0-9]+)+/g)
      ?.includes(code) ?? false
  )
}

async function readPage(url: string, signal: AbortSignal) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(new URL(url).hostname === 'www.javbus.com'
        ? { Cookie: 'existmag=all; age=verified; dv=1' }
        : {}),
    },
    signal,
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('upstream')
  const html = await res.text()
  if (/Just a moment|cf-chl-|Checking your browser/i.test(html))
    throw new Error('blocked')
  return cheerio.load(html)
}

async function lookup(
  code: string,
  source: 'JavBus' | 'JavGuru',
  signal: AbortSignal,
) {
  const base =
    source === 'JavBus' ? 'https://www.javbus.com' : 'https://jav.guru'
  let url = `${base}/${encodeURIComponent(code)}`
  if (source === 'JavGuru') {
    const search = await readPage(
      `${base}/?s=${encodeURIComponent(code)}`,
      signal,
    )
    if (!search) return null
    const link = search('h2 a, h3 a, .entry-title a')
      .toArray()
      .find((a) => hasCode(search(a).text(), code))
    const href = link && search(link).attr('href')
    if (!href) return null
    url = new URL(href, base).href
    if (new URL(url).origin !== base) return null
  }
  const page = await readPage(url, signal)
  if (!page) return null
  const $ = page
  const title = (
    source === 'JavBus'
      ? $('h3').first().text()
      : $('h1.entry-title, h1').first().text()
  ).trim()
  if (!hasCode(title, code)) return null
  function field(labels: RegExp) {
    const p = $('.info p, .info li')
      .toArray()
      .find((el) =>
        labels.test($(el).find('.header, b, strong').first().text().trim()),
      )
    if (!p) return ''
    const copy = $(p).clone()
    copy.find('.header, b, strong').first().remove()
    return copy.text().replace(/\s+/g, ' ').trim()
  }
  function image(src?: string) {
    if (!src) return ''
    try {
      const u = new URL(src, url)
      return /^https?:$/.test(u.protocol) ? u.href : ''
    } catch {
      return ''
    }
  }
  const actors = $(
    '.star-name a, .star-name, .info a[href*="/star/"], .info a[href*="/actress/"]',
  )
    .toArray()
    .map((e) => $(e).text().trim())
    .filter(Boolean)
  const poster = image(
    $('a.bigImage').attr('href') ||
      $('meta[property="og:image"]').attr('content') ||
      $('.entry-content img').first().attr('src'),
  )
  return {
    code,
    title,
    actors: [...new Set(actors)],
    actor: [...new Set(actors)].join(', '),
    studio: field(/製作商|制作商|メーカー|Studio/i),
    release_date: field(/發行日期|发行日期|発売日|Release/i),
    duration: field(/長度|长度|収録時間|Length|Duration/i),
    tags: $('.genre a, a[rel="tag"]')
      .toArray()
      .map((e) => $(e).text().trim())
      .filter(Boolean)
      .join(', '),
    poster_url: poster,
    cover_url: poster,
    gallery_urls: $('a.sample-box')
      .toArray()

      .map((e) => image($(e).attr('href')))
      .filter(Boolean),
    source,
    source_url: url,
    status: 'found',
  }
}

async function lookupJavCT(code: string, signal: AbortSignal) {
  const url = `https://javct.net/v/${encodeURIComponent(code.toLowerCase())}`
  const page = await readPage(url, signal)
  if (!page) return null
  const $ = page
  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    ''
  if (!hasCode(title, code)) return null
  const clean = (value: string) => value.replace(/\s+/g, ' ').trim()
  function field(label: RegExp) {
    const candidates = $(
      '#tab-info th, #tab-info dt, #tab-info b, #tab-info strong, #tab-info span, #tab-info div, #tab-info label, #tab-info p, #tab-info li',
    ).toArray()
    for (const element of candidates) {
      const node = $(element)
      if (!label.test(clean(node.text()))) continue
      const sibling = clean(node.next().text())
      if (sibling) return sibling
      const parent = node.parent().clone()
      parent
        .find('*')
        .filter((_, child) => label.test(clean($(child).text())))
        .remove()
      const value = clean(parent.text())
      if (value) return value
    }
    // Also support plain text information blocks with one label per line.
    const lines = $('#tab-info').text().split(/\n/).map(clean).filter(Boolean)
    const index = lines.findIndex((line) => label.test(line))
    return index >= 0 ? lines[index + 1] || '' : ''
  }
  function image(value?: string) {
    if (!value) return ''
    try {
      const parsed = new URL(value, url)
      return /^https?:$/.test(parsed.protocol) ? parsed.href : ''
    } catch {
      return ''
    }
  }
  const actors = field(/^Models?\(s\):?$|^Models?:?$/i)
    .split(/,|\n/)
    .map(clean)
    .filter(Boolean)
  const categories = field(/^Categories:?$/i)
  const poster = image($('meta[property="og:image"]').attr('content'))
  return {
    code,
    title,
    actors,
    actor: actors.join(', '),
    studio: field(/^Studio:?$/i),
    label: field(/^Label:?$/i),
    duration: field(/^Running time:?$/i),
    release_date: field(/^Release Date:?$/i),
    categories,
    tags: categories,
    poster_url: poster,
    cover_url: poster,
    gallery_urls: [
      ...new Set(
        $('#tab-gallery a[href], #tab-gallery img')
          .filter(
            (_, element) =>
              $(element).is('a') || !$(element).closest('a[href]').length,
          )
          .toArray()
          .map((element) => {
            const node = $(element)
            return image(
              node.is('a')
                ? node.attr('href')
                : node.attr('data-src') || node.attr('src'),
            )
          })
          .filter(Boolean),
      ),
    ],
    source: 'JAVCT',
    source_url: url,
    status: 'found',
  }
}

function safeUrl(value: string | undefined, base?: string) {
  if (!value) return ''
  try {
    const url = new URL(value, base)
    return /^https?:$/.test(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

async function lookupAvWiki(code: string, signal: AbortSignal) {
  const url = `https://av-wiki.net/${encodeURIComponent(code.toLowerCase())}/`
  const page = await readPage(url, signal)
  if (!page) return null
  const $ = page
  const details = $('main article.article .article-body dl.dltable').first()
  function field(label: string) {
    const key = details
      .find('dt')
      .toArray()
      .find((el) => $(el).text().trim() === label)
    return key ? $(key).next('dd').text().trim() : ''
  }
  // Related products and search headings are never proof of an exact match.
  if (field('メーカー品番').toUpperCase() !== code) return null
  const thumbnail = $('main article.article .article-thumbnail img').first()
  const title =
    thumbnail.attr('alt')?.trim() ||
    $('main article.article .blockquote-like').first().text().trim()
  if (!title) return null
  const actors = details
    .find('dt')
    .filter((_, el) => $(el).text().trim() === 'AV女優名')
    .next('dd')
    .find('a')
    .toArray()
    .map((el) => $(el).text().trim())
    .filter(Boolean)
  const actor = actors.length ? actors.join(', ') : field('AV女優名')
  const poster = safeUrl(
    thumbnail.attr('data-src') || thumbnail.attr('src'),
    url,
  )
  return {
    code,
    title,
    actors: actors.length ? actors : actor ? [actor] : [],
    actor,
    studio: field('メーカー'),
    label: field('レーベル'),
    release_date: field('配信開始日'),
    duration: '',
    tags: '',
    poster_url: poster,
    cover_url: poster,
    gallery_urls: [],
    source: 'AV-Wiki',
    source_url: url,
    status: 'found',
  }
}

function fanzaCredentials() {
  if (typeof Netlify === 'undefined') return null
  const apiId = Netlify.env.get('FANZA_API_ID')
  const affiliateId = Netlify.env.get('FANZA_AFFILIATE_ID')
  return apiId && affiliateId ? { apiId, affiliateId } : null
}

async function lookupFanza(
  code: string,
  credentials: { apiId: string; affiliateId: string },
  signal: AbortSignal,
) {
  const url = new URL('https://api.dmm.com/affiliate/v3/ItemList')
  url.search = new URLSearchParams({
    api_id: credentials.apiId,
    affiliate_id: credentials.affiliateId,
    site: 'FANZA',
    service: 'digital',
    floor: 'videoa',
    keyword: code,
    hits: '100',
    output: 'json',
  }).toString()
  const response = await fetch(url.href, { signal })
  if (!response.ok) throw new Error('fanza_unavailable')
  const named = z.object({ name: z.string() })
  const payload = z
    .object({
      result: z.object({
        status: z.union([z.string(), z.number()]),
        items: z
          .array(
            z.object({
              content_id: z.string(),
              title: z.string(),
              URL: z.string().optional(),
              date: z.string().optional(),
              volume: z.string().optional(),
              imageURL: z.object({ large: z.string().optional() }).optional(),
              sampleImageURL: z
                .object({
                  sample_l: z
                    .object({
                      image: z.array(z.string()).optional(),
                    })
                    .optional(),
                })
                .optional(),
              iteminfo: z
                .object({
                  actress: z.array(named).optional(),
                  maker: z.array(named).optional(),
                  label: z.array(named).optional(),
                  genre: z.array(named).optional(),
                })
                .optional(),
            }),
          )
          .optional(),
      }),
    })
    .parse(await response.json())
  if (String(payload.result.status) !== '200')
    throw new Error('fanza_unavailable')
  const [prefix, number] = code.split('-')
  const item = payload.result.items?.find((item) => {
    const id = item.content_id.match(/^(?:[0-9]+)?([a-z]+)0*([0-9]+)$/i)
    return (
      id &&
      id[1].toUpperCase() === prefix &&
      id[2].replace(/^0+/, '') === number.replace(/^0+/, '')
    )
  })
  if (!item || !item.title.trim()) return null
  const actors = item.iteminfo?.actress?.map((actor) => actor.name) || []
  const poster = safeUrl(item.imageURL?.large)
  return {
    code,
    title: item.title,
    actors,
    actor: actors.join(', '),
    studio: item.iteminfo?.maker?.map((maker) => maker.name).join(', ') || '',
    label: item.iteminfo?.label?.map((label) => label.name).join(', ') || '',
    release_date: item.date?.split(' ')[0] || '',
    duration: item.volume || '',
    tags: item.iteminfo?.genre?.map((genre) => genre.name).join(', ') || '',
    poster_url: poster,
    cover_url: poster,
    gallery_urls: (item.sampleImageURL?.sample_l?.image || [])
      .map((image) => safeUrl(image))
      .filter(Boolean),
    source: 'FANZA',
    source_url: safeUrl(item.URL),
    status: 'found',
  }
}

export default async (req: Request) => {
  if (!(await getUser())) return Response.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  if (!['GET', 'POST'].includes(req.method))
    return Response.json(
      { error: 'ไม่รองรับวิธีนี้', status: 'error' },
      { status: 405, headers: { Allow: 'GET, POST' } },
    )
  let code: string
  let complete: boolean
  try {
    const body = req.method === 'POST' ? await req.json() : null
    complete =
      body?.complete === true ||
      new URL(req.url).searchParams.get('complete') === 'true'
    const raw =
      req.method === 'POST'
        ? body?.code
        : new URL(req.url).searchParams.get('code')
    code =
      typeof raw === 'string'
        ? raw
            .normalize('NFKC')
            .trim()
            .toUpperCase()
            .replace(/[‐‑‒–—−ー]/g, '-')
            .replace(/\s+/g, '')
            .replace(/^([A-Z]+)-?(\d+)$/, '$1-$2')
        : ''
  } catch {
    return Response.json(
      { error: 'ข้อมูลคำขอไม่ถูกต้อง', status: 'error' },
      { status: 400 },
    )
  }
  if (!/^[A-Z0-9]{2,20}-[A-Z0-9]{1,15}$/.test(code))
    return Response.json(
      { code, error: 'กรุณาระบุรหัส เช่น START-353', status: 'error' },
      { status: 400 },
    )
  // All sources share one deadline, leaving time for Netlify to send the response.
  const signal = AbortSignal.timeout(24000)
  // Return a matching result immediately; a slow fallback must not delay success.
  const credentials = fanzaCredentials()
  const sources = [
    'AV-Wiki',
    'JAVCT',
    'JavBus',
    'JavGuru',
    ...(credentials ? ['FANZA'] : []),
  ]
  const attempts = [
    lookupAvWiki(code, signal),
    lookupJavCT(code, signal),
    lookup(code, 'JavBus', signal),
    lookup(code, 'JavGuru', signal),
    ...(credentials ? [lookupFanza(code, credentials, signal)] : []),
  ]
  const fanza = credentials ? 'enabled' : 'not_configured'
  if (complete) {
    const outcomes = await Promise.allSettled(attempts)
    const matches = outcomes.flatMap((outcome) =>
      outcome.status === 'fulfilled' && outcome.value ? [outcome.value] : [],
    )
    if (matches.length) {
      const merged = { ...matches[0] }
      const fields = [
        'title',
        'actor',
        'studio',
        'release_date',
        'duration',
        'tags',
        'poster_url',
        'cover_url',
      ] as const
      for (const match of matches.slice(1)) {
        for (const key of fields)
          if (!merged[key] && match[key]) merged[key] = match[key]
      }
      merged.gallery_urls = [
        ...new Set(matches.flatMap((match) => match.gallery_urls)),
      ]
      const missing = [
        'title',
        'actor',
        'studio',
        'duration',
        'release_date',
        'poster_url',
      ].filter((key) => !merged[key as keyof typeof merged])
      return Response.json({
        ...merged,
        fanza,
        sources: matches.map((match) => ({
          source: match.source,
          url: match.source_url,
        })),
        missing_fields: missing,
        unavailable_sources: outcomes.flatMap((outcome, index) =>
          outcome.status === 'rejected' ? [sources[index]] : [],
        ),
        searched_at: new Date().toISOString(),
      })
    }
  }
  try {
    const found = await Promise.any(
      attempts.map(async (attempt) => {
        const result = await attempt
        if (!result) throw new Error('not_found')
        return result
      }),
    )
    return Response.json({ ...found, fanza })
  } catch {
    // Inspect outcomes only when no source found the requested code.
  }
  const outcomes = await Promise.allSettled(attempts)
  const unavailable = outcomes.some((outcome) => outcome.status === 'rejected')
  return Response.json(
    {
      code,
      status: unavailable ? 'error' : 'not_found',
      fanza,
      error: unavailable
        ? `แหล่งข้อมูลเข้าไม่ได้ (${outcomes.flatMap((outcome, index) => (outcome.status === 'rejected' ? [sources[index]] : [])).join(', ')}) จึงยังยืนยันไม่ได้ว่าไม่มีรหัสนี้ แม้เปิดเว็บต้นทางในเบราว์เซอร์ได้`
        : 'ไม่พบรหัสนี้ในแหล่งข้อมูลที่ค้นได้',
    },
    { status: unavailable ? 502 : 200 },
  )
}
