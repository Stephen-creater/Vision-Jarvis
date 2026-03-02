/// 记忆相关 Commands (V3)
///
/// 查询 activities / projects / habits / summaries / memory_chunks

use tauri::State;
use serde::{Deserialize, Serialize};
use chrono::NaiveDate;
use super::{ApiResponse, AppState};

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityInfo {
    pub id: String,
    pub title: String,
    pub start_time: i64,
    pub end_time: i64,
    pub duration_minutes: i64,
    pub application: String,
    pub category: String,
    pub tags: Vec<String>,
    pub summary: Option<String>,
    pub project_id: Option<String>,
    pub markdown_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetail {
    pub activity: ActivityInfo,
    pub screenshot_analyses: Vec<ScreenshotAnalysisInfo>,
    pub markdown_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotAnalysisInfo {
    pub screenshot_id: String,
    pub application: String,
    pub activity_type: String,
    pub activity_description: String,
    pub analyzed_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start_date: i64,
    pub last_activity_date: i64,
    pub activity_count: i32,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitInfo {
    pub id: String,
    pub pattern_name: String,
    pub pattern_type: String,
    pub confidence: f32,
    pub frequency: String,
    pub occurrence_count: i32,
    pub typical_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryInfo {
    pub id: String,
    pub summary_type: String,
    pub date_start: String,
    pub date_end: String,
    pub content: String,
    pub activity_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingStatsInfo {
    pub total_recordings: i64,
    pub analyzed_recordings: i64,
    pub total_activities: i64,
    pub total_projects: i64,
    pub total_habits: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryChunkInfo {
    pub id: String,
    pub file_path: String,
    pub text: String,
    pub activity_id: Option<String>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// 按日期查询活动
#[tauri::command]
pub async fn get_activities(
    state: State<'_, AppState>,
    date: String,
) -> Result<ApiResponse<Vec<ActivityInfo>>, String> {
    let parsed = match NaiveDate::parse_from_str(&date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(e) => return Ok(ApiResponse::error(format!("日期格式错误: {}", e))),
    };

    let start_ts = parsed.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    let end_ts = parsed.and_hms_opt(23, 59, 59).unwrap().and_utc().timestamp();

    let result = state.db.with_connection(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, title, start_time, end_time, duration_minutes,
                    application, category, tags, summary, project_id, markdown_path
             FROM activities
             WHERE start_time >= ?1 AND start_time <= ?2
             ORDER BY start_time ASC"
        )?;

        let rows = stmt.query_map(
            rusqlite::params![start_ts, end_ts],
            |row| {
                let tags_json: String = row.get(7)?;
                Ok(ActivityInfo {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    start_time: row.get(2)?,
                    end_time: row.get(3)?,
                    duration_minutes: row.get(4)?,
                    application: row.get(5)?,
                    category: row.get(6)?,
                    tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                    summary: row.get(8)?,
                    project_id: row.get(9)?,
                    markdown_path: row.get(10)?,
                })
            },
        )?.collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(rows)
    });

    Ok(result.into())
}

/// 活动详情（含关联的 screenshot_analyses + markdown 内容）
#[tauri::command]
pub async fn get_activity_detail(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<ActivityDetail>, String> {
    let storage_path = state.settings.get_storage_path();
    let result = state.db.with_connection(|conn| {
        // 查活动
        let mut stmt = conn.prepare(
            "SELECT id, title, start_time, end_time, duration_minutes,
                    application, category, tags, summary, project_id, markdown_path
             FROM activities WHERE id = ?1"
        )?;

        let (activity, md_path) = stmt.query_row([&id], |row| {
            let tags_json: String = row.get(7)?;
            let md_path: Option<String> = row.get(10)?;
            Ok((ActivityInfo {
                id: row.get(0)?,
                title: row.get(1)?,
                start_time: row.get(2)?,
                end_time: row.get(3)?,
                duration_minutes: row.get(4)?,
                application: row.get(5)?,
                category: row.get(6)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                summary: row.get(8)?,
                project_id: row.get(9)?,
                markdown_path: md_path.clone(),
            }, md_path))
        })?;

        // 查关联的 screenshot_ids (JSON array)
        let screenshot_ids_json: String = conn.prepare(
            "SELECT screenshot_ids FROM activities WHERE id = ?1"
        )?.query_row([&id], |row| row.get(0))?;

        let screenshot_ids: Vec<String> =
            serde_json::from_str(&screenshot_ids_json).unwrap_or_default();

        // 查 screenshot_analyses
        let analyses = if screenshot_ids.is_empty() {
            Vec::new()
        } else {
            let placeholders: Vec<String> = screenshot_ids.iter().enumerate()
                .map(|(i, _)| format!("?{}", i + 1))
                .collect();
            let sql = format!(
                "SELECT screenshot_id, application, activity_type, activity_description, analyzed_at
                 FROM screenshot_analyses
                 WHERE screenshot_id IN ({})
                 ORDER BY analyzed_at ASC",
                placeholders.join(", ")
            );

            let mut sa_stmt = conn.prepare(&sql)?;
            let params: Vec<&dyn rusqlite::types::ToSql> = screenshot_ids.iter()
                .map(|s| s as &dyn rusqlite::types::ToSql)
                .collect();

            let result = sa_stmt.query_map(params.as_slice(), |row| {
                Ok(ScreenshotAnalysisInfo {
                    screenshot_id: row.get(0)?,
                    application: row.get(1)?,
                    activity_type: row.get(2)?,
                    activity_description: row.get(3)?,
                    analyzed_at: row.get(4)?,
                })
            })?.collect::<rusqlite::Result<Vec<_>>>()?;
            result
        };

        // 读取 markdown 文件内容
        let markdown_content = md_path.and_then(|p| {
            let full_path = storage_path.join(&p);
            std::fs::read_to_string(&full_path).ok()
        });

        Ok(ActivityDetail {
            activity,
            screenshot_analyses: analyses,
            markdown_content,
        })
    });

    Ok(result.into())
}

/// 项目列表
#[tauri::command]
pub async fn get_projects(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<ProjectInfo>>, String> {
    let result = state.db.with_connection(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, title, description, start_date, last_activity_date,
                    activity_count, status
             FROM projects
             ORDER BY last_activity_date DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(ProjectInfo {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                start_date: row.get(3)?,
                last_activity_date: row.get(4)?,
                activity_count: row.get(5)?,
                status: row.get(6)?,
            })
        })?.collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(rows)
    });

    Ok(result.into())
}

/// 习惯列表
#[tauri::command]
pub async fn get_habits(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<HabitInfo>>, String> {
    let result = state.db.with_connection(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, pattern_name, pattern_type, confidence, frequency,
                    occurrence_count, typical_time
             FROM habits
             ORDER BY confidence DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(HabitInfo {
                id: row.get(0)?,
                pattern_name: row.get(1)?,
                pattern_type: row.get(2)?,
                confidence: row.get(3)?,
                frequency: row.get(4)?,
                occurrence_count: row.get(5)?,
                typical_time: row.get(6)?,
            })
        })?.collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(rows)
    });

    Ok(result.into())
}

/// 日总结
#[tauri::command]
pub async fn get_summary(
    state: State<'_, AppState>,
    date: String,
) -> Result<ApiResponse<Option<SummaryInfo>>, String> {
    let _ = match NaiveDate::parse_from_str(&date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(e) => return Ok(ApiResponse::error(format!("日期格式错误: {}", e))),
    };

    let result = state.db.with_connection(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, summary_type, date_start, date_end, content, activity_ids
             FROM summaries
             WHERE summary_type = 'daily' AND date_start = ?1"
        )?;

        let row = stmt.query_row([&date], |row| {
            let activity_ids_json: String = row.get(5)?;
            let activity_ids: Vec<String> =
                serde_json::from_str(&activity_ids_json).unwrap_or_default();

            Ok(SummaryInfo {
                id: row.get(0)?,
                summary_type: row.get(1)?,
                date_start: row.get(2)?,
                date_end: row.get(3)?,
                content: row.get(4)?,
                activity_count: activity_ids.len(),
            })
        });

        match row {
            Ok(s) => Ok(Some(s)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    });

    Ok(result.into())
}

/// 录制/分析状态统计
#[tauri::command]
pub async fn get_recording_stats(
    state: State<'_, AppState>,
) -> Result<ApiResponse<RecordingStatsInfo>, String> {
    let result = state.db.with_connection(|conn| {
        let total_recordings: i64 = conn.prepare("SELECT COUNT(*) FROM recordings")?
            .query_row([], |row| row.get(0))?;
        let analyzed_recordings: i64 = conn.prepare("SELECT COUNT(*) FROM recordings WHERE analyzed = 1")?
            .query_row([], |row| row.get(0))?;
        let total_activities: i64 = conn.prepare("SELECT COUNT(*) FROM activities")?
            .query_row([], |row| row.get(0))?;
        let total_projects: i64 = conn.prepare("SELECT COUNT(*) FROM projects")?
            .query_row([], |row| row.get(0))?;
        let total_habits: i64 = conn.prepare("SELECT COUNT(*) FROM habits")?
            .query_row([], |row| row.get(0))?;

        Ok(RecordingStatsInfo {
            total_recordings,
            analyzed_recordings,
            total_activities,
            total_projects,
            total_habits,
        })
    });

    Ok(result.into())
}

/// 搜索 memory_chunks（关键词 LIKE）
#[tauri::command]
pub async fn search_memories(
    state: State<'_, AppState>,
    query: String,
    limit: Option<usize>,
) -> Result<ApiResponse<Vec<MemoryChunkInfo>>, String> {
    let limit = limit.unwrap_or(20);

    let sanitized = query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");

    let result = state.db.with_connection(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, file_path, text, activity_id
             FROM memory_chunks
             WHERE text LIKE ?1 ESCAPE '\\'
             ORDER BY updated_at DESC
             LIMIT ?2"
        )?;

        let pattern = format!("%{}%", sanitized);
        let rows = stmt.query_map(
            rusqlite::params![pattern, limit as i64],
            |row| {
                Ok(MemoryChunkInfo {
                    id: row.get(0)?,
                    file_path: row.get(1)?,
                    text: row.get(2)?,
                    activity_id: row.get(3)?,
                })
            },
        )?.collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(rows)
    });

    Ok(result.into())
}

