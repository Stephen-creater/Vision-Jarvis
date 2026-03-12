# 实施计划：前端机制优化 — 现状分析与差距补全

**日期：** 2026-03-02
**状态：** 等待确认

---

## 一、现状全景分析

### 已完成（可用）

| 功能 | 文件 | 状态 |
|------|------|------|
| 悬浮球三态切换 | `floating-ball.astro` | ✅ 基本可用 |
| Settings 状态管理 | `settingsStore.ts` | ✅ 可用 |
| 设置页面（通用+AI） | `SettingsPage.tsx` | ✅ 可用 |
| 记忆页面（侧边栏） | `MemoryPage.tsx` | ⚠️ 半成品 |
| 文件管理 | `FileBrowser.tsx` | ✅ 基本可用 |
| Tauri API 层 | `tauri-api.ts` | ✅ 可用 |
| 全局样式（黑白灰） | `global.css` | ✅ 已重设计 |

### 核心差距清单

---

## 二、差距分析（按优先级排序）

### P0-CRITICAL: Asker 面板无功能

**现状：** `Asker.astro` 只有 UI 骨架（输入框+发送按钮），未接入任何逻辑。
- 无消息发送/接收
- 无 AI 调用集成
- 无聊天历史管理
- 无流式响应显示

**目标需求（来自 functional-specs）：** 用户可通过对话界面向 AI 提问，AI 基于屏幕记忆回答。

---

### P0-CRITICAL: Memory 页面 — 数据全为硬编码

**现状：**
- 短期记忆列表 ("开发 Vision-Jarvis 项目", "设计前端架构") 为硬编码占位符
- 搜索栏存在但未连接后端
- 右侧主内容区永远显示空状态 "想找哪段记忆"
- 无日期切换加载逻辑

**目标需求：**
- 从后端加载真实的 activities/projects/habits 数据
- 搜索功能连接后端查询
- 选中记忆条目后显示详情

---

### P1-HIGH: 多窗口状态同步缺失

**现状：**
- 每个窗口（floating-ball, memory, popup-setting）独立加载 settings
- Nanostores 是进程内状态管理，**跨窗口不同步**
- 在 Memory 页面切换记忆开关 → Header 的 Toggle 不会更新（除非手动订阅 Tauri 事件）
- `settingsCache` 在 `tauri-api.ts` 中是模块级变量，每个窗口各自一份

**影响场景：**
1. 在 Settings 页改 AI 配置 → 悬浮球不知道
2. 在 Memory 页关闭记忆 → Header toggle 可能仍显示开启
3. 在 Settings 页改录制间隔 → Memory 页的 slider 不更新

---

### P1-HIGH: UI 风格不统一（单色化未完成）

**现状残留彩色元素：**

| 文件 | 彩色代码 | 应改为 |
|------|----------|--------|
| `Header.astro:12` | `gradient-success` | `bg-white` (ON状态) |
| `Header.astro:22` | `stroke="#00D4FF"` | `stroke="currentColor"` + 白灰色 |
| `Header.astro:26` | `text-info` | `text-primary` |
| `Header.astro:35` | `stroke="#00D4FF"` | `stroke="currentColor"` |
| `Header.astro:39` | `text-info` | `text-primary` |
| `Header.astro:19,33` | `hover:border-glow` | `hover:border-active` |
| `Asker.astro:38` | `focus:border-glow` | `focus:border-active` |
| `Asker.astro:43` | `gradient-primary` | `bg-white text-black` |
| `FileBrowser.tsx:78` | `gradient-primary` | `bg-white` |
| `FileBrowser.tsx:83-89` | `text-info/success/warning` | `text-secondary` |
| `FileBrowser.tsx:115` | `gradient-primary text-white` | `bg-white/90 text-black` |
| `FileBrowser.tsx:161` | `bg-red-600` | `bg-white text-black` 或透明+白边框 |
| `utils.ts:3-5` | `bg-green-600/red-600/blue-600` | 黑白灰通知样式 |

---

### P1-HIGH: 错误处理 — 静默吞没 + 无全局兜底

**现状：**
```typescript
// SettingsPage.tsx 中多处 slider 的 onChange:
updateSettings({ water_reminder_interval_minutes: v }).catch(() => {})
updateSettings({ sedentary_reminder_threshold_minutes: v }).catch(() => {})
updateSettings({ screen_inactivity_minutes: v }).catch(() => {})
updateSettings({ storage_limit_mb: v }).catch(() => {})
```
- 设置保存失败用户完全无感知
- 无全局 Error Boundary

---

### P2-MEDIUM: SettingsPage 直接 DOM 操作

**现状：** React 组件中大量 `document.getElementById` 取值：
```typescript
const el = document.getElementById('launch-text') as HTMLTextAreaElement
const time = (document.getElementById('morning-time') as HTMLInputElement).value
```

**问题：**
- 不符合 React 范式
- 类型断言不安全
- 跨 render 可能引用失效的 DOM 节点

---

### P2-MEDIUM: FileBrowser 语言不一致

**现状：** 全英文 UI（"File Management", "Storage Overview", "Open in Finder"），但其他页面全中文。

---

### P2-MEDIUM: 录制状态无前端反馈

**现状：** 后端在录制但前端无指示：
- 悬浮球无 "录制中" 视觉标识
- 无录制分段计数
- 无最近分析状态

---

### P3-LOW: 通知系统 UI 不完整

**现状：** 仅实现 `ReturnReminder` 类型的 toast，无：
- 通知中心/通知列表
- 通知历史查看
- 其他类型通知的 UI 渲染

