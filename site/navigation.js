/* global document, window */
;(function () {
  var sidebar = document.querySelector('.sidebar')
  var toggle = document.getElementById('navToggle')
  var label = document.getElementById('navLabel')
  var nav = document.getElementById('nav')
  var header = document.querySelector('header')
  if (!sidebar || !toggle || !nav) return

  function close(returnFocus) {
    sidebar.classList.remove('is-open')
    toggle.setAttribute('aria-expanded', 'false')
    if (returnFocus) toggle.focus()
  }
  function sync() {
    var compact = window.scrollY > 120
    sidebar.classList.toggle('compact', compact)
    if (!compact) close(false)
    var active = nav.querySelector('.active')
    label.textContent =
      'เมนู · ' + (active ? active.textContent.trim() : 'เมนูหลัก')
    document.documentElement.style.setProperty(
      '--header-height',
      header.offsetHeight + 'px',
    )
  }
  toggle.addEventListener('click', function () {
    var open = sidebar.classList.toggle('is-open')
    toggle.setAttribute('aria-expanded', String(open))
    if (open) nav.querySelector('.active, .nav-btn').focus()
  })
  nav.querySelectorAll('.nav-btn').forEach(function (item) {
    item.setAttribute('role', 'button')
    item.tabIndex = 0
    item.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        item.click()
      }
    })
    item.addEventListener('click', function () {
      label.textContent = 'เมนู · ' + item.textContent.trim()
      close(sidebar.classList.contains('compact'))
    })
  })
  document.addEventListener('click', function (event) {
    if (!sidebar.contains(event.target)) close(false)
  })
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open'))
      close(true)
  })
  window.addEventListener('scroll', sync, { passive: true })
  window.addEventListener('resize', sync)
  sync()
})()
