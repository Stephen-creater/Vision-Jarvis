const rootElement = document.getElementById('settings-root')

if (!rootElement) {
  throw new Error('settings-root not found')
}

function showBootstrapError(message: string) {
  rootElement.textContent = `设置页面加载失败: ${message}`
  rootElement.setAttribute(
    'style',
    'min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#f87171;font-size:14px;padding:24px;text-align:center;white-space:pre-wrap;',
  )
}

window.addEventListener('error', (event) => {
  showBootstrapError(event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason)
  showBootstrapError(reason)
})

async function bootstrap() {
  try {
    const [{ StrictMode }, { createRoot }, { SettingsPage }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@/components/settings/SettingsPage'),
    ])

    createRoot(rootElement).render(
      <StrictMode>
        <SettingsPage />
      </StrictMode>,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    showBootstrapError(message)
  }
}

void bootstrap()