/// 手动触发日总结
#[tauri::command]
pub async fn trigger_daily_summary(
    state: State<'_, AppState>,
    date: Option<String>,
) -> Result<ApiResponse<SummaryInfo>, String> {
    let date = date.unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    let _ = match NaiveDate::parse_from_str(&date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(e) => return Ok(ApiResponse::error(format!("日期格式错误: {}", e))),
    };

    let pipeline = state.pipeline.clone();
    // 不直接调用 SummaryGenerator，而是通过 pipeline 暴露
    // 但 pipeline 没有直接暴露 summary_generator，所以从 db 直接构建
    let db = state.db.clone();
    let storage_path = state.settings.get_storage_path();

    let gen = crate::memory::summary_generator::SummaryGenerator::new(
        None,
        db,
        crate::memory::summary_generator::SummaryConfig {
            storage_root: storage_path,
            enable_ai: pipeline.is_ai_connected().await,
        },
    );

    match gen.generate_daily(&date).await {
        Ok(summary) => {
            Ok(ApiResponse::success(SummaryInfo {
                id: summary.id,
                summary_type: summary.summary_type.as_str().to_string(),
                date_start: summary.date_start,
                date_end: summary.date_end,
                content: summary.content,
                activity_count: summary.activity_ids.len(),
            }))
        }
        Err(e) => Ok(ApiResponse::error(format!("生成日总结失败: {}", e))),
    }
}

