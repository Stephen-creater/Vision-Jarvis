# 记忆处理系统输出统一为 Markdown

**日期**: 2026-03-02
**状态**: 等待确认
**目标**: 审计整个记忆处理管道的输出格式，将所有面向前端/用户的输出统一为 `.md`，明确哪些已完成、哪些需要改造

---

## 一、当前系统审计

### 完整数据管道（10 个模块）

```
screen_recorder → screenshot_analyzer → activity_grouper → markdown_generator
                                                        → project_extractor
                                                        → summary_generator
                                                        → habit_detector
                                                        → index_manager (chunker)
                                                        → pipeline (调度器)
                                                        → commands/memory.rs (API层)
```

### 各模块输出格式现状

| # | 模块 | 文件 | 输出格式 | 输出位置 | 状态 |
|---|------|------|---------|---------|------|
| 1 | `screen_recorder` | `capture/scheduler.rs` | `.mp4` 视频文件 | `recordings/{date}/{period}/` | ✅ 原始数据，无需改 |
| 2 | `screenshot_analyzer` | `memory/screenshot_analyzer.rs` | **`.json` sidecar** + DB 行 | 与 `.mp4` 同目录，同名 `.json` | ⚠️ **需要改造** |
| 3 | `activity_grouper` | `memory/activity_grouper.rs` | DB 行（内存中间态） | `activities` 表 | ✅ 中间数据，无需文件输出 |
| 4 | `markdown_generator` | `memory/markdown_generator.rs` | **`.md`** | `activities/{YYYY-MM-DD}/activity-{NNN}.md` | ✅ 已是 MD |
| 5 | `project_extractor` | `memory/project_extractor.rs` | **`.md`** | `project/{name}.md` | ✅ ���是 MD |
| 6 | `summary_generator` | `memory/summary_generator.rs` | **`.md`** | `long_term_memory/daily_summary/{YYYY-MM-DD}.md` | ✅ 已是 MD |
| 7 | `habit_detector` | `memory/habit_detector.rs` | **`.md`** | `habits/{pattern_name}.md` | ✅ 已是 MD |
| 8 | `index_manager` | `memory/index_manager.rs` | DB 行（`memory_chunks`） | SQLite | ✅ 内部索引，无需文件输出 |
| 9 | `pipeline` | `memory/pipeline.rs` | 无文件输出（调度器） | - | ✅ 无需改 |
| 10 | `commands/memory.rs` | `commands/memory.rs` | **JSON API 响应** | Tauri IPC | ⚠️ **需要增加 MD 读取能力** |

---

## 二、问题诊断

### 已经是 MD 输出的（4 个） ✅

| 模块 | 输出路径 | 内容质量 |
|------|---------|---------|
| `markdown_generator` | `activities/{date}/activity-*.md` | 有 YAML frontmatter + AI 总结 + 时间线，**质量好** |
| `project_extractor` | `project/{name}.md` | 有 YAML frontmatter + 相关活动列表，**质量好** |
| `summary_generator` | `long_term_memory/daily_summary/{date}.md` | 有 YAML frontmatter + AI/模板总结，**质量好** |
| `habit_detector` | `habits/{name}.md` | 有模式描述 + 置信度 + 典型时间，**质量好** |

### 需要改造的（2 个） ⚠️

#### 问题 1：`screenshot_analyzer` 输出 `.json` sidecar

**现状**：每次分析完一个录制片段后，在 `.mp4` 同目录写一个 `.json` 文件，内容是 AI 的原始 JSON 响应。

**文件位置**：`recordings/{YYYYMMDD}/{period}/{HH-MM-SS}_{uuid}.json`

**内容示例**：
```json
{
  "application": "VS Code",
  "activity_type": "work",
  "activity_description": "编写 Rust 代码",
  "key_elements": ["main.rs", "pipeline.rs"],
  "ocr_text": "fn main() {...}",
  "context_tags": ["rust", "coding"],
  "productivity_score": 8,
  "activity_category": "work",
  "activity_summary": "在 VS Code 中编写内存管道模块",
  "project_name": "Vision-Jarvis",
  "accomplishments": ["完成 pipeline 调度器"]
}
```

**问题**：
- 这是原始的"每分钟"分析数据，是整个管道的**基础原料**
- 下游 `activity_grouper` 从 DB 读取这些字段做分组，不直接读 JSON 文件
- JSON 文件主要作为**调试和备份**用途
- 前端**不直接消费**这些 JSON 文件

**决策**：**转为 `.md` 但保留 JSON 数据在 frontmatter 中**

#### 问题 2：`commands/memory.rs` API 层缺少 MD 直读能力

