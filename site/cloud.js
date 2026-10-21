/* A transient view of database state; all writes go to the shared server. */
window.VaultCloud = (() => {
  let state = {}, queue = [], running = false, failed = false
  const status = () => document.getElementById('cloudStatus')
  function show(message, error = false) {
    status().textContent = message
    status().style.color = error ? '#b91c1c' : '#297a2e'
    document.getElementById('retrySave').hidden = !error
  }
  async function request(url, options) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) })
    if (response.status === 401) { window.dispatchEvent(new Event('vault-session-expired')); throw new Error('session_expired') }
    if (!response.ok) throw new Error('request_failed')
    return response.json()
  }
  async function drain() {
    if (running) return
    running = true; failed = false
    while (queue.length) {
      show('กำลังบันทึกบนคลาวด์ · เหลือ ' + queue.length + ' รายการ')
      try {
        await request('/.netlify/functions/vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(queue[0]) })
        queue.shift()
      } catch (_) {
        failed = true
        show('ยังบันทึกไม่สำเร็จ · อย่าปิดหน้านี้ กดลองอีกครั้ง', true)
        break
      }
    }
    running = false
    if (!failed) show('บันทึกบนคลาวด์แล้ว · คลังร่วม')
  }
  function set(key, value) {
    const old = state[key]
    const snapshot = structuredClone(value)
    let patch = { key, value: snapshot }
    if (Array.isArray(value) && value.every(x => x && typeof x.id === 'string')) {
      const previous = Array.isArray(old) ? old : []
      const before = new Map(previous.map(x => [x.id, JSON.stringify(x)]))
      const ids = new Set(value.map(x => x.id))
      patch = { key, upserts: snapshot.filter(x => before.get(x.id) !== JSON.stringify(x)), removed: previous.filter(x => !ids.has(x.id)).map(x => x.id) }
    }
    state[key] = snapshot
    queue.push(patch)
    drain()
  }
  window.addEventListener('beforeunload', event => { if (queue.length) { event.preventDefault(); event.returnValue = '' } })
  window.addEventListener('online', drain)
  return {
    async init() { state = await request('/.netlify/functions/vault'); show('เชื่อมต่อคลังร่วมแล้ว'); },
    get(key, fallback) { return structuredClone(state[key] == null ? fallback : state[key]) },
    set, retry: drain, request,
    get pending() { return queue.length },
    async flush() { while (running) await new Promise(resolve => setTimeout(resolve, 100)); if (queue.length && !failed) await drain(); },
    async upload(file, id) {
      const chunkSize = 3 * 1024 * 1024, parts = Math.max(1, Math.ceil(file.size / chunkSize))
      for (let i = 0; i < parts; i++) await request('/.netlify/functions/files?id=' + id + '&part=' + i, { method: 'POST', body: file.slice(i * chunkSize, (i + 1) * chunkSize) })
      return request('/.netlify/functions/files?id=' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, type: file.type, size: file.size, parts }) })
    }
  }
})()
