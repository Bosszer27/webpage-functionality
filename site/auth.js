const $ = id => document.getElementById(id)
let mode = 'login', inviteToken = null, auth
function status(text, error = false) { $('authStatus').textContent = text; $('authStatus').classList.toggle('error', error) }
function setMode(next) {
  mode = next
  $('nameField').hidden = mode !== 'signup'
  $('name').required = mode === 'signup'
  $('emailField').hidden = ['reset', 'invite'].includes(mode)
  $('email').required = !$('emailField').hidden
  $('passwordField').hidden = mode === 'recovery'
  $('password').required = mode !== 'recovery'
  $('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password'
  $('password').value = ''
  const titles = { login: 'เข้าสู่พื้นที่ทำงาน', signup: 'สมัครเข้าร่วมคลัง', recovery: 'ขอลิงก์ตั้งรหัสผ่านใหม่', reset: 'ตั้งรหัสผ่านใหม่', invite: 'ตั้งรหัสผ่านเพื่อเข้าร่วม' }
  $('authTitle').textContent = titles[mode]
  $('authSubmit').textContent = { login: 'เข้าสู่ระบบ', signup: 'สมัครสมาชิก', recovery: 'ส่งลิงก์ทางอีเมล', reset: 'บันทึกรหัสผ่านใหม่', invite: 'เข้าร่วมคลัง' }[mode]
  $('authDescription').textContent = mode === 'signup' ? 'ตั้งชื่อที่แสดงให้เพื่อนร่วมทีมรู้จัก แล้วตรวจสอบอีเมลเพื่อยืนยันบัญชี' : mode === 'login' ? 'เข้าสู่ระบบเพื่อเปิดคลังและเครื่องมือของทีม' : 'ทำตามขั้นตอนเพื่อเข้าสู่พื้นที่ทำงานของคุณ'
  $('modeSwitch').hidden = ['reset', 'invite'].includes(mode)
  $('forgotPassword').hidden = mode !== 'login'
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)))
  status('')
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)))
$('forgotPassword').addEventListener('click', () => setMode('recovery'))
$('authForm').addEventListener('submit', async event => {
  event.preventDefault()
  if (!auth) { status('โหลดระบบสมาชิกไม่สำเร็จ กรุณาโหลดหน้านี้ใหม่', true); return }
  $('authSubmit').disabled = true
  status('กำลังดำเนินการ…')
  try {
    if (mode === 'signup') {
      const name = $('name').value.trim()
      if (!name) throw new Error('name')
      const user = await auth.signup($('email').value.trim(), $('password').value, { full_name: name })
      $('password').value = ''
      if (user.confirmedAt) location.replace('/work')
      else status('สมัครสมาชิกแล้ว กรุณาตรวจสอบอีเมลและกดลิงก์ยืนยันก่อนเข้าสู่ระบบ หากไม่พบให้ตรวจสอบโฟลเดอร์สแปม')
    } else if (mode === 'recovery') {
      await auth.requestPasswordRecovery($('email').value.trim())
      status('หากอีเมลนี้ลงทะเบียนไว้ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ กรุณาตรวจสอบกล่องจดหมายและสแปม')
    } else {
      if (mode === 'reset') await auth.updateUser({ password: $('password').value })
      else if (mode === 'invite') await auth.acceptInvite(inviteToken, $('password').value)
      else await auth.login($('email').value.trim(), $('password').value)
      $('password').value = ''
      location.replace('/work')
    }
  } catch (error) {
    const message = String(error.message || '')
    status(/confirm|verified/i.test(message) ? 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ โดยกดลิงก์ในอีเมลที่ได้รับ' : error.status === 401 || error.status === 400 ? 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน หรือลองขอลิงก์ใหม่' : error.status === 422 ? 'กรุณาตรวจสอบอีเมลและใช้รหัสผ่านที่ปลอดภัย หรือลองเข้าสู่ระบบหากสมัครแล้ว' : error.status === 429 ? 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' : 'ดำเนินการไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่ หากลิงก์หมดอายุให้ขอลิงก์ใหม่', true)
  } finally { $('authSubmit').disabled = false }
})
try {
  auth = await import('/auth-sdk.js')
  const callback = await auth.handleAuthCallback()
  if (callback?.type === 'recovery') setMode('reset')
  else if (callback?.type === 'invite') { inviteToken = callback.token; setMode('invite') }
  else if (await auth.getUser()) {
    await auth.refreshSession()
    const check = await fetch('/.netlify/functions/members', { signal: AbortSignal.timeout(15000) })
    if (check.ok) location.replace('/work')
    else status('กรุณาเข้าสู่ระบบเพื่อเปิดพื้นที่ทำงานอีกครั้ง')
  } else status('')
} catch { status('โหลดระบบสมาชิกหรือตรวจสอบลิงก์ไม่สำเร็จ กรุณาโหลดหน้าใหม่ หรือลองขอลิงก์ใหม่', true) }
