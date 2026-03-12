# 记忆处理管道 — 输出时机与配置

**日期**: 2026-03-02
**目标**: 明确每个输出模块的触发条件、执行频率、配置参数

---

## 一、完整管道流程图

```
用户设置录制间隔（30-300秒，默认60秒）
         ↓
┌────────────────────────────────────────────────────────────┐
│ 1. 屏幕录制 (CaptureScheduler)                              │
│    触发: 每 N 秒（用户可调）                                 │
│    输出: .mp4 视频文件                                       │
│    位置: recordings/{YYYYMMDD}/{period}/{HH-MM-SS}_{uuid}.mp4│
└────────────────────────────────────────────────────────────┘
         ↓ 录制完成后立即通过 channel 触发
┌────────────────────────────────────────────────────────────┐
│ 2. AI 视频分析 (ScreenshotAnalyzer)                         │
│    触发: 即时（录制完成后 0 秒延迟）                          │
│    输出: .md 文件 + DB 行                                    │
│    位置: recordings/{YYYYMMDD}/{period}/{HH-MM-SS}_{uuid}.md│
│    重试: 最多 2 次，间隔 3 秒                                │
└────────────────────────────────────────────────────────────┘
         ↓ 每 30 分钟批量处理
┌────────────────────────────────────────────────────────────┐
│ 3. 活动分组 (ActivityGrouper)                               │
│    触发: 每 30 分钟                                          │
│    输出: 内存中的 ActivitySession 对象                       │
│    条件: 至少 2 个录制 + 总时长 ≥60 秒                       │
└────────────────────────────────────────────────────────────┘
         ↓ 分组后立即生成
┌────────────────────────────────────────────────────────────┐
│ 4. Markdown 生成 (MarkdownGenerator)                        │
│    触发: 活动分组完成后立即执行                              │
│    输出: .md 文件 + DB 行                                    │
│    位置: activities/{YYYY-MM-DD}/activity-{NNN}.md          │
│    AI 总结: 可选（enable_ai_summary 开关）                   │
└────────────────────────────────────────────────────────────┘
         ↓ 分组后立即提取
┌────────────────────────────────────────────────────────────┐
│ 5. 项目提取 (ProjectExtractor)                              │
│    触发: 活动分组完成后立即执行                              │
│    输出: .md 文件 + DB 行                                    │
│    位置: project/{name}.md                                  │
│    条件: 活动时长 ≥30 分钟 + 开发类应用                      │
└────────────────────────────────────────────────────────────┘
         ↓ 每 10 分钟扫描
┌────────────────────────────────────────────────────────────┐
│ 6. 索引同步 (IndexManager)                                  │
│    触发: 每 10 分钟                                          │
│    输出: DB 行（memory_chunks 表）                           │
│    处理: 扫描所有 .md 文件，分块存储文本                     │
│    分块: 400 tokens/块，80 tokens 重叠                      │
└────────────────────────────────────────────────────────────┘
         ↓ 每 24 小时
┌────────────────────────────────────────────────────────────┐
│ 7. 习惯检测 (HabitDetector)                                 │
│    触发: 每 24 小时                                          │
│    输出: .md 文件 + DB 行                                    │
│    位置: habits/{pattern_name}.md                           │
│    条件: 回溯 30 天，≥5 次出现，置信度 ≥0.5                 │
└────────────────────────────────────────────────────────────┘
         ↓ 每天 23:00
┌────────────────────────────────────────────────────────────┐
│ 8. 日总结 (SummaryGenerator)                                │
│    触发: 每天 23:00（每 10 分钟检查一次）                    │
│    输出: .md 文件 + DB 行                                    │
│    位置: long_term_memory/daily_summary/{YYYY-MM-DD}.md     │
│    AI 总结: 可选（enable_ai 开关）                           │
└────────────────────────────────────────────────────────────┘
```

---

## 二、详细配置表

### 1. 屏幕录制 (CaptureScheduler)

