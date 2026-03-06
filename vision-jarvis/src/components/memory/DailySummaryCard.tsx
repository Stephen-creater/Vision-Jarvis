import type { SummaryInfo, ActivityInfo } from '@/lib/tauri-api'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { TimeDistributionChart } from './TimeDistributionChart'

interface DailySummaryCardProps {
  summary: SummaryInfo
  activities: ActivityInfo[]
}

export function DailySummaryCard({ summary, activities }: DailySummaryCardProps) {
  const totalMinutes = activities.reduce((sum, act) => sum + act.duration_minutes, 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  return (
    <div className="space-y-6">
      <div className="flex gap-6 text-sm">
        <div>
          <div className="text-muted mb-1">活动数量</div>
          <div className="text-2xl font-medium text-primary tabular-nums">{summary.activity_count}</div>
        </div>
        <div>
          <div className="text-muted mb-1">总时长</div>
          <div className="text-2xl font-medium text-primary tabular-nums">
            {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
          </div>
        </div>
      </div>

      {activities.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">时间分布</h3>
          <TimeDistributionChart activities={activities} />
        </div>
      )}

      <div>
        <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">AI 总结</h3>
        <MarkdownRenderer content={summary.content} className="text-secondary" />
      </div>
    </div>
  )
}
