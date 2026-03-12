import type { ProjectInfo } from '@/lib/tauri-api'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

interface ProjectCardProps {
  project: ProjectInfo
  onClick: () => void
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const startDate = new Date(project.start_date * 1000).toISOString().slice(0, 10)
  const lastDate = new Date(project.last_activity_date * 1000).toISOString().slice(0, 10)

  return (
    <Card interactive onClick={onClick} className="animate-slide-up border-l-2 border-l-accent-blue/30">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-primary">{project.title}</h3>
        <Badge variant={project.status === 'active' ? 'active' : 'default'}>
          {project.status}
        </Badge>
      </div>

      {project.description && (
        <p className="text-xs text-muted mb-3 line-clamp-2">{project.description}</p>
      )}

      <div className="flex gap-4 text-xs text-muted">
        <span>{project.activity_count} 个活动</span>
        <span>{startDate} ~ {lastDate}</span>
      </div>
    </Card>
  )
}
