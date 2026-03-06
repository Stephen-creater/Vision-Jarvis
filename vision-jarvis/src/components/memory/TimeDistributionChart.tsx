import type { ActivityInfo } from '@/lib/tauri-api'

interface TimeDistributionChartProps {
  activities: ActivityInfo[]
}

export function TimeDistributionChart({ activities }: TimeDistributionChartProps) {
  const appTime = activities.reduce((acc, act) => {
    acc[act.application] = (acc[act.application] || 0) + act.duration_minutes
    return acc
  }, {} as Record<string, number>)

  const sorted = Object.entries(appTime)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  const maxTime = Math.max(...sorted.map(([, time]) => time))

  if (sorted.length === 0) return null

  return (
    <div className="space-y-2">
      {sorted.map(([app, minutes]) => {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        const width = (minutes / maxTime) * 100

        return (
          <div key={app} className="flex items-center gap-3">
            <div className="w-24 text-xs text-muted truncate">{app}</div>
            <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden">
              <div
                className="h-full bg-white/20 transition-all duration-300"
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="w-16 text-xs text-secondary tabular-nums text-right">
              {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
            </div>
          </div>
        )
      })}
    </div>
  )
}