**现状**：所有 Tauri 命令（`get_activities`、`get_summary` 等）都从 **SQLite 查询**返回结构化 JSON，不读取磁盘上的 `.md` 文件。

**问题**：
- 前端拿到的 `SummaryInfo.content` 是 DB 中存的 markdown 字符串，可以直接渲染
- 但 `ActivityInfo` 没有 `markdown_content` 字段 — 前端无法直接看活动的完整 MD
- 前端没有安装 markdown 渲染库

---

## 三、改造计划

### Phase 1：`screenshot_analyzer` — JSON sidecar 转为 MD

**影响文件**：`src-tauri/src/memory/screenshot_analyzer.rs`

**改造内容**：
- 将 `save_analysis_json()` 函数从写 `.json` 改为写 `.md`
- 输出格式：YAML frontmatter（所有结构化字段） + Markdown body（人可读描述）
- 文件扩展名从 `.json` 改为 `.md`

**输出示例**：
```markdown
---
recording_id: "abc-123"
analyzed_at: "2026-03-02T10:30:00+08:00"
application: "VS Code"
activity_category: "work"
productivity_score: 8
activity_description: "编写 Rust 代码"
project_name: "Vision-Jarvis"
context_tags: ["rust", "coding", "tauri"]
key_elements: ["main.rs", "pipeline.rs"]
accomplishments: ["完成 pipeline 调度器"]
---

# 录制分析：编写 Rust 代码

**应用**: VS Code
**分类**: work | **生产力**: 8/10
**项目**: Vision-Jarvis

## 活动摘要

在 VS Code 中编写内存管道模块

## 关键元素

- main.rs
- pipeline.rs

## 完成事项

- 完成 pipeline 调度器

## OCR 文本

```
fn main() {...}
```
```

**注意**：
- 所有结构化数据保留在 YAML frontmatter 中，下游 `index_manager` 的 chunker 已自动跳过 frontmatter
- Body 是人可读的渲染，方便前端直接展示
- DB 存储**不变**（`screenshot_analyses` 表继续存结构化字段）
- `activity_grouper` 继续从 DB 读取，不受影响

**复杂度**：LOW — 只改一个写文件的函数

---

### Phase 2：`commands/memory.rs` — 增加 MD 内容直读

**影响文件**：`src-tauri/src/commands/memory.rs`

**改造内容**：

#### 2a. `ActivityInfo` 增加 `markdown_content` 字段

```rust
#[derive(Debug, Serialize)]
pub struct ActivityInfo {
    // ...现有字段...
    pub markdown_path: Option<String>,      // MD 文件相对路径
    pub markdown_content: Option<String>,   // MD 文件完整内容（按需加载）
}
```

- `get_activities(date)` 返回列表时 `markdown_content = None`（节省带宽）
- `get_activity_detail(id)` 返回详情时读取 `.md` 文件填充 `markdown_content`

#### 2b. 新增 `get_recording_analysis` 命令

```rust
#[tauri::command]
pub async fn get_recording_analysis(
    recording_id: String,
    db: State<'_, Arc<Database>>,
    settings: State<'_, Arc<RwLock<AppSettings>>>,
) -> Result<RecordingAnalysisInfo, String> {
    // 读取 recordings/{date}/{period}/{name}.md 并返回
}
```

返回单条录制分析的 MD 内容，前端可以直接渲染。

#### 2c. 新增 `list_analysis_files` 命令

```rust
#[tauri::command]
pub async fn list_analysis_files(
    date: String,
    settings: State<'_, Arc<RwLock<AppSettings>>>,
) -> Result<Vec<AnalysisFileInfo>, String> {
    // 扫描 recordings/{date}/ 下所有 .md 文件
}
```

前端可以按日期浏览所有原始录制分析 MD。

**复杂度**：MEDIUM — 需要添加 3 个新命令 + 修改 1 个现有结构体

---

### Phase 3：前端 — 安装 MD 渲染器 + 接入 API

**影响文件**：
- `package.json` — 添加 `react-markdown` + `remark-gfm` 依赖
- `src/lib/tauri-api.ts` — 添加新的 TypeScript 类型和 API 方法
- `src/components/memory/MemoryPage.tsx` — 替换硬编码为真实 API 调用

**改造内容**：

#### 3a. 安装依赖

```bash
pnpm add react-markdown remark-gfm rehype-raw
```

#### 3b. 添加 TypeScript 类型