/// 录制分析文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisFileInfo {
    pub recording_id: String,
    pub file_path: String,
    pub analyzed_at: i64,
    pub application: String,
    pub activity_description: String,
}

/// 按日期列出所有录制分析（从 DB 查询，返回可用于前端展示的摘要列表）
#[tauri::command]
pub async fn list_analysis_files(
    state: State<'_, AppState>,
    date: String,
) -> Result<ApiResponse<Vec<AnalysisFileInfo>>, String> {
    let parsed = match NaiveDate::parse_from_str(&date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(e) => return Ok(ApiResponse::error(format!("日期格式错误: {}", e))),
    };

    let start_ts = parsed.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    let end_ts = parsed.and_hms_opt(23, 59, 59).unwrap().and_utc().timestamp();

    let result = state.db.with_connection(|conn| {
        let mut stmt = conn.prepare(
            "SELECT sa.screenshot_id, r.path, sa.analyzed_at, sa.application, sa.activity_description
             FROM screenshot_analyses sa
             JOIN recordings r ON r.id = sa.screenshot_id
             WHERE sa.analyzed_at >= ?1 AND sa.analyzed_at <= ?2
             ORDER BY sa.analyzed_at ASC"
        )?;

        let rows = stmt.query_map(
            rusqlite::params![start_ts, end_ts],
            |row| {
                Ok(AnalysisFileInfo {
                    recording_id: row.get(0)?,
                    file_path: row.get(1)?,
                    analyzed_at: row.get(2)?,
                    application: row.get(3)?,
                    activity_description: row.get(4)?,
                })
            },
        )?.collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(rows)
    });

    Ok(result.into())
}

/// 读取单条录制分析的 Markdown 内容
#[tauri::command]
pub async fn get_recording_analysis(
    state: State<'_, AppState>,
    recording_id: String,
) -> Result<ApiResponse<String>, String> {
    // 从 DB 获取录制文件路径
    let result = state.db.with_connection(|conn| {
        let path: String = conn.prepare(
            "SELECT path FROM recordings WHERE id = ?1"
        )?.query_row([&recording_id], |row| row.get(0))?;

        // .mp4 → .md
        let md_path = std::path::Path::new(&path).with_extension("md");

        // 尝试读取 MD 文件
        if md_path.exists() {
            let content = std::fs::read_to_string(&md_path)
                .map_err(|e| anyhow::anyhow!("读取分析MD失败: {}", e))?;
            Ok(content)
        } else {
            // 回退到 .json（兼容旧数据）
            let json_path = std::path::Path::new(&path).with_extension("json");
            if json_path.exists() {
                let content = std::fs::read_to_string(&json_path)
                    .map_err(|e| anyhow::anyhow!("读取分析JSON失败: {}", e))?;
                Ok(content)
            } else {
                Err(anyhow::anyhow!("录制 {} 没有对应的分析文件", recording_id))
            }
        }
    });

    Ok(result.into())
}