| 参数 | 默认值 | 范围 | 说明 |
|------|--------|------|------|
| `interval_seconds` | 60 秒 | 30-300 秒 | 用户可通过前端滑块调整 |
| `fps` | 2 | 固定 | FFmpeg 录制帧率 |
| `codec` | libx264 | 固定 | 视频编码器 |
| `crf` | 30 | 固定 | 压缩质量（越大文件越小） |
| **输出路径** | `recordings/{YYYYMMDD}/{period}/{HH-MM-SS}_{uuid}.mp4` | - | 按日期和时段分目录 |
| **触发方式** | 定时循环 | - | `tokio::time::sleep(interval)` |
| **DB 写入** | 录制完成后 | - | `recordings` 表：id, path, start_time, end_time, duration_secs, fps, analyzed=0 |
| **通知机制** | channel 发送 | - | 通过 `mpsc::Sender` 立即通知 pipeline 分析 |

---

### 2. AI 视频分析 (ScreenshotAnalyzer)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max_retries` | 2 | 分析失败后最多重试次数 |
| **触发方式** | 即时（channel 驱动） | 录制完成后 0 秒延迟 |
| **重试间隔** | 3 秒 | `tokio::time::sleep(3s)` |
| **输出文件** | `.md` | 与 `.mp4` 同名，扩展名改为 `.md` |
| **输出格式** | YAML frontmatter + Markdown body | 结构化字段在 frontmatter，人可读描述在 body |
| **DB 写入** | `screenshot_analyses` 表 | 11 个字段：application, activity_type, activity_description, key_elements, ocr_text, context_tags, productivity_score, activity_category, activity_summary, project_name, accomplishments |
| **AI 提取字段** | 11 个 | 一次性提取所有下游需要的信息 |
| **依赖** | AI 客户端已连接 | 如果 AI 未连接，跳过分析，标记 `analyzed=1` |

**AI 提取的 11 个字段**：
1. `application` — 主应用名称
2. `activity_type` — work/entertainment/communication/learning/other
3. `activity_description` — 单句活动描述
4. `activity_category` — work/entertainment/communication/other
5. `activity_summary` — 多句活动摘要
6. `key_elements` — 关键元素数组（窗口标题、文件名等）
7. `ocr_text` — OCR 识别文本
8. `context_tags` — 上下文标签数组
9. `productivity_score` — 生产力评分 1-10
10. `project_name` — 项目名称（可选）
11. `accomplishments` — 完成事项数组

---

### 3. 活动分组 (ActivityGrouper)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **触发频率** | 每 30 分钟 | `Duration::from_secs(1800)` |
| `max_gap_seconds` | 300 秒（5 分钟） | 超过此间隔视为新活动 |
| `min_screenshots` | 2 | 至少 2 个录制分段才能成为活动 |
| `max_duration_seconds` | 7200 秒（2 小时） | 超过此时长自动拆分 |
| `min_duration_seconds` | 60 秒（1 分钟） | 短于此时长的活动被过滤 |
| **合并条件** | 同应用 + 同/相关活动描述 + 兼容活动类型 + 时间间隔 <5 分钟 + 总时长 <2 小时 | - |
| **标签亲和力** | 重叠 `context_tags` 可合并不同描述的分段 | - |
| **输出** | 内存中的 `ActivitySession` 对象 | 不直接写文件，传给 MarkdownGenerator |
| **DB 写入** | `activities` 表 | 由 MarkdownGenerator 完成后写入 |

---

### 4. Markdown 生成 (MarkdownGenerator)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **触发方式** | 活动分组完成后立即执行 | 每个 `ActivitySession` 生成一个 `.md` |
| `enable_ai_summary` | 可配置 | 是否调用 AI 生成活动总结（2-3 句话） |
| **输出路径** | `activities/{YYYY-MM-DD}/activity-{NNN}.md` | `{NNN}` 是当天的序号（001, 002...） |
| **输出格式** | YAML frontmatter + Markdown body | frontmatter 包含 id, title, start_time, end_time, duration_minutes, application, category, tags, screenshots 数组 |
| **AI 总结 prompt** | 活动信息 + 截图分析列表 → 2-3 句话总结 | 如果 AI 不可用或失败，回退到模板总结 |
| **模板总结** | "在{app}中花费了{N}分钟。期间共{M}个录制分段，主要活动包括：{title}。" | - |
| **DB 写入** | `activities` 表 | id, title, start_time, end_time, duration_minutes, application, category, screenshot_ids, tags, markdown_path, summary, indexed, created_at |

