import type { HabitInfo } from '@/lib/tauri-api'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

interface HabitCardProps {
  habit: HabitInfo
}

export function HabitCard({ habit }: HabitCardProps) {
  const confidencePct = Math.round(habit.confidence * 100)

  return (
    <Card interactive className="animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium text-primary">{habit.pattern_name}</h3>
        <Badge variant="default">{habit.pattern_type}</Badge>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>置信度</span>
          <span className="tabular-nums">{confidencePct}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-white/60 to-white/80 rounded-full transition-all duration-300"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>

      <div className="flex gap-4 text-xs text-muted">
        <span>出现 {habit.occurrence_count} 次</span>
        {habit.typical_time && <span>通常在 {habit.typical_time}</span>}
      </div>
    </Card>
  )
}