---

### P3-LOW: 性能优化空间

- 每个页面独立 `loadSettings()`，无共享初始化
- FileBrowser 无分页
- 无组件懒加载策略

---

## 三、实施计划

### Phase 1: 多窗口状态同步（P1）

**核心思路：** 利用 Tauri 事件系统实现跨窗口状态广播。

**改动文件：**
- `src/stores/settingsStore.ts` — 添加 Tauri 事件监听和广播
- `src/lib/tauri-api.ts` — 设置更新后 emit 事件

**方案：**
1. `updateSettings()` 成功后，通过 `emit('settings:updated', newSettings)` 广播
2. 每个窗口的 settingsStore 初始化时 `listen('settings:updated')` 接收
3. 收到广播后更新本地 `$settings` 和 `settingsCache`
4. 同理处理 AI 配置变更的跨窗口同步

**验收标准：**
- Memory 页面切换记忆 → Header toggle 立即同步
- Settings 页面改配置 → 其他窗口感知到

---

### Phase 2: UI 风格统一（P1）

**改动文件：**
- `src/components/FloatingBall/Header.astro` — 去除 gradient-success、#00D4FF、text-info
- `src/components/FloatingBall/Asker.astro` — 去除 gradient-primary、focus:border-glow
- `src/components/files/FileBrowser.tsx` — 去除所有彩色、统一中文
- `src/lib/utils.ts` — 通知组件改为黑白灰

**验收标准：**
- 全应用无彩色元素
- 所有 UI 文本统一中文

---

### Phase 3: 错误处理修复（P1）

**改动文件：**
- `src/components/settings/SettingsPage.tsx` — slider onChange 添加错误提示
- 新建 `src/components/ui/ErrorBoundary.tsx` — React Error Boundary
- 各页面包裹 ErrorBoundary

**验收标准：**
- 设置保存失败时用户收到通知
- 组件崩溃有优雅降级

---

### Phase 4: Memory 页面接入真实数据（P0）

**前置条件：** 确认后端 `get_activities`、`get_summaries` 等命令可用。

**改动文件：**
- `src/lib/tauri-api.ts` — 添加 memory 相关 API 方法
- `src/components/memory/MemoryPage.tsx` — 替换硬编码为真实数据加载
- 可能新建 `src/stores/memoryStore.ts` — 记忆数据状态管理

**功能实现：**
1. 日期切换 → 加载对应日期的 activities
2. 侧边栏列表 → 显示真实短期记忆条目
3. 选中条目 → 右侧展示详情（截图+摘要+标签）
4. 搜索框 → 连接后端全文搜索

**验收标准：**
- 侧边栏显示当天真实的活动记录
- 切换日期加载对应数据
- 点击条目显示详情

---

### Phase 5: Asker 面板功能实现（P0）

**改动文件：**
- `src/components/FloatingBall/Asker.astro` — 添加聊天逻辑
- `src/lib/tauri-api.ts` — 添加 chat/query 相关 API
- 可能新建 `src/stores/chatStore.ts` — 聊天状态管理

**功能实现：**
1. 用户输入问题 → 调用后端 AI 分析
2. 显示 AI 回复（支持流式展示或轮询）
3. 聊天历史保持在会话内
4. 基于当前屏幕上下文提问

**验收标准：**
- 用户可发送消息并收到 AI 回复
- 消息列表正确滚动
- 输入回车发送

---

### Phase 6: SettingsPage React 范式修复（P2）

**改动文件：**
- `src/components/settings/SettingsPage.tsx` — 将 `document.getElementById` 替换为 React `useRef` 或受控组件

**验收标准：**
- 无 `document.getElementById` 调用
- 所有表单输入使用 React 受控/非受控组件模式

---

### Phase 7: 录制状态 UI 反馈（P2）

**改动文件：**
- `src/components/FloatingBall/Ball.astro` — 添加录制状态指示器
- `src/stores/settingsStore.ts` 或新建 store — 监听录制状态事件

**功能：**
- 录制中时 Ball 显示微弱脉冲动画或小圆点
- 可选：Header 展开时显示录制状态文本

---

## 四、依赖关系

```
Phase 1 (状态同步) ← 独立，优先做
Phase 2 (UI 统一)  ← 独立
Phase 3 (错误处理) ← 独立
Phase 4 (Memory 数据) ← 依赖后端 API 确认
Phase 5 (Asker 功能) ← 依赖后端 AI 查询 API
Phase 6 (React 修复) ← 独立
Phase 7 (录制状态)  ← 依赖后端事件
```

**推荐执行顺序：** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

Phase 1-3 可并行执行（无依赖关系）。

---

## 五、风险评估

| 风险 | 等级 | 说明 |
|------|------|------|
| 跨窗口事件可能有延迟 | LOW | Tauri 事件传递通常 <10ms |
| 后端 memory API 可能不完整 | MEDIUM | Phase 4/5 需先确认后端接口 |
| Asker 流式响应复杂度 | MEDIUM | 可先用非流式方案 MVP |
| 文件改动面广 | LOW | 每个 Phase 范围明确，风险可控 |

---

## 六、不改动范围

- Tauri 后端 Rust 代码（除非需要新增前端需要的命令）
- 路由结构
- 组件文件数量（除必要的新建）
- 字体和基础排版

---

**等待确认**：是否按此方案推进？可回复：
- `yes` — 开始按顺序执行
- `skip phase X` — 跳过某个阶段
- `only phase X` — 只执行指定阶段
- `modify: ...` — 修改方案