---

### 5. 项目提取 (ProjectExtractor)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **触发方式** | 活动分组完成后立即执行 | 处理所有 `project_id IS NULL` 的活动 |
| `similarity_threshold` | 0.6 | Jaccard + 子串相似度阈值 |
| **提取优先级** | 1. AI 提取的 `project_name` → 2. 规则提取 | - |
| **规则提取条件** | IDE 应用（VSCode/Xcode/IntelliJ 等） + 关键词（编写/开发/构建） + 活动时长 ≥30 分钟 | - |
| **匹配逻辑** | 与现有 `status='active'` 的项目比较相似度 | 相似度 ≥0.6 归入现有项目，否则创建新项目 |
| **输出路径** | `project/{slug}.md` | `{slug}` 是项目名的 kebab-case |
| **输出格式** | YAML frontmatter + Markdown body | frontmatter 包含 id, title, status, start_date, last_activity, activity_count |
| **DB 写入** | `projects` 表 + 更新 `activities.project_id` | - |

---

### 6. 索引同步 (IndexManager)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **触发频率** | 每 10 分钟 | `Duration::from_secs(600)` |
| **扫描范围** | `{storage_root}` 下所有 `.md` 文件 | 递归扫描 |
| **变更检测** | SHA-256 哈希 | 文件内容变化才重新索引 |
| **分块配置** | `target_tokens: 400, overlap_tokens: 80, min_tokens: 100` | - |
| **Token 估算** | CJK 字符 = 1 token，ASCII 词 = 1 token | - |
| **Frontmatter 处理** | 自动跳过 YAML frontmatter | 只索引 body 部分 |
| **输出** | `memory_chunks` 表 | id, file_path, text, chunk_index, token_count, hash, activity_id, updated_at |
| **Embedding** | 未实现 | 当前只存文本，不生成向量 |

---

### 7. 习惯检测 (HabitDetector)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **触发频率** | 每 24 小时 | `Duration::from_secs(86400)` |
| `lookback_days` | 30 天 | 回溯分析的天数 |
| `min_occurrences` | 5 次 | 低于此数不算习惯 |
| `min_confidence` | 0.5 | 低于此值不保存 |
| **检测模式** | 3 种 | 时间模式、触发模式、序列模式 |
| **时间模式** | 固定时间的习惯 | 例："每天 8:00 打开微信" |
| **触发模式** | 特定事件触发 | 例："打开 VSCode 后必看 GitHub" |
| **序列模式** | 固定顺序的活动序列 | 例："早晨例行：微信→邮件→日历" |
| **输出路径** | `habits/{slug}.md` | `{slug}` 是模式名的 kebab-case |
| **输出格式** | YAML frontmatter + Markdown body | frontmatter 包含 id, pattern_name, pattern_type, confidence, frequency, occurrence_count, typical_time |
| **DB 写入** | `habits` 表 | - |
| **置信度衰减** | 长时间未出现的习惯置信度下降 | 自动移除低置信度习惯 |

---

### 8. 日总结 (SummaryGenerator)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **触发时间** | 每天 23:00 | 本地时间 |
| **检查频率** | 每 10 分钟 | `Duration::from_secs(600)` |
| **去重机制** | 记录 `last_summary_date` | 同一天只生成一次 |
| `enable_ai` | 可配置 | 是否调用 AI 生成总结 |
| **AI 总结 prompt** | 活动列表 + accomplishments 聚合 → 散文总结 | - |
| **模板总结** | 应用时长分布 + 活动列表 | 如果 AI 不可用或失败 |
| **输出路径** | `long_term_memory/daily_summary/{YYYY-MM-DD}.md` | - |
| **输出格式** | YAML frontmatter + Markdown body | frontmatter 包含 id, type, date, activity_count, created_at |
| **DB 写入** | `summaries` 表 | id, summary_type, date_start, date_end, content, activity_ids, project_ids, markdown_path, created_at |

