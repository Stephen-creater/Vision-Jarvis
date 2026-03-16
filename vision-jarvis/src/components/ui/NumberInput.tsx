import { useState } from 'react'

interface NumberInputProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  hint?: string
  onChange: (value: number) => void
}

export function NumberInput({
  label, value: initialValue, min, max, step = 1, unit = '', hint, onChange
}: NumberInputProps) {
  const [value, setValue] = useState(initialValue.toString())
  const [isFocused, setIsFocused] = useState(false)

  const handleConfirm = () => {
    const num = parseInt(value)
    if (isNaN(num)) {
      setValue(initialValue.toString())
      return
    }
    const clamped = Math.max(min, Math.min(max, num))
    setValue(clamped.toString())
    onChange(clamped)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm()
  }

  return (
    <div>
      <label className="block text-xs text-muted uppercase tracking-wider mb-3">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-[120px] px-3 py-2.5 rounded-lg text-sm text-primary bg-card outline-none transition-all duration-200 ${
            isFocused ? 'border border-active' : 'border border-primary'
          }`}
        />
        {unit && <span className="text-sm text-secondary">{unit}</span>}
        <button
          onClick={handleConfirm}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ background: '#7C9082' }}
        >
          确定
        </button>
      </div>
      {hint && <p className="text-xs text-muted mt-2">{hint}</p>}
    </div>
  )
}
