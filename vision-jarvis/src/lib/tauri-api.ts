import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'

// ============================================================================
// Types (match Rust structs)
// ============================================================================

export interface AppSettings {
  memory_enabled: boolean
  capture_interval_seconds: number
  storage_path: string
  storage_limit_mb: number
  auto_start: boolean
  app_launch_text: string

  morning_reminder_enabled: boolean
  morning_reminder_time: string
  morning_reminder_message: string

  water_reminder_enabled: boolean
  water_reminder_start: string
  water_reminder_end: string
  water_reminder_interval_minutes: number
  water_reminder_message: string

  sedentary_reminder_enabled: boolean
  sedentary_reminder_start: string
  sedentary_reminder_end: string
  sedentary_reminder_threshold_minutes: number
  sedentary_reminder_message: string

  screen_inactivity_reminder_enabled: boolean
  screen_inactivity_minutes: number
  screen_inactivity_message: string

  openai_api_key: string | null
}

export type UpdateSettingsParams = Partial<AppSettings>
export type ResetSettingsParams = Record<string, never>

export interface SchedulerStatus {
  is_running: boolean
  interval_seconds: number
  memory_enabled: boolean
  storage_path: string
}

export interface ScreenshotInfo {
  id: string
  path: string
  captured_at: number
  analyzed: boolean
}

export type ProviderType = 'OpenAI' | 'Claude' | 'Gemini' | 'Qwen' | 'AIHubMix' | 'OpenRouter' | 'SiliconFlow'

export interface AIProviderConfig {
  id: string
  name: string
  api_base_url: string
  api_key: string
  model: string
  enabled: boolean
  is_active: boolean
  provider_type: ProviderType
  video_model?: string | null
}

export interface AIConfig {
  providers: AIProviderConfig[]
  active_provider_id: string | null
}

export interface AIConfigSummary {
  has_provider: boolean
  active_provider_name: string | null
  active_model: string | null
  provider_count: number
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  is_free: boolean
  description: string
}

export interface StorageInfo {
  total_used_bytes: number
  screenshots_bytes: number
  recordings_bytes: number
  long_term_memory_bytes: number
  project_bytes: number
  habits_bytes: number
  database_bytes: number
  logs_bytes: number
  temp_bytes: number
  total_files: number
  root_path: string
}

export interface FileInfo {
  name: string
  path: string
  size_bytes: number
  created_at: number
  modified_at: number
  extension: string | null
}

export interface CleanupResult {
  deleted_count: number
  freed_bytes: number
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

// Memory types
export interface ActivityInfo {
  id: string
  title: string
  start_time: number
  end_time: number
  duration_minutes: number
  application: string
  category: string
  tags: string[]
  summary: string | null
  project_id: string | null
  markdown_path: string | null
}

export interface ScreenshotAnalysisInfo {
  screenshot_id: string
  application: string
  activity_type: string
  activity_description: string
  analyzed_at: number
}

export interface ActivityDetail {
  activity: ActivityInfo
  screenshot_analyses: ScreenshotAnalysisInfo[]
  markdown_content: string | null
}

export interface ProjectInfo {
  id: string
  title: string
  description: string | null
  start_date: number
  last_activity_date: number
  activity_count: number
  status: string
}

export interface HabitInfo {
  id: string
  pattern_name: string
  pattern_type: string
  confidence: number
  frequency: string
  occurrence_count: number
  typical_time: string | null
}

export interface SummaryInfo {
  id: string
  summary_type: string
  date_start: string
  date_end: string
  content: string
  activity_count: number
}

export interface RecordingStatsInfo {
  total_recordings: number
  analyzed_recordings: number
  total_activities: number
  total_projects: number
  total_habits: number
}

export interface MemoryChunkInfo {
  id: string
  file_path: string
  text: string
  activity_id: string | null
}

export interface AnalysisFileInfo {
  recording_id: string
  file_path: string
  analyzed_at: number
  application: string
  activity_description: string
}

// ============================================================================
// API helpers
// ============================================================================

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const response = await invoke<ApiResponse<T>>(cmd, args)
  if (!response.success || response.data === null) {
    throw new Error(response.error || `Command ${cmd} failed`)
  }
  return response.data
}

// ============================================================================
// Cache
// ============================================================================

let settingsCache: AppSettings | null = null

// ============================================================================
// TauriAPI
// ============================================================================

