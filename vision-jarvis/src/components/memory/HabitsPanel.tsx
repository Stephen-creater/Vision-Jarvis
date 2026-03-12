import { useState, useEffect } from 'react'
import { TauriAPI, type HabitInfo } from '@/lib/tauri-api'
import { HabitCard } from './HabitCard'
import { showNotification } from '@/lib/utils'

export function HabitsPanel() {
  const [habits, setHabits] = useState<HabitInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)

  useEffect(() => {
    loadHabits()
  }, [])

  async function loadHabits() {
    setLoading(true)
    try {
      const data = await TauriAPI.getHabits()
      setHabits(data)
    } catch (err) {
      showNotification('加载习惯失败: ' + err, 'error')
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter ? habits.filter(h => h.pattern_type === filter) : habits
  const grouped = {
    high: filtered.filter(h => h.confidence >= 0.8),
    medium: filtered.filter(h => h.confidence >= 0.5 && h.confidence < 0.8),
    low: filtered.filter(h => h.confidence < 0.5),
  }

  const types = [...new Set(habits.map(h => h.pattern_type))]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted">加载中...</div>
      </div>
    )
  }

  if (habits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center select-none">
          <div className="text-5xl mb-5 opacity-20">📊</div>
          <h3 className="text-xl font-medium text-primary mb-1.5">还没有检测到习惯模式</h3>
          <p className="text-sm text-muted">继续使用 30 天后会自动分析</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {types.length > 1 && (
        <div className="flex gap-2">
          <button
            onClick={() => setFilter(null)}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
              !filter ? 'bg-white/10 text-primary' : 'text-muted hover:text-secondary hover:bg-white/5',
            ].join(' ')}
          >
            全部
          </button>
          {types.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                filter === type ? 'bg-white/10 text-primary' : 'text-muted hover:text-secondary hover:bg-white/5',
              ].join(' ')}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {grouped.high.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">高置信度 (≥80%)</h3>
          <div className="grid gap-3">
            {grouped.high.map(habit => <HabitCard key={habit.id} habit={habit} />)}
          </div>
        </div>
      )}

      {grouped.medium.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">中置信度 (50-80%)</h3>
          <div className="grid gap-3">
            {grouped.medium.map(habit => <HabitCard key={habit.id} habit={habit} />)}
          </div>
        </div>
      )}
    </div>
  )
}
