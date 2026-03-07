interface Tab {
  id: 'activities' | 'habits' | 'projects' | 'summary'
  label: string
  icon: string
}

const tabs: Tab[] = [
  { id: 'activities', label: '活动', icon: '📊' },
  { id: 'habits', label: '习惯', icon: '🔄' },
  { id: 'projects', label: '项目', icon: '📁' },
  { id: 'summary', label: '总结', icon: '📝' },
]

interface MemoryTabsProps {
  activeTab: Tab['id']
  onChange: (tab: Tab['id']) => void
}

export function MemoryTabs({ activeTab, onChange }: MemoryTabsProps) {
  return (
    <div className="flex gap-2 p-1 bg-secondary rounded-xl border border-primary">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={[
            'flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-200',
            activeTab === tab.id
              ? 'bg-white/10 text-primary'
              : 'text-muted hover:text-secondary hover:bg-white/5',
          ].join(' ')}
        >
          <span className="text-lg leading-none">{tab.icon}</span>
          <span className="leading-none">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
