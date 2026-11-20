/**
 * vende-ia — Widget de chat embebible
 *
 * Uso:
 *   <script src="https://tu-dominio.com/widget.js"
 *           data-key="wk-xxxxxxxx"
 *           data-api-url="https://tu-dominio.com/api/widget/chat">
 *   </script>
 *
 * Atributos:
 *   data-key         (requerido) — clave pública del canal en la tabla canales
 *   data-api-url     (opcional)  — URL base del endpoint; se infiere del origen del script si se omite
 *   data-position    (opcional)  — "right" (default) | "left"
 *   data-theme-color (opcional)  — color hex del botón/header, default "#25D366"
 */
;(function () {
  'use strict'

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script')
    return scripts[scripts.length - 1]
  })()

  var WIDGET_KEY = script.dataset ? script.dataset.key : (script.getAttribute('data-key') || '')
  var POSITION    = script.getAttribute('data-position') || 'right'
  var THEME_COLOR = script.getAttribute('data-theme-color') || '#25D366'

  // Inferir URL del API desde el src del script si no se especifica
  var apiUrl = script.getAttribute('data-api-url')
  if (!apiUrl) {
    var src = script.getAttribute('src') || ''
    var origin = src.match(/^(https?:\/\/[^/]+)/)?.[1] || ''
    apiUrl = origin + '/api/widget/chat'
  }

  if (!WIDGET_KEY) {
    console.warn('[vende-ia widget] data-key es requerido')
    return
  }

  // ID de sesión persistente en localStorage
  var SESSION_KEY = 'vendeia_widget_session'
  var visitorId = localStorage.getItem(SESSION_KEY)
  if (!visitorId) {
    visitorId = 'web-' + Math.random().toString(36).slice(2) + '-' + Date.now()
    localStorage.setItem(SESSION_KEY, visitorId)
  }

  // ---- Estilos ----
  var styleEl = document.createElement('style')
  styleEl.textContent = [
    '#vendeia-widget-btn{position:fixed;bottom:20px;' + POSITION + ':20px;width:56px;height:56px;border-radius:50%;background:' + THEME_COLOR + ';border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform 0.2s}',
    '#vendeia-widget-btn:hover{transform:scale(1.1)}',
    '#vendeia-widget-btn svg{fill:white;width:28px;height:28px}',
    '#vendeia-widget-panel{position:fixed;bottom:86px;' + POSITION + ':20px;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.18);z-index:9999;display:none;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}',
    '#vendeia-widget-panel.open{display:flex}',
    '#vendeia-header{background:' + THEME_COLOR + ';color:#fff;padding:14px 16px;font-weight:600;font-size:15px;display:flex;align-items:center;gap:10px}',
    '#vendeia-header span{flex:1}',
    '#vendeia-close{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;padding:0}',
    '#vendeia-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}',
    '.vendeia-msg{max-width:80%;padding:9px 13px;border-radius:12px;font-size:14px;line-height:1.45;word-break:break-word}',
    '.vendeia-msg.bot{background:#f0f0f0;align-self:flex-start;border-bottom-left-radius:4px}',
    '.vendeia-msg.user{background:' + THEME_COLOR + ';color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
    '#vendeia-footer{border-top:1px solid #eee;padding:10px;display:flex;gap:8px}',
    '#vendeia-input{flex:1;border:1px solid #ddd;border-radius:22px;padding:8px 14px;font-size:14px;outline:none;resize:none;line-height:1.4;max-height:80px;overflow-y:auto}',
    '#vendeia-send{background:' + THEME_COLOR + ';border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '#vendeia-send svg{fill:#fff;width:18px;height:18px}',
    '#vendeia-typing{padding:6px 13px;background:#f0f0f0;border-radius:12px;align-self:flex-start;font-size:13px;color:#888;display:none}',
  ].join('\n')
  document.head.appendChild(styleEl)

  // ---- DOM ----
  var btn = document.createElement('button')
  btn.id = 'vendeia-widget-btn'
  btn.setAttribute('aria-label', 'Abrir chat')
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'

  var panel = document.createElement('div')
  panel.id = 'vendeia-widget-panel'
  panel.innerHTML = [
    '<div id="vendeia-header">',
    '  <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
    '  <span>Chat</span>',
    '  <button id="vendeia-close" aria-label="Cerrar">&#x2715;</button>',
    '</div>',
    '<div id="vendeia-msgs"></div>',
    '<div id="vendeia-typing">Escribiendo...</div>',
    '<div id="vendeia-footer">',
    '  <textarea id="vendeia-input" rows="1" placeholder="Escribí tu mensaje..."></textarea>',
    '  <button id="vendeia-send" aria-label="Enviar"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>',
    '</div>',
  ].join('')

  document.body.appendChild(btn)
  document.body.appendChild(panel)

  var msgs = document.getElementById('vendeia-msgs')
  var input = document.getElementById('vendeia-input')
  var sendBtn = document.getElementById('vendeia-send')
  var typing = document.getElementById('vendeia-typing')
  var closeBtn = document.getElementById('vendeia-close')

  var isOpen = false

  function togglePanel() {
    isOpen = !isOpen
    if (isOpen) {
      panel.classList.add('open')
      input.focus()
    } else {
      panel.classList.remove('open')
    }
  }

  btn.addEventListener('click', togglePanel)
  closeBtn.addEventListener('click', togglePanel)

  function addMsg(text, rol) {
    var el = document.createElement('div')
    el.className = 'vendeia-msg ' + rol
    el.textContent = text
    msgs.appendChild(el)
    msgs.scrollTop = msgs.scrollHeight
  }

  var sending = false

  async function sendMsg() {
    var text = input.value.trim()
    if (!text || sending) return
    sending = true
    input.value = ''
    addMsg(text, 'user')
    typing.style.display = 'block'
    msgs.scrollTop = msgs.scrollHeight

    try {
      var res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widget_key: WIDGET_KEY,
          mensaje: text,
          session_id: visitorId,
        }),
      })
      var data = await res.json()
      if (res.ok && data.respuesta) {
        addMsg(data.respuesta, 'bot')
      } else {
        addMsg('Hubo un error. Intentá de nuevo.', 'bot')
      }
    } catch (_) {
      addMsg('Sin conexión. Revisá tu internet.', 'bot')
    } finally {
      typing.style.display = 'none'
      sending = false
    }
  }

  sendBtn.addEventListener('click', sendMsg)
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMsg()
    }
  })

  // Auto-resize del textarea
  input.addEventListener('input', function () {
    this.style.height = 'auto'
    this.style.height = Math.min(this.scrollHeight, 80) + 'px'
  })
})()