export const TauriAPI = {
  // Settings
  async getSettings(): Promise<AppSettings> {
    if (settingsCache) return settingsCache
    const settings = await call<AppSettings>('get_settings')
    settingsCache = settings
    return settings
  },

  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings()
    const merged = { ...current, ...updates }
    await call<boolean>('update_settings', { settings: merged })
    settingsCache = merged
    emit('settings:changed', merged).catch(() => {})
    return merged
  },

  async resetSettings(): Promise<AppSettings> {
    const settings = await call<AppSettings>('reset_settings')
    settingsCache = settings
    emit('settings:changed', settings).catch(() => {})
    return settings
  },

  invalidateCache() {
    settingsCache = null
  },

  // Auto Start
  async enableAutoStart(): Promise<void> {
    await invoke('plugin:autostart|enable')
  },

  async disableAutoStart(): Promise<void> {
    await invoke('plugin:autostart|disable')
  },

  // Screenshots
  async captureScreenshot(): Promise<ScreenshotInfo> {
    return call<ScreenshotInfo>('capture_screenshot')
  },

  async getScreenshots(limit?: number, offset?: number): Promise<ScreenshotInfo[]> {
    return call<ScreenshotInfo[]>('get_screenshots', { limit, offset })
  },

  async deleteScreenshot(id: string): Promise<boolean> {
    return call<boolean>('delete_screenshot', { id })
  },

  async getSchedulerStatus(): Promise<SchedulerStatus> {
    return call<SchedulerStatus>('get_scheduler_status')
  },

  // Storage
  async getStorageInfo(): Promise<StorageInfo> {
    return call<StorageInfo>('get_storage_info')
  },

  async listFiles(folder?: string): Promise<FileInfo[]> {
    return call<FileInfo[]>('list_files', { folder })
  },

  async cleanupOldFiles(days?: number): Promise<CleanupResult> {
    return call<CleanupResult>('cleanup_old_files', { days })
  },

  async deleteFile(path: string): Promise<boolean> {
    return call<boolean>('delete_file', { path })
  },

  async openFolder(path: string): Promise<string> {
    return call<string>('open_folder', { path })
  },

  // AI Config
  async getAIConfigSummary(): Promise<AIConfigSummary> {
    return call<AIConfigSummary>('get_ai_config_summary')
  },

  async getAIConfig(): Promise<AIConfig> {
    return call<AIConfig>('get_ai_config')
  },

  async updateAIApiKey(providerId: string, apiKey: string): Promise<boolean> {
    return call<boolean>('update_ai_api_key', { providerId, apiKey })
  },

  async updateAIProviderConfig(config: AIProviderConfig): Promise<boolean> {
    return call<boolean>('update_ai_provider_config', { providerConfig: config })
  },

  async setActiveAIProvider(providerId: string): Promise<boolean> {
    return call<boolean>('set_active_ai_provider', { providerId })
  },

  async testAIConnection(providerId: string): Promise<string> {
    return call<string>('test_ai_connection', { providerId })
  },

  async getAvailableAIProviders(): Promise<ModelInfo[]> {
    return call<ModelInfo[]>('get_available_ai_providers')
  },

  async deleteAIProvider(providerId: string): Promise<boolean> {
    return call<boolean>('delete_ai_provider', { providerId })
  },

  async resetAIConfig(): Promise<boolean> {
    return call<boolean>('reset_ai_config')
  },

  async connectAIToPipeline(): Promise<string> {
    return call<string>('connect_ai_to_pipeline')
  },

  async getPipelineStatus(): Promise<Record<string, unknown>> {
    return call<Record<string, unknown>>('get_pipeline_status')
  },

  // Notifications
  async getPendingNotifications(): Promise<unknown[]> {
    return call<unknown[]>('get_pending_notifications')
  },

  async dismissNotification(id: string): Promise<boolean> {
    return call<boolean>('dismiss_notification', { id })
  },

  async getNotificationHistory(limit?: number): Promise<unknown[]> {
    return call<unknown[]>('get_notification_history', { limit })
  },

  async respondToSuggestion(id: string, action: string): Promise<boolean> {
    return call<boolean>('respond_to_suggestion', { id, action })
  },

  async getSuggestionHistory(limit?: number): Promise<unknown[]> {
    return call<unknown[]>('get_suggestion_history', { limit })
  },

  // Memory
  async getActivities(date: string): Promise<ActivityInfo[]> {
    return call<ActivityInfo[]>('get_activities', { date })
  },

  async getActivityDetail(id: string): Promise<ActivityDetail> {
    return call<ActivityDetail>('get_activity_detail', { id })
  },

  async getProjects(): Promise<ProjectInfo[]> {
    return call<ProjectInfo[]>('get_projects')
  },

  async getHabits(): Promise<HabitInfo[]> {
    return call<HabitInfo[]>('get_habits')
  },

  async getSummary(date: string): Promise<SummaryInfo | null> {
    const response = await invoke<ApiResponse<SummaryInfo | null>>('get_summary', { date })
    if (!response.success) throw new Error(response.error || 'get_summary failed')
    return response.data
  },

  async getRecordingStats(): Promise<RecordingStatsInfo> {
    return call<RecordingStatsInfo>('get_recording_stats')
  },

  async searchMemories(query: string, limit?: number): Promise<MemoryChunkInfo[]> {
    return call<MemoryChunkInfo[]>('search_memories', { query, limit })
  },

  async triggerDailySummary(date?: string): Promise<SummaryInfo> {
    return call<SummaryInfo>('trigger_daily_summary', { date })
  },

  async listAnalysisFiles(date: string): Promise<AnalysisFileInfo[]> {
    return call<AnalysisFileInfo[]>('list_analysis_files', { date })
  },

  async getRecordingAnalysis(recordingId: string): Promise<string> {
    return call<string>('get_recording_analysis', { recordingId })
  },
}