```typescript
// tauri-api.ts 新增类型
interface ActivityInfo {
  id: string
  title: string
  start_time: number
  end_time: number
  duration_minutes: number
  application: string
  category: string
  tags: string[]
  summary?: string
  project_id?: string
  markdown_path?: string
}

interface ActivityDetail {
  activity: ActivityInfo
  markdown_content?: string
  screenshot_analyses: ScreenshotAnalysisInfo[]
}

interface SummaryInfo {
  id: string
  summary_type: string
  date_start: string
  date_end: string
  content: string  // Markdown 字符串
  activity_count: number
}

interface RecordingAnalysisInfo {
  recording_id: string
  markdown_content: string
  analyzed_at: number
}
```

#### 3c. 创建 MarkdownRenderer 组件

```typescript
// src/components/common/MarkdownRenderer.tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  )
}
```

#### 3d. MemoryPage 接入真实数据

- 左侧栏：调用 `get_activities(date)` 显示活动列表
- 右侧面板：选中活动后调用 `get_activity_detail(id)` 展示 MD 内容
- 搜索：调用 `search_memories(query)` 并渲染结果
- 日总结：调用 `get_summary(date)` 渲染 MD

**复杂度**：HIGH — 前端改动最大，但都是接入性工作

---

## 四、统一后的输出地图

改造完成后，磁盘上的文件结构：

```
{storage_root}/
├── recordings/{YYYYMMDD}/{period}/
│   ├── {HH-MM-SS}_{uuid}.mp4              # 原始录制（不变）
│   └── {HH-MM-SS}_{uuid}.md               # ← 从 .json 改为 .md
│
├── activities/{YYYY-MM-DD}/
│   └── activity-{NNN}.md                   # 活动聚合 MD（已有）
│
├── project/{name}.md                       # 项目 MD（已有）
│
├── long_term_memory/daily_summary/
│   └── {YYYY-MM-DD}.md                     # 日总结 MD（已有）
│
└── habits/{pattern_name}.md                # 习惯 MD（已有）
```

**全部 `.md`，零 `.json` 文件输出**。

---

## 五、数据流总览（改造后）

```
录制 (.mp4)
  ↓ screenshot_analyzer
分析 (.md) ← 改造点 ①                 → DB (screenshot_analyses)
  ↓ activity_grouper (从 DB 读)
活动会话 (内存)
  ↓ markdown_generator
活动 MD (.md) ✅                       → DB (activities)
  ↓ project_extractor
项目 MD (.md) ✅                       → DB (projects)
  ↓ summary_generator (23:00)
日总结 MD (.md) ✅                     → DB (summaries)
  ↓ habit_detector (每日)
习惯 MD (.md) ✅                       → DB (habits)
  ↓ index_manager
  索引 chunks (DB only) ✅

前端 ← commands/memory.rs ← 改造点 ②  → 读 DB + 读 MD 文件
```

---

## 六、实施步骤与优先级

| Phase | 内容 | 影响文件 | 复杂度 | 优先级 |
|-------|------|---------|--------|--------|
| 1 | `screenshot_analyzer` JSON→MD | `screenshot_analyzer.rs` | LOW | P1 |
| 2a | `ActivityInfo` 增加 `markdown_path` | `commands/memory.rs` | LOW | P1 |
| 2b | 新增 `get_recording_analysis` 命令 | `commands/memory.rs` | LOW | P2 |
| 2c | 新增 `list_analysis_files` 命令 | `commands/memory.rs` | LOW | P2 |
| 3a | 安装 `react-markdown` | `package.json` | LOW | P1 |
| 3b | 添加 TypeScript 类型 | `tauri-api.ts` | LOW | P1 |
| 3c | 创建 `MarkdownRenderer` 组件 | 新建 `MarkdownRenderer.tsx` | LOW | P1 |
| 3d | `MemoryPage` 接入真实 API | `MemoryPage.tsx` | HIGH | P1 |

---

## 七、风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 已有 `.json` 文件不兼容 | LOW | 改造只影响新写入的文件，旧 `.json` 不受影响，`index_manager` 只索引 `.md` |
| `activity_grouper` 依赖 JSON 文件 | NONE | `activity_grouper` 从 DB 读取，不读文件 |
| MD 文件体积增大 | LOW | YAML frontmatter + body 比纯 JSON 大约 20-30%，可忽略 |
| 前端 bundle 增大 | LOW | `react-markdown` gzip 后约 12KB |
| 旧数据迁移 | OPTIONAL | 可以写一个一次性脚本把 `recordings/**/*.json` 转为 `.md`，但不是必须的 |

---

**等待用户确认**: 这个计划是否符合你的预期？是否需要调整？

关键决策点：
1. 旧的 `.json` 文件是否需要批量迁移为 `.md`？还是只管新数据？
2. Phase 3d（前端接入）是否在本次一起做？还是分开？
3. 是否需要保留 `.json` 作为调试备份（双写 `.md` + `.json`）？
