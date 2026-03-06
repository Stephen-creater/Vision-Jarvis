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
  const activeIndex = tabs.findIndex(t => t.id === activeTab)

  return (
    <div className="relative flex gap-1 p-1 bg-secondary rounded-xl border border-primary">
      <div
        className="absolute top-1 bottom-1 bg-white/10 rounded-lg transition-all duration-200"
        style={{
          left: `calc(${activeIndex * 25}% + 4px)`,
          width: 'calc(25% - 8px)'
        }}
      />
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={[
            'relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap',
            activeTab === tab.id
              ? 'text-primary'
              : 'text-muted hover:text-secondary',
          ].join(' ')}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}
