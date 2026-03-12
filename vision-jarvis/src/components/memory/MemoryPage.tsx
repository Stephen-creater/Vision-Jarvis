import { useStore } from '@nanostores/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { $settings, loadSettings, toggleMemory, updateCaptureInterval, initSettingsSync } from '@/stores/settingsStore'
import { TauriAPI } from '@/lib/tauri-api'
import type { ActivityInfo, ActivityDetail, SummaryInfo, MemoryChunkInfo } from '@/lib/tauri-api'
import { Toggle } from '@/components/ui/Toggle'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { showNotification } from '@/lib/utils'
import { MemoryTabs } from './MemoryTabs'
import { HabitsPanel } from './HabitsPanel'
import { ProjectsPanel } from './ProjectsPanel'
import { DailySummaryCard } from './DailySummaryCard'

const SURFACE = 'rounded-[28px] border border-primary bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.16)]'
const SUBSURFACE = 'rounded-[24px] border border-primary bg-secondary/70'

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
  const searchTimerRef = useRef<number | null>(null)

  const [activeTab, setActiveTab] = useState<'activities' | 'habits' | 'projects' | 'summary'>('activities')
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
  const groupedActivities = groupByPeriod(activities)
  const dayStats = buildDayStats(activities)

  return (
    <div className="min-h-screen bg-app xl:grid xl:h-screen xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-b border-primary bg-sidebar/80 xl:min-h-0 xl:border-r xl:border-b-0">
        <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-5">
          <section className={`${SURFACE} p-4`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted">Memory Console</div>
                <h1 className="mt-2 text-2xl font-semibold text-primary">记忆中枢</h1>
              </div>
              <Toggle
                enabled={settings?.memory_enabled ?? false}
                onChange={handleMemoryToggle}
                size="lg"
              />
            </div>

            <div className="grid gap-3">
              <label className="text-[11px] uppercase tracking-[0.24em] text-muted">查看日期</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="h-11 rounded-2xl border border-primary bg-input px-3.5 text-sm text-secondary transition-all duration-200 ease-out hover:border-active"
              />
            </div>

            <div className="mt-5 border-t border-primary pt-4">
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="uppercase tracking-[0.24em] text-muted">录制分段</span>
                <span className="tabular-nums text-secondary">{Math.floor(interval / 60)} 分钟</span>
              </div>
              <div className="relative py-1">
                <div className="pointer-events-none absolute top-1/2 h-[2px] w-full -translate-y-1/2 overflow-hidden rounded-full">
                  <div className="absolute h-full w-full bg-white/10" />
                  <div
                    className="absolute left-0 h-full bg-white/85 transition-all duration-150 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <input
                  type="range"
                  min="30"
                  max="300"
                  step="30"
                  value={interval}
                  onChange={e => handleIntervalChange(parseInt(e.target.value))}
                  className="mono-slider"
                />
              </div>
            </div>
          </section>

          <section className={`${SURFACE} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <div className="border-b border-primary p-4">
              <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-muted">导航与时间线</div>
              <MemoryTabs activeTab={activeTab} onChange={setActiveTab} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
              <div className="mb-3 flex items-center justify-between px-2">
                <h3 className="text-xs font-medium uppercase tracking-[0.24em] text-muted">活动记录</h3>
                <span className="rounded-full border border-primary px-2 py-1 text-[10px] text-secondary">
                  {activities.length} 条
                </span>
              </div>

              {loading && (
                <div className="py-8 text-center text-xs text-muted">加载中...</div>
              )}

              {!loading && activities.length === 0 && (
                <div className={`${SUBSURFACE} px-4 py-8 text-center text-xs text-muted`}>
                  当天无活动记录
                </div>
              )}

              {!loading && groupedActivities.map(({ label, items }) => (
                <div key={label} className="mb-4">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-muted">{label}</div>
                  <div className="space-y-1.5">
                    {items.map(act => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => handleSelectActivity(act)}
                        className={[
                          'w-full rounded-2xl border px-3 py-3 text-left transition-all duration-150 ease-out active:scale-[0.99]',
                          selectedActivity?.activity.id === act.id
                            ? 'border-active bg-secondary shadow-[0_8px_20px_rgba(0,0,0,0.18)]'
                            : 'border-transparent bg-secondary/55 hover:border-primary hover:bg-secondary',
                        ].join(' ')}
                      >
                        <div className="mb-1 text-[10px] tabular-nums text-muted">
                          {formatTime(act.start_time)} - {formatTime(act.end_time)}
                        </div>
                        <div className="truncate text-sm font-medium text-secondary">{act.title}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {act.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="rounded-full bg-black/15 px-2 py-0.5 text-[10px] text-muted">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b border-primary px-4 md:px-6">
          {activeTab === 'activities' && (
            <div className="relative w-full max-w-2xl">
              <input
                type="text"
                placeholder="搜索记忆..."
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className={[
                  'h-10 w-full rounded-full border border-primary bg-input pl-10 pr-4 text-sm text-primary outline-none',
                  'focus:border-active focus:bg-secondary',
                  'placeholder:text-placeholder transition-all duration-200 ease-out',
                ].join(' ')}
              />
              <svg
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
          )}

          {activeTab !== 'activities' && (
            <div className="text-xs uppercase tracking-wider text-muted">
              {activeTab === 'habits' && '习惯模式分析'}
              {activeTab === 'projects' && '项目管理'}
              {activeTab === 'summary' && '每日总结'}
            </div>
          )}
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-4 md:p-6">
          {activeTab === 'activities' && (
            <div className="grid h-full min-h-0 gap-6 2xl:grid-cols-[minmax(0,1.45fr)_360px]">
              <section className={`${SURFACE} min-h-[480px] min-w-0 overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-primary px-5 py-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-muted">Workspace</div>
                    <h2 className="mt-1 text-lg font-semibold text-primary">
                      {searchQuery
                        ? `搜索“${searchQuery}”`
                        : selectedActivity
                          ? selectedActivity.activity.title
                          : '当天记忆概览'}
                    </h2>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <div>{selectedDate}</div>
                    <div className="mt-1">{activities.length} 条活动</div>
                  </div>
                </div>

                <div className="h-[calc(100%-89px)] overflow-y-auto p-5 custom-scrollbar">
                  {searchQuery && isSearching && (
                    <div className={`${SUBSURFACE} px-5 py-8 text-sm text-muted`}>搜索中...</div>
                  )}

                  {searchQuery && !isSearching && searchResults.length === 0 && (
                    <div className={`${SUBSURFACE} px-5 py-10 text-center text-sm text-muted`}>
                      没有找到相关记忆
                    </div>
                  )}

                  {searchQuery && !isSearching && searchResults.length > 0 && (
                    <div className="space-y-4">
                      {searchResults.map(chunk => (
                        <div key={chunk.id} className={`${SUBSURFACE} p-4`}>
                          <div className="mb-2 truncate text-[10px] uppercase tracking-[0.18em] text-muted">
                            {chunk.file_path}
                          </div>
                          <div className="whitespace-pre-wrap text-sm leading-6 text-secondary">{chunk.text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!searchQuery && selectedActivity && (
                    <div className="min-w-0">
                      <div className="mb-5 flex flex-wrap gap-2">
                        <span className="rounded-full border border-primary px-3 py-1 text-xs text-secondary">
                          {selectedActivity.activity.application}
                        </span>
                        <span className="rounded-full border border-primary px-3 py-1 text-xs text-secondary">
                          {selectedActivity.activity.duration_minutes} 分钟
                        </span>
                        <span className="rounded-full border border-primary px-3 py-1 text-xs text-secondary">
                          {formatTime(selectedActivity.activity.start_time)} - {formatTime(selectedActivity.activity.end_time)}
                        </span>
                      </div>

                      {selectedActivity.markdown_content ? (
                        <MarkdownRenderer content={selectedActivity.markdown_content} className="text-secondary" />
                      ) : (
                        <div className="space-y-5">
                          {selectedActivity.activity.summary && (
                            <div className={`${SUBSURFACE} p-4`}>
                              <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-muted">摘要</div>
                              <p className="text-sm leading-6 text-secondary">{selectedActivity.activity.summary}</p>
                            </div>
                          )}

                          {selectedActivity.screenshot_analyses.length > 0 && (
                            <div className={`${SUBSURFACE} p-4`}>
                              <div className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted">录制时间线</div>
                              <div className="space-y-3">
                                {selectedActivity.screenshot_analyses.map(sa => (
                                  <div key={sa.screenshot_id} className="border-l-2 border-primary pl-3">
                                    <div className="text-[10px] tabular-nums text-muted">{formatTime(sa.analyzed_at)}</div>
                                    <div className="mt-1 text-sm text-secondary">{sa.activity_description}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!searchQuery && !selectedActivity && !loading && (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className={`${SUBSURFACE} p-5`}>
                        <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-muted">当天摘要</div>
                        <h3 className="mb-3 text-xl font-semibold text-primary">先选一段活动，或直接搜索你要回忆的事情</h3>
                        <p className="text-sm leading-6 text-secondary">
                          左侧是时间线，右侧是当天上下文。这个页面应该像一个工作台，而不是一张被拉伸的长纸。
                        </p>
                      </div>

                      <div className={`${SUBSURFACE} p-5`}>
                        <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-muted">今日统计</div>
                        <div className="space-y-2 text-sm text-secondary">
                          <div className="flex items-center justify-between"><span className="text-muted">活动数</span><span>{dayStats.activityCount}</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted">总时长</span><span>{dayStats.totalMinutes} 分钟</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted">涉及应用</span><span>{dayStats.uniqueApps}</span></div>
                        </div>
                      </div>

                      {summary ? (
                        <div className={`${SUBSURFACE} p-5 xl:col-span-2`}>
                          <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-muted">自动总结</div>
                          <div className="max-h-40 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-secondary">
                            {summary.content}
                          </div>
                        </div>
                      ) : (
                        <div className={`${SUBSURFACE} p-5 xl:col-span-2`}>
                          <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-muted">系统状态</div>
                          <div className="text-sm leading-6 text-secondary">
                            当天还没有生成总结，但活动和搜索仍然可用。总结是附加视图，不应阻塞主浏览流程。
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
                <section className={`${SURFACE} p-5`}>
                  <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-muted">日视图</div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="活动数" value={String(dayStats.activityCount)} />
                    <StatCard label="总时长" value={`${dayStats.totalMinutes}m`} />
                    <StatCard label="应用数" value={String(dayStats.uniqueApps)} />
                    <StatCard label="最长活动" value={dayStats.longestLabel} />
                  </div>
                </section>

                <section className={`${SURFACE} p-5`}>
                  <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-muted">高频标签</div>
                  {dayStats.topTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {dayStats.topTags.map(tag => (
                        <span key={tag} className="rounded-full border border-primary px-3 py-1 text-xs text-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted">当前活动还没有稳定标签</div>
                  )}
                </section>

                {selectedActivity && (
                  <section className={`${SURFACE} p-5`}>
                    <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-muted">当前活动</div>
                    <h3 className="text-lg font-semibold text-primary">{selectedActivity.activity.title}</h3>
                    <div className="mt-3 space-y-2 text-sm text-secondary">
                      <div className="flex items-center justify-between"><span className="text-muted">应用</span><span>{selectedActivity.activity.application}</span></div>
                      <div className="flex items-center justify-between"><span className="text-muted">时长</span><span>{selectedActivity.activity.duration_minutes} 分钟</span></div>
                      <div className="flex items-center justify-between"><span className="text-muted">分类</span><span>{selectedActivity.activity.category}</span></div>
                    </div>
                    {selectedActivity.activity.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedActivity.activity.tags.map(tag => (
                          <span key={tag} className="rounded-full bg-black/15 px-3 py-1 text-xs text-secondary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {summary && (
                  <section className={`${SURFACE} p-5`}>
                    <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-muted">摘要预览</div>
                    <div className="max-h-56 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-secondary">
                      {summary.content}
                    </div>
                  </section>
                )}

                {!summary && !selectedActivity && (
                  <section className={`${SURFACE} p-5`}>
                    <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-muted">使用建议</div>
                    <div className="space-y-2 text-sm leading-6 text-secondary">
                      <p>先从左侧时间线挑一段活动，再看主面板里的完整内容。</p>
                      <p>如果你只记得关键词，直接在顶部搜索，结果会按记忆片段返回。</p>
                    </div>
                  </section>
                )}
              </aside>
            </div>
          )}

          {activeTab === 'habits' && (
            <div className={`${SURFACE} h-full overflow-y-auto p-4 md:p-6 custom-scrollbar`}>
              <div className="mx-auto w-full max-w-6xl">
                <HabitsPanel />
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className={`${SURFACE} h-full overflow-y-auto p-4 md:p-6 custom-scrollbar`}>
              <div className="mx-auto w-full max-w-6xl">
                <ProjectsPanel />
              </div>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className={`${SURFACE} h-full overflow-y-auto p-4 md:p-6 custom-scrollbar`}>
              <div className="mx-auto w-full max-w-6xl">
                {summary ? (
                  <DailySummaryCard summary={summary} activities={activities} />
                ) : loading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-sm text-muted">加载中...</div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center select-none">
                      <div className="mb-5 text-5xl opacity-15">□</div>
                      <h3 className="mb-1.5 text-xl font-medium text-primary">当天无总结</h3>
                      <p className="text-sm text-muted">活动记录会在每日结束时自动生成总结</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${SUBSURFACE} p-3`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="mt-2 text-lg font-semibold text-primary">{value}</div>
    </div>
  )
}

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

function buildDayStats(activities: ActivityInfo[]) {
  const totalMinutes = activities.reduce((sum, item) => sum + item.duration_minutes, 0)
  const uniqueApps = new Set(activities.map(item => item.application).filter(Boolean)).size
  const longestActivity = activities.reduce<ActivityInfo | null>((longest, item) => {
    if (!longest || item.duration_minutes > longest.duration_minutes) return item
    return longest
  }, null)

  const tagCounts = new Map<string, number>()
  for (const activity of activities) {
    for (const tag of activity.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag)

  return {
    activityCount: activities.length,
    totalMinutes,
    uniqueApps,
    topTags,
    longestLabel: longestActivity ? `${longestActivity.duration_minutes}m` : '-',
  }
}