---

## 三、用户可调参数

| 参数 | 位置 | 默认值 | 范围 | 前端控制 |
|------|------|--------|------|---------|
| **录制间隔** | `capture_interval_seconds` | 60 秒 | 30-300 秒 | ✅ 滑块 |
| **全局记忆开关** | `memory_enabled` | true | true/false | ✅ Toggle |
| **AI 总结开关** | `enable_ai_summary` | 取决于 AI 是否连接 | true/false | ❌ 自动检测 |
| **存储路径** | `storage_path` | `~/Library/Application Support/vision-jarvis/` | 任意路径 | ✅ 设置页 |

---

## 四、性能与资源消耗

| 模块 | CPU | 内存 | 磁盘 I/O | 网络 |
|------|-----|------|---------|------|
| 屏幕录制 | 低（FFmpeg 2fps） | 低 | 中（写 .mp4） | 无 |
| AI 视频分析 | 低（异步） | 中（base64 编码） | 低（写 .md） | 高（API 调用） |
| 活动分组 | 低 | 低 | 无 | 无 |
| Markdown 生成 | 低 | 低 | 低（写 .md） | 低（可选 AI 总结） |
| 项目提取 | 低 | 低 | 低（写 .md） | 无 |
| 索引同步 | 中（递归扫描） | 中（文本分块） | 中（读所有 .md） | 无 |
| 习惯检测 | 中（30 天数据分析） | 中 | 低（写 .md） | 无 |
| 日总结 | 低 | 低 | 低（写 .md） | 低（可选 AI 总结） |

---

## 五、关键时间节点示例

假设用户设置录制间隔为 **60 秒**，从 **08:00** 开始使用：

| 时间 | 事件 | 输出 |
|------|------|------|
| 08:00:00 | 开始录制 | - |
| 08:01:00 | 录制完成 → 立即 AI 分析 | `08-00-00_{uuid}.mp4` + `08-00-00_{uuid}.md` |
| 08:02:00 | 录制完成 → 立即 AI 分析 | `08-01-00_{uuid}.mp4` + `08-01-00_{uuid}.md` |
| ... | 每分钟重复 | ... |
| 08:30:00 | **活动分组触发** | 查询所有未分组的录制（30 条），生成 1-3 个活动 |
| 08:30:01 | **Markdown 生成** | `activities/2026-03-02/activity-001.md` |
| 08:30:02 | **项目提取** | 如果是开发活动，更新或创建 `project/vision-jarvis.md` |
| 08:40:00 | **索引同步触发** | 扫描所有 `.md` 文件，分块存入 `memory_chunks` 表 |
| 09:00:00 | 活动分组触发 | 处理 08:30-09:00 的录制 |
| ... | 每 30 分钟重复 | ... |
| 23:00:00 | **日总结触发** | `long_term_memory/daily_summary/2026-03-02.md` |
| 次日 08:00 | **习惯检测触发** | 分析过去 30 天，更新 `habits/*.md` |

---

## 六、故障处理

| 故障场景 | 处理方式 |
|---------|---------|
| AI 分析失败 | 重试 2 次（间隔 3 秒），仍失败则标记 `analyzed=1` 跳过 |
| 录制文件损坏 | 检查文件存在且大小 >0，否则跳过该分段 |
| 活动分组无结果 | 不满足最小条件（<2 个录制或 <60 秒），不生成活动 |
| Markdown 生成失败 | 记录错误日志，不保存到 DB，下次分组时重试 |
| 索引同步失败 | 记录错误日志，下次 10 分钟后重试 |
| 日总结无活动 | 返回错误 "日期 {date} 没有活动记录" |

---

**总结**：整个管道是事件驱动 + 定时调度的混合模式，录制分析是即时的（0 延迟），其余模块按固定间隔批量处理。用户只能调整录制间隔，其余参数都是系统内部配置。
