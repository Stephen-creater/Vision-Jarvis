interface ToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  size?: 'sm' | 'lg'
}

export function Toggle({ enabled, onChange, size = 'sm' }: ToggleProps) {
  const isLg = size === 'lg'
  const trackW = isLg ? 'w-14' : 'w-11'
  const trackH = isLg ? 'h-7' : 'h-6'
  const thumbSz = isLg ? 'w-5 h-5' : 'w-4 h-4'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`
        relative inline-flex ${trackW} ${trackH} shrink-0 cursor-pointer
        rounded-full border transition-all duration-300 ease-out
        focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30
        ${enabled
          ? 'toggle-track-on shadow-[inset_0_0_8px_rgba(0,0,0,0.15)]'
          : 'toggle-track-off shadow-[inset_0_0_8px_rgba(0,0,0,0.08)]'
        }
      `}
    >
      <span
        className={`
          ${thumbSz} rounded-full absolute top-1/2 -translate-y-1/2
          transition-all duration-300 ease-out pointer-events-none
          shadow-[0_1px_3px_rgba(0,0,0,0.2)]
          ${enabled
            ? `translate-x-[calc(100%+${isLg ? '8px' : '6px'})] toggle-thumb`
            : `translate-x-[3px] toggle-thumb-off`
          }
        `}
      />
    </button>
  )
}
