import { useStore } from '@nanostores/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { $settings, loadSettings, toggleMemory, updateCaptureInterval, initSettingsSync } from '@/stores/settingsStore'
import { TauriAPI } from '@/lib/tauri-api'
import type { ActivityInfo, ActivityDetail, SummaryInfo, MemoryChunkInfo } from '@/lib/tauri-api'
import { Toggle } from '@/components/ui/Toggle'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { showNotification } from '@/lib/utils'

export function MemoryPage() {
  return (
    <ErrorBoundary>
      <MemoryPageContent />
    </ErrorBoundary>
  )
}

function MemoryPageContent() {
  const settings = useStore($settings)
  const timerRef = useRef<number | null>(null)

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [activities, setActivities] = useState<ActivityInfo[]>([])
  const [selectedActivity, setSelectedActivity] = useState<ActivityDetail | null>(null)
  const [summary, setSummary] = useState<SummaryInfo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MemoryChunkInfo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    initSettingsSync()
    loadSettings()
  }, [])

  // Load activities and summary when date changes
  useEffect(() => {
    loadDateData(selectedDate)
  }, [selectedDate])

  async function loadDateData(date: string) {
    setLoading(true)
    setSelectedActivity(null)
    try {
      const [acts, sum] = await Promise.all([
        TauriAPI.getActivities(date).catch(() => []),
        TauriAPI.getSummary(date).catch(() => null),
      ])
      setActivities(acts)
      setSummary(sum)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectActivity(activity: ActivityInfo) {
    try {
      const detail = await TauriAPI.getActivityDetail(activity.id)
      setSelectedActivity(detail)
      setSearchResults([])
    } catch (err) {
      showNotification('加载活动详情失败: ' + err, 'error')
    }
  }

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    try {
      const results = await TauriAPI.searchMemories(query, 20)
      setSearchResults(results)
      setSelectedActivity(null)
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounced search
  const searchTimerRef = useRef<number | null>(null)
  function onSearchChange(value: string) {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = window.setTimeout(() => handleSearch(value), 400)
  }

  async function handleMemoryToggle(enabled: boolean) {
    try {
      await toggleMemory(enabled)
      showNotification(enabled ? '记忆功能已启用' : '记忆功能已禁用', 'success')
    } catch (err) {
      showNotification('切换失败: ' + err, 'error')
    }
  }

  function handleIntervalChange(value: number) {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(async () => {
      try {
        await updateCaptureInterval(value)
        showNotification(`录制分段时长已更新为 ${Math.floor(value / 60)} 分钟`, 'success')
      } catch (err) {
        showNotification('更新失败: ' + err, 'error')
      }
    }, 500)
  }

  const interval = settings?.capture_interval_seconds ?? 60
  const pct = ((interval - 30) / (300 - 30)) * 100

  // Group activities by time period
  const groupedActivities = groupByPeriod(activities)

  return (
    <div className="flex h-screen bg-app">
      {/* Left Sidebar */}
      <div className="w-72 bg-sidebar border-r border-primary p-5 flex flex-col gap-5 overflow-y-auto custom-scrollbar">

        {/* Memory Toggle */}
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-secondary">全局记忆</span>
          <Toggle
            enabled={settings?.memory_enabled ?? false}
            onChange={handleMemoryToggle}
            size="lg"
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-primary" />

        {/* Date Selector */}
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full h-10 bg-input rounded-xl border border-primary hover:border-active transition-all duration-200 ease-out px-3.5 text-sm text-secondary"
        />

        {/* Activity List */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
            活动记录 {activities.length > 0 && `(${activities.length})`}
          </h3>
          <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar -mx-1 px-1">
            {loading && (
              <div className="text-xs text-muted text-center py-4">加载中...</div>
            )}
            {!loading && activities.length === 0 && (
              <div className="text-xs text-muted text-center py-4">当天无活动记录</div>
            )}
            {groupedActivities.map(({ label, items }) => (
              <div key={label}>
                <div className="text-[10px] text-muted px-2 py-1 uppercase tracking-wider">{label}</div>
                {items.map(act => (
                  <div
                    key={act.id}
                    onClick={() => handleSelectActivity(act)}
                    className={[
                      'memory-item px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ease-out active:scale-[0.99]',
                      selectedActivity?.activity.id === act.id ? 'bg-secondary' : 'hover:bg-secondary',
                    ].join(' ')}
                  >
                    <div className="text-[10px] text-muted mb-0.5 tabular-nums">
                      {formatTime(act.start_time)} – {formatTime(act.end_time)}
                    </div>
                    <div className="text-sm text-secondary truncate">{act.title}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {act.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted">{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Interval Slider */}
        <div className="border-t border-primary pt-4">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-muted uppercase tracking-wider">录制分段</span>
            <span className="text-secondary tabular-nums">{Math.floor(interval / 60)} 分钟</span>
          </div>
          <div className="relative py-1">
            <div className="absolute top-1/2 -translate-y-1/2 w-full h-[2px] rounded-full overflow-hidden pointer-events-none">
              <div className="h-full bg-white/10 w-full absolute" />
              <div
                className="h-full bg-white/80 absolute left-0 transition-all duration-150 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <input
              type="range" min="30" max="300" step="30" value={interval}
              onChange={e => handleIntervalChange(parseInt(e.target.value))}
              className="mono-slider"
            />
          </div>
        </div>
      </div>

      {/* Right Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Search Bar */}
        <div className="h-16 px-6 flex items-center border-b border-primary">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="搜索记忆..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className={[
                'w-full h-10 pl-10 pr-4 rounded-full outline-none text-sm',
                'bg-input border border-primary text-primary',
                'focus:border-active focus:bg-secondary',
                'placeholder:text-placeholder',
                'transition-all duration-200 ease-out',
              ].join(' ')}
            />
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* Search Results */}
          {searchQuery && (
            <div>
              {isSearching && <div className="text-sm text-muted">搜索中...</div>}
              {!isSearching && searchResults.length === 0 && searchQuery && (
                <div className="text-sm text-muted text-center py-8">没有找到相关记忆</div>
              )}
              {searchResults.map(chunk => (
                <div key={chunk.id} className="mb-4 p-4 rounded-xl bg-secondary border border-primary">
                  <div className="text-[10px] text-muted mb-2 truncate">{chunk.file_path}</div>
                  <div className="text-sm text-secondary whitespace-pre-wrap">{chunk.text}</div>
                </div>
              ))}
            </div>
          )}

          {/* Activity Detail */}
          {!searchQuery && selectedActivity && (
            <div>
              {selectedActivity.markdown_content ? (
                <MarkdownRenderer
                  content={selectedActivity.markdown_content}
                  className="text-secondary"
                />
              ) : (
                <div>
                  <h1 className="text-xl font-medium text-primary mb-4">{selectedActivity.activity.title}</h1>
                  <div className="text-sm text-muted mb-2">
                    {selectedActivity.activity.application} · {selectedActivity.activity.duration_minutes}分钟
                  </div>
                  {selectedActivity.activity.summary && (
                    <p className="text-sm text-secondary mb-4">{selectedActivity.activity.summary}</p>
                  )}
                  {selectedActivity.screenshot_analyses.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs text-muted uppercase tracking-wider mb-3">录制时间线</h3>
                      {selectedActivity.screenshot_analyses.map(sa => (
                        <div key={sa.screenshot_id} className="mb-3 pl-3 border-l-2 border-primary">
                          <div className="text-[10px] text-muted tabular-nums">{formatTime(sa.analyzed_at)}</div>
                          <div className="text-sm text-secondary">{sa.activity_description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Daily Summary */}
          {!searchQuery && !selectedActivity && summary && (
            <div>
              <h2 className="text-lg font-medium text-primary mb-4">{selectedDate} 日总结</h2>
              <MarkdownRenderer content={summary.content} className="text-secondary" />
            </div>
          )}

          {/* Empty State */}
          {!searchQuery && !selectedActivity && !summary && !loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center select-none">
                <div className="text-5xl mb-5 opacity-20">&#x25EF;</div>
                <h2 className="text-xl font-medium text-primary mb-1.5">
                  {activities.length > 0 ? '选择左侧活动查看详情' : '想找哪段记忆'}
                </h2>
                <p className="text-sm text-muted">
                  {activities.length > 0 ? `共 ${activities.length} 条活动记录` : '我都记着呢，随便问'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helpers

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

interface ActivityGroup {
  label: string
  items: ActivityInfo[]
}

function groupByPeriod(activities: ActivityInfo[]): ActivityGroup[] {
  const groups: Record<string, ActivityInfo[]> = {}
  for (const act of activities) {
    const hour = new Date(act.start_time * 1000).getHours()
    let label: string
    if (hour < 6) label = '凌晨'
    else if (hour < 12) label = '上午'
    else if (hour < 14) label = '中午'
    else if (hour < 18) label = '下午'
    else label = '晚上'

    if (!groups[label]) groups[label] = []
    groups[label].push(act)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}
