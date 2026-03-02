export function showNotification(message: string, type: 'success' | 'error' | 'info') {
  const el = document.createElement('div')
  const border = type === 'error'
    ? 'border: 1px solid rgba(255,255,255,0.3)'
    : 'border: 1px solid rgba(255,255,255,0.1)'
  el.style.cssText = [
    'position:fixed', 'bottom:16px', 'right:16px', 'z-index:50',
    'padding:12px 24px', 'border-radius:12px',
    'font-size:14px', 'font-weight:500',
    'background:rgba(20,20,20,0.95)', 'color:#fff',
    'backdrop-filter:blur(8px)',
    border,
    'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
    'opacity:0', 'transform:translateY(8px)',
    'transition:opacity 200ms ease,transform 200ms ease',
  ].join(';')
  el.textContent = message
  document.body.appendChild(el)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    })
  })
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(8px)'
    setTimeout(() => el.remove(), 200)
  }, 3000)
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}
