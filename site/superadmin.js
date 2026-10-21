window.SuperAdmin = (() => {
  const SUPER_ADMIN_EMAIL = 'm0939712157@gmail.com'

  async function getCurrentUser() {
    try {
      const auth = await import('/auth-sdk.js')
      return await auth.getUser()
    } catch {
      return null
    }
  }

  async function isSuperAdmin() {
    const user = await getCurrentUser()
    if (!user) return false

    const email = String(user.email || '').trim().toLowerCase()
    return email === SUPER_ADMIN_EMAIL
  }

  function normalizeVisibleUsers(value) {
    return String(value || '')
      .split(',')
      .map(part => part.trim().toLowerCase())
      .filter(Boolean)
  }

  async function canViewByEmail(email, allowedList) {
    const target = String(email || '').trim().toLowerCase()
    if (!target) return false
    if (!allowedList.length) return true
    return allowedList.includes(target)
  }

  async function prepareAdminGate({
    allowSelector = '[data-admin]',
    hideSelector = '[data-admin-hidden]'
  } = {}) {
    const admin = await isSuperAdmin()
    const nodes = document.querySelectorAll(allowSelector)
    nodes.forEach(node => {
      node.hidden = !admin
    })

    const hiddenNodes = document.querySelectorAll(hideSelector)
    hiddenNodes.forEach(node => {
      node.hidden = admin
    })
  }

  return {
    SUPER_ADMIN_EMAIL,
    isSuperAdmin,
    getCurrentUser,
    normalizeVisibleUsers,
    canViewByEmail,
    prepareAdminGate
  }
})()
