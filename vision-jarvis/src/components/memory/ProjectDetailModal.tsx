import type { ProjectInfo, ActivityInfo } from '@/lib/tauri-api'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useState, useEffect } from 'react'
import { TauriAPI } from '@/lib/tauri-api'

interface ProjectDetailModalProps {
  project: ProjectInfo
  onClose: () => void
}

export function ProjectDetailModal({ project, onClose }: ProjectDetailModalProps) {
  const [activities, setActivities] = useState<ActivityInfo[]>([])
  const [markdown, setMarkdown] = useState<string | null>(null)

  useEffect(() => {
    loadProjectData()
  }, [project.id])

  async function loadProjectData() {
    try {
      const acts = await TauriAPI.getActivities('')
      const projectActs = acts.filter(a => a.project_id === project.id)
      setActivities(projectActs.sort((a, b) => b.start_time - a.start_time))
    } catch {}
  }

  const startDate = new Date(project.start_date * 1000).toISOString().slice(0, 10)
  const lastDate = new Date(project.last_activity_date * 1000).toISOString().slice(0, 10)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-app border border-primary rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-primary">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-xl font-medium text-primary">{project.title}</h2>
            <button
              onClick={onClose}
              className="text-muted hover:text-primary transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-4 text-sm text-muted">
            <span className="px-2 py-0.5 rounded bg-white/5">{project.status}</span>
            <span>{project.activity_count} 个活动</span>
            <span>{startDate} ~ {lastDate}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {project.description && (
            <div className="mb-6">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">项目描述</h3>
              <p className="text-sm text-secondary">{project.description}</p>
            </div>
          )}

          {activities.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">活动时间线</h3>
              <div className="space-y-2">
                {activities.map(act => (
                  <div key={act.id} className="pl-3 border-l-2 border-primary">
                    <div className="text-[10px] text-muted">
                      {new Date(act.start_time * 1000).toISOString().slice(0, 10)}
                    </div>
                    <div className="text-sm text-secondary">{act.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
