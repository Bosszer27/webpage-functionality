let auth, stopped = false, busy = false, warned = false
const session = crypto.randomUUID()
const $ = id => document.getElementById(id)
const bar = document.createElement('div')
bar.className = 'session-bar'
const greeting = document.createElement('span'); greeting.textContent = 'พื้นที่ทำงานสำหรับสมาชิก'
const logout = document.createElement('button'); logout.className = 'btn-secondary'; logout.textContent = 'ออกจากระบบ'; logout.type = 'button'
bar.append(greeting, logout); document.querySelector('main').prepend(bar)
function expired() {
  if (warned) return
  warned = true; stopped = true
  const overlay = document.createElement('div'); overlay.className = 'session-warning'; overlay.setAttribute('role', 'alert')
  const box = document.createElement('div'), title = document.createElement('h2'), text = document.createElement('p'), link = document.createElement('a')
  title.textContent = 'กรุณาเข้าสู่ระบบอีกครั้ง'
  text.textContent = 'การเข้าสู่ระบบสิ้นสุดแล้ว หากมีรายการรอบันทึก ให้เปิดหน้าเข้าสู่ระบบในแท็บใหม่ แล้วกลับมากดลองบันทึกอีกครั้งก่อนโหลดหน้านี้ใหม่'
  link.href = '/'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'เปิดหน้าเข้าสู่ระบบ'
  const resume = document.createElement('button'); resume.className = 'btn-secondary'; resume.textContent = 'เข้าสู่ระบบแล้ว · เชื่อมต่ออีกครั้ง'
  resume.onclick = async () => { if (await auth?.getUser()) { warned = false; stopped = false; overlay.remove(); window.VaultCloud?.retry(); heartbeat() } }
  box.append(title, text, link, document.createElement('br'), resume); overlay.append(box); document.body.append(overlay)
}
window.addEventListener('vault-session-expired', expired)
async function heartbeat() {
  if (stopped || busy || document.hidden) return
  busy = true
  try {
    if (auth) { await auth.getUser(); await auth.refreshSession() } // Refresh before authenticated requests when needed.
    const response = await fetch('/.netlify/functions/members?session=' + session, { method: 'POST', signal: AbortSignal.timeout(15000) })
    if (response.status === 401) { expired(); return }
    if (!response.ok) throw new Error('members')
    const data = await response.json()
    $('memberSummary').textContent = 'สมาชิกทั้งหมด ' + data.members.length + ' คน · ออนไลน์ ' + data.members.filter(m => m.online).length + ' คน'
    const cards = data.members.map(person => {
      const card = document.createElement('div'); card.className = 'member-card'
      const avatar = document.createElement('span'); avatar.className = 'member-avatar'; avatar.textContent = Array.from(person.name)[0] || '•'; avatar.setAttribute('aria-hidden', 'true')
      const detail = document.createElement('div'), name = document.createElement('div'), state = document.createElement('span')
      name.className = 'member-name'; name.textContent = person.name + (person.id === data.me ? ' (คุณ)' : '')
      state.className = 'member-state' + (person.online ? ' online' : ''); state.textContent = person.online ? '● ออนไลน์' : '○ ออฟไลน์'
      detail.append(name, state); card.append(avatar, detail); return card
    })
    $('memberList').replaceChildren(...cards)
  } catch { $('memberSummary').textContent = 'อัปเดตสถานะสมาชิกไม่สำเร็จ · รายชื่อด้านล่างอาจไม่เป็นปัจจุบัน กดรีเฟรชเพื่อลองใหม่' }
  finally { busy = false }
}
logout.onclick = async () => {
  logout.disabled = true
  try {
    await window.VaultCloud?.flush()
    if (window.VaultCloud?.pending) { alert('ยังมีรายการรอบันทึก กรุณากดลองบันทึกอีกครั้งก่อนออกจากระบบ'); return }
    if (!auth) throw new Error('auth')
    stopped = true
    await fetch('/.netlify/functions/members?session=' + session, { method: 'DELETE' }).catch(() => {})
    await auth.logout()
    location.replace('/')
  } catch { stopped = false; alert('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่') }
  finally { logout.disabled = false }
}
$('refreshMembers').onclick = heartbeat
document.addEventListener('visibilitychange', () => { if (!document.hidden) heartbeat() })
window.addEventListener('pageshow', event => { if (event.persisted) location.reload() })
try {
  auth = await import('/auth-sdk.js')
  const user = await auth.getUser()
  if (!user) expired()
  else greeting.textContent = 'สวัสดี ' + (user.name || 'สมาชิก') + ' · ใช้คลังและเครื่องมือร่วมกับทีม'
  auth.onAuthChange((event) => { if (event === 'logout') expired() })
} catch { greeting.textContent = 'โหลดระบบสมาชิกไม่สำเร็จ กรุณาโหลดหน้าใหม่ก่อนออกจากระบบ' }
heartbeat()
setInterval(heartbeat, 30000)
