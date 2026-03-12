import { useState, useEffect } from 'react'
import { TauriAPI, type ProjectInfo } from '@/lib/tauri-api'
import { ProjectCard } from './ProjectCard'
import { ProjectDetailModal } from './ProjectDetailModal'
import { showNotification } from '@/lib/utils'

export function ProjectsPanel() {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    try {
      const data = await TauriAPI.getProjects()
      setProjects(data)
    } catch (err) {
      showNotification('加载项目失败: ' + err, 'error')
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter ? projects.filter(p => p.status === filter) : projects
  const statuses = [...new Set(projects.map(p => p.status))]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted">加载中...</div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center select-none">
          <div className="text-5xl mb-5 opacity-20">📁</div>
          <h3 className="text-xl font-medium text-primary mb-1.5">暂无项目记录</h3>
          <p className="text-sm text-muted">开发类活动会自动识别为项目</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {statuses.length > 1 && (
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
            {statuses.map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                  filter === status ? 'bg-white/10 text-primary' : 'text-muted hover:text-secondary hover:bg-white/5',
                ].join(' ')}
              >
                {status}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-3">
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => setSelectedProject(project)}
            />
          ))}
        </div>
      </div>

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </>
  )
}
