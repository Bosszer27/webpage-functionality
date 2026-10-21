(function(){
  const STORAGE_KEY = 'vault_site_config_v1'
  const DEFAULT_CONFIG = {
    superadminEmail: 'm0939712157@gmail.com',
    allowedUsers: ['m0939712157@gmail.com'],
    keys: [
      { label: 'Google Search Console', value: 'https://search.google.com/search-console' },
      { label: 'Netlify', value: 'https://app.netlify.com/' },
      { label: 'Cloudflare', value: 'https://dash.cloudflare.com/' },
      { label: 'WordPress Admin', value: 'https://example.com/wp-admin' }
    ],
    sites: [
      {
        id: 'seed-site-1',
        name: 'ตัวอย่างเว็บไซต์',
        url: 'https://example.com',
        adminUrl: 'https://example.com/wp-admin',
        username: 'admin',
        password: '********',
        userVisible: ['m0939712157@gmail.com'],
        note: 'ตัวอย่างข้อมูลสำหรับโครงสร้างเมนูข้อมูลเว็บไซต์'
      }
    ]
  }

  function ensureConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG))
        return structuredClone(DEFAULT_CONFIG)
      }
      const parsed = JSON.parse(raw)
      return {
        superadminEmail: parsed.superadminEmail || DEFAULT_CONFIG.superadminEmail,
        allowedUsers: Array.isArray(parsed.allowedUsers) && parsed.allowedUsers.length ? parsed.allowedUsers : DEFAULT_CONFIG.allowedUsers,
        keys: Array.isArray(parsed.keys) && parsed.keys.length ? parsed.keys : DEFAULT_CONFIG.keys,
        sites: Array.isArray(parsed.sites) ? parsed.sites : DEFAULT_CONFIG.sites
      }
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG))
      return structuredClone(DEFAULT_CONFIG)
    }
  }

  function saveConfig(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase()
  }

  function uid() {
    return 'site-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  }

  function esc(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, location.origin)
      return /^https?:$/.test(url.protocol) ? url.href : '#'
    } catch {
      return '#'
    }
  }

  function getCurrentUserEmail() {
    const user = window.SuperAdmin && typeof window.SuperAdmin.getCurrentUser === 'function'
      ? window.SuperAdmin.getCurrentUser()
      : Promise.resolve(null)

    return user.then((u) => u && u.email ? normalizeEmail(u.email) : '').catch(() => '')
  }

  function canViewSite(site, viewerEmail) {
    const cfg = ensureConfig()
    const superadmin = normalizeEmail(cfg.superadminEmail || DEFAULT_CONFIG.superadminEmail)
    if (!viewerEmail) return false
    if (viewerEmail === superadmin) return true
    const visible = Array.isArray(site.userVisible) ? site.userVisible.map(normalizeEmail) : []
    const allowed = Array.isArray(cfg.allowedUsers) ? cfg.allowedUsers.map(normalizeEmail) : []
    return visible.includes(viewerEmail) || allowed.includes(viewerEmail)
  }

  function renderKeys() {
    const cfg = ensureConfig()
    const list = document.getElementById('website-key-list')
    if (!list) return
    list.innerHTML = ''
    cfg.keys.forEach((key) => {
      const item = document.createElement('div')
      item.style.cssText = 'display:inline-flex;flex-direction:column;min-width:180px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(41,122,46,.05);'
      item.innerHTML = '<strong style="font-size:11px;color:var(--muted);font-weight:700;">' + esc(key.label) + '</strong><span style="margin-top:4px;word-break:break-word;font-size:13px;">' + esc(key.value || '—') + '</span>'
      list.appendChild(item)
    })
  }

  async function renderWebsiteCards() {
    const list = document.getElementById('website-list')
    if (!list) return
    const cfg = ensureConfig()
    const viewerEmail = normalizeEmail(await getCurrentUserEmail())
    const visibleSites = cfg.sites.filter((site) => canViewSite(site, viewerEmail))

    if (!visibleSites.length) {
      list.innerHTML = '<div style="padding:14px;border:1px dashed var(--border);border-radius:12px;color:var(--muted);">ไม่มีข้อมูลเว็บไซต์ที่เห็นได้ตามสิทธิ์ของคุณ</div>'
      return
    }

    list.innerHTML = ''
    visibleSites.forEach((site) => {
      const card = document.createElement('div')
      card.style.cssText = 'border:1px solid var(--border);border-radius:14px;background:var(--card);padding:16px;'
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">
          <div>
            <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Website</div>
            <h4 style="margin:6px 0 0;font-size:18px;">${esc(site.name || 'เว็บไซต์')}</h4>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <span style="padding:6px 10px;border-radius:999px;background:var(--accent-soft);color:var(--text);font-size:12px;font-weight:700;">เห็นได้: ${esc((site.userVisible || []).join(', ') || 'superadmin')}</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px;">
          <div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:rgba(128,128,128,.02);">
            <div style="font-size:11px;color:var(--muted);font-weight:700;">URL</div>
            <a href="${safeUrl(site.url || '#')}" target="_blank" rel="noopener" style="display:block;margin-top:6px;color:var(--text);word-break:break-word;">${esc(site.url || '—')}</a>
          </div>
          <div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:rgba(128,128,128,.02);">
            <div style="font-size:11px;color:var(--muted);font-weight:700;">เว็บแอดมิน</div>
            <a href="${safeUrl(site.adminUrl || '#')}" target="_blank" rel="noopener" style="display:block;margin-top:6px;color:var(--text);word-break:break-word;">${esc(site.adminUrl || '—')}</a>
          </div>
          <div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:rgba(128,128,128,.02);">
            <div style="font-size:11px;color:var(--muted);font-weight:700;">Username</div>
            <div style="margin-top:6px;font-weight:600;">${esc(site.username || '—')}</div>
          </div>
          <div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:rgba(128,128,128,.02);">
            <div style="font-size:11px;color:var(--muted);font-weight:700;">Password</div>
            <div style="margin-top:6px;font-weight:600;">${esc(site.password || '—')}</div>
          </div>
        </div>
        ${site.note ? '<div style="margin-top:12px;padding:10px 12px;border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:8px;"><strong>หมายเหตุ:</strong> ' + esc(site.note) + '</div>' : ''}
      `
      list.appendChild(card)
    })
  }

  function bindWebsiteEvents() {
    const cfg = ensureConfig()
    const adminEmailInput = document.getElementById('website-superadmin-email')
    const adminAllowedInput = document.getElementById('website-allowed-users')
    if (adminEmailInput) adminEmailInput.value = cfg.superadminEmail || DEFAULT_CONFIG.superadminEmail
    if (adminAllowedInput) adminAllowedInput.value = (cfg.allowedUsers || []).join(', ')

    const saveBtn = document.getElementById('website-save-admin')
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const next = ensureConfig()
        next.superadminEmail = normalizeEmail(document.getElementById('website-superadmin-email').value || DEFAULT_CONFIG.superadminEmail)
        next.allowedUsers = (document.getElementById('website-allowed-users').value || '')
          .split(',')
          .map((x) => normalizeEmail(x))
          .filter(Boolean)
        saveConfig(next)
        const status = document.getElementById('website-admin-status')
        if (status) status.textContent = 'บันทึกสิทธิ์ superadmin แล้ว'
        renderWebsiteCards()
      })
    }

    const addBtn = document.getElementById('website-add-site')
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const websiteName = document.getElementById('website-name').value.trim()
        const websiteUrl = document.getElementById('website-url').value.trim()
        if (!websiteName || !websiteUrl) {
          const status = document.getElementById('website-admin-status')
          if (status) status.textContent = 'กรุณากรอกชื่อเว็บไซต์และ URL อย่างน้อย 1 ช่อง'
          return
        }

        const next = ensureConfig()
        next.sites.unshift({
          id: uid(),
          name: websiteName,
          url: websiteUrl,
          adminUrl: document.getElementById('website-admin-url').value.trim(),
          username: document.getElementById('website-username').value.trim(),
          password: document.getElementById('website-password').value.trim(),
          userVisible: (document.getElementById('website-visible-to').value || '')
            .split(',')
            .map((x) => normalizeEmail(x))
            .filter(Boolean) || [normalizeEmail(next.superadminEmail)],
          note: document.getElementById('website-note').value.trim()
        })
        saveConfig(next)

        document.getElementById('website-name').value = ''
        document.getElementById('website-url').value = ''
        document.getElementById('website-admin-url').value = ''
        document.getElementById('website-username').value = ''
        document.getElementById('website-password').value = ''
        document.getElementById('website-visible-to').value = ''
        document.getElementById('website-note').value = ''

        const status = document.getElementById('website-admin-status')
        if (status) status.textContent = 'เพิ่มข้อมูลเว็บไซต์แล้ว'
        renderKeys()
        renderWebsiteCards()
      })
    }
  }

  function ensureWebsiteUI() {
    const existing = document.getElementById('tab-sites')
    if (existing) return

    const main = document.querySelector('main')
    if (!main) return

    const section = document.createElement('section')
    section.className = 'tab-section'
    section.id = 'tab-sites'
    section.innerHTML = `
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:20px;padding:24px;color:#fff;margin-bottom:24px;position:relative;overflow:hidden;">
        <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#cbd5e1;font-weight:700;margin:0 0 8px;">Website Info</p>
        <h2 style="font-size:24px;font-weight:800;margin:0 0 6px;">ข้อมูลเว็บไซต์ · ช��ดคีย์ · เว็บแอดมิน</h2>
        <p style="font-size:13.5px;color:#cbd5e1;margin:0;">สำหรับ superadmin เท่านั้นที่สามารถตั้งค่าและเพิ่มข้อมูลเว็บไซต์ได้</p>
      </div>

      <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:18px;">
        <h3 style="font-size:15px;font-weight:800;margin:0 0 12px;">ชุดคีย์ด้านบน</h3>
        <div id="website-key-list" style="display:flex;flex-wrap:wrap;gap:10px;"></div>
      </div>

      <div data-admin style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:18px;display:none;">
        <h3 style="font-size:15px;font-weight:800;margin:0 0 12px;">ตั้งค่า superadmin / สิทธิ์การมองเห็น</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
          <input class="input-field" id="website-superadmin-email" placeholder="อีเมล superadmin">
          <input class="input-field" id="website-allowed-users" placeholder="คนที่เห็นได้ (คั่นด้วย ,)">
        </div>
        <div style="margin-top:12px;">
          <button class="btn-primary" id="website-save-admin" type="button">บันทึกสิทธิ์ superadmin</button>
        </div>
        <p id="website-admin-status" style="font-size:12px;color:var(--muted);margin:10px 0 0;"></p>
      </div>

      <div data-admin style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:18px;display:none;">
        <h3 style="font-size:15px;font-weight:800;margin:0 0 12px;">เพิ่มข้อมูลเว็บไซต์</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
          <input class="input-field" id="website-name" placeholder="ชื่อเว็บไซต์">
          <input class="input-field" id="website-url" placeholder="URL เว็บไซต์">
          <input class="input-field" id="website-admin-url" placeholder="URL เว็บแอดมิน">
          <input class="input-field" id="website-username" placeholder="Username เว็บแอดมิน">
          <input class="input-field" id="website-password" type="password" placeholder="Password เว็บแอดมิน">
          <input class="input-field" id="website-visible-to" placeholder="เห็นได้เฉพาะ (คั่นด้วย ,)">
          <textarea class="input-field" id="website-note" rows="2" placeholder="หมายเหตุ / คีย์ / การใช้งาน" style="grid-column:1 / -1;"></textarea>
        </div>
        <div style="margin-top:12px;">
          <button class="btn-primary" id="website-add-site" type="button">เพิ่มข้อมูลเว็บไซต์</button>
        </div>
      </div>

      <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;">
        <h3 style="font-size:15px;font-weight:800;margin:0 0 12px;">ข้อมูลแต่ละเว็บ</h3>
        <div id="website-list" style="display:flex;flex-direction:column;gap:12px;"></div>
      </div>
    `
    main.appendChild(section)

    const nav = document.getElementById('nav')
    if (nav) {
      const existing = nav.querySelector('[data-tab="sites"]')
      if (!existing) {
        const button = document.createElement('div')
        button.className = 'nav-btn'
        button.setAttribute('data-tab', 'sites')
        button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 8h10M7 12h10M7 16h6"></path></svg><span>ข้อมูลเว็บไซต์</span>'
        button.addEventListener('click', () => {
          document.querySelectorAll('.nav-btn').forEach((el) => el.classList.toggle('active', el.getAttribute('data-tab') === 'sites'))
          document.querySelectorAll('.tab-section').forEach((el) => el.classList.toggle('active', el.id === 'tab-sites'))
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
        nav.appendChild(button)
      }
    }

    renderKeys()
    bindWebsiteEvents()
    renderWebsiteCards()

    if (window.SuperAdmin && typeof window.SuperAdmin.prepareAdminGate === 'function') {
      window.SuperAdmin.prepareAdminGate({ allowSelector: '[data-admin]', hideSelector: '[data-admin-hidden]' })
    }
  }

  function init() {
    if (!document.body) return
    ensureWebsiteUI()
    const refresh = async () => {
      renderKeys()
      await renderWebsiteCards()
      if (window.SuperAdmin && typeof window.SuperAdmin.prepareAdminGate === 'function') {
        window.SuperAdmin.prepareAdminGate({ allowSelector: '[data-admin]', hideSelector: '[data-admin-hidden]' })
      }
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh() })
    setInterval(refresh, 30000)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
