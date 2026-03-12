import { useState, useEffect } from 'react'
import { TauriAPI } from '@/lib/tauri-api'
import type { StorageInfo, FileInfo } from '@/lib/tauri-api'
import { formatBytes, formatDate, showNotification } from '@/lib/utils'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

export function FileBrowser() {
  return (
    <ErrorBoundary>
      <FileBrowserContent />
    </ErrorBoundary>
  )
}

function FileBrowserContent() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    TauriAPI.getStorageInfo().then(setStorageInfo).catch(console.error).finally(() => setLoading(false))
  }, [])

  async function loadFiles(folder: string) {
    setCurrentFolder(folder)
    try {
      const list = await TauriAPI.listFiles(folder)
      setFiles(list)
    } catch (err) {
      showNotification('加载文件失败: ' + err, 'error')
    }
  }

  async function handleOpenFolder() {
    if (!storageInfo || !currentFolder) return
    try {
      await TauriAPI.openFolder(storageInfo.root_path + '/' + currentFolder)
    } catch (err) {
      showNotification('打开文件夹失败: ' + err, 'error')
    }
  }

  async function handleCleanup() {
    if (!currentFolder) return
    try {
      const result = await TauriAPI.cleanupOldFiles(30)
      showNotification(`已删除 ${result.deleted_count} 个文件，释放 ${formatBytes(result.freed_bytes)}`, 'success')
      setShowModal(false)
      loadFiles(currentFolder)
    } catch (err) {
      showNotification('清理失败: ' + err, 'error')
    }
  }

  const usagePercent = storageInfo
    ? Math.min((storageInfo.total_used_bytes / (10 * 1024 ** 3)) * 100, 100)
    : 0

  const folderTabs = [
    { key: 'Screenshots', label: '截图' },
    { key: 'Recordings', label: '录制' },
    { key: 'LongTermMemory', label: '长期记忆' },
    { key: 'Project', label: '项目' },
    { key: 'Habits', label: '习惯' },
    { key: 'Logs', label: '日志' },
  ]

  return (
    <div className="w-screen h-screen bg-page overflow-y-auto custom-scrollbar">
      <div className="max-w-[1200px] mx-auto p-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-[28px] font-bold">文件管理</h1>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-card border border-primary rounded-[12px] text-secondary font-medium hover:border-active hover:text-primary transition-colors cursor-pointer"
          >返回</button>
        </div>

        {/* Storage Overview */}
        <div className="bg-card border border-primary rounded-[20px] p-7">
          <h2 className="text-primary text-lg font-bold mb-6">存储概览</h2>
          {loading ? (
            <div className="text-muted text-center py-8">正在加载存储信息...</div>
          ) : storageInfo ? (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-secondary text-sm">总使用量</span>
                  <span className="text-primary font-mono">{formatBytes(storageInfo.total_used_bytes)}</span>
                </div>
                <div className="h-[2px] bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${usagePercent}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '录制', value: storageInfo.recordings_bytes },
                  { label: '长期记忆', value: storageInfo.long_term_memory_bytes },
                  { label: '项目', value: storageInfo.project_bytes },
                  { label: '习惯', value: storageInfo.habits_bytes },
                  { label: '截图', value: storageInfo.screenshots_bytes },
                  { label: '数据库', value: storageInfo.database_bytes },
                  { label: '日志', value: storageInfo.logs_bytes },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-input rounded-[12px] p-4 text-center">
                    <div className="text-xs text-muted uppercase tracking-wider mb-2">{label}</div>
                    <div className="text-secondary font-mono text-lg">{formatBytes(value)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="text-muted">文件总数: <span className="text-primary">{storageInfo.total_files}</span></span>
                <span className="text-muted">路径: <span className="text-secondary font-mono text-xs">{storageInfo.root_path}</span></span>
              </div>
            </>
          ) : null}
        </div>

        {/* File Browser */}
        <div className="bg-card border border-primary rounded-[20px] p-7">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-primary text-lg font-bold">文件浏览</h2>
            <div className="flex gap-2">
              {folderTabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => loadFiles(key)}
                  className={`px-4 py-2 rounded-[10px] text-sm font-medium transition-all ${
                    currentFolder === key
                      ? 'bg-white/90 text-black shadow-sm'
                      : 'bg-input text-muted hover:text-primary'
                  }`}
                >{label}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {files.length === 0 ? (
              <div className="text-muted text-center py-8">
                {currentFolder ? '暂无文件' : '选择一个文件夹查看文件'}
              </div>
            ) : files.map(file => (
              <div key={file.path} className="flex items-center justify-between p-3 bg-input rounded-[10px] hover:bg-secondary transition-colors">
                <div>
                  <div className="text-sm text-primary font-mono">{file.name}</div>
                  <div className="text-xs text-muted mt-1">{formatDate(file.modified_at)}</div>
                </div>
                <span className="text-xs text-muted font-mono">{formatBytes(file.size_bytes)}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-4 mt-6 pt-6 border-t border-primary">
            <button
              onClick={handleOpenFolder}
              disabled={!currentFolder}
              className="px-6 py-3 bg-input rounded-[12px] text-secondary font-medium hover:bg-secondary hover:text-primary transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >在 Finder 中打开</button>
            <button
              onClick={() => setShowModal(true)}
              disabled={!currentFolder}
              className="px-6 py-3 bg-transparent border border-primary rounded-[12px] text-secondary font-medium hover:border-active hover:text-primary transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >清理旧文件 (30天+)</button>
          </div>
        </div>
      </div>

      {/* Cleanup Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-primary rounded-[20px] p-8 max-w-md mx-4">
            <h3 className="text-primary text-xl font-bold mb-4">确认清理</h3>
            <p className="text-secondary mb-6">这将永久删除所有 30 天前的文件。此操作无法撤销。</p>
            <div className="flex gap-4 justify-end">
              <button onClick={() => setShowModal(false)} className="px-6 py-3 bg-input rounded-[12px] text-secondary font-medium hover:bg-secondary hover:text-primary transition-colors cursor-pointer">取消</button>
              <button onClick={handleCleanup} className="px-6 py-3 bg-white rounded-[12px] text-black font-medium hover:bg-white/80 transition-colors cursor-pointer">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
