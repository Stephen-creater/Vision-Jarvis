# AI 智能提醒建议机制分析

## 概述

Vision-Jarvis 的 AI 智能提醒系统基于规则引擎，通过分析用户行为数据自动生成主动建议。

---

## 一、数据来源字段

### 1.1 核心上下文结构 (`RuleContext`)

位置：`vision-jarvis/src-tauri/src/notification/rules.rs:26-43`

```rust
pub struct RuleContext {
    /// 当前本地时间
    pub local_now: DateTime<chrono::Local>,

    /// 连续工作时长（分钟）
    pub continuous_work_minutes: i64,

    /// 屏幕无变化时长（分钟）
    pub inactive_minutes: i64,

    /// 当前小时匹配的习惯列表 (pattern_name, confidence)
    pub matching_habits: Vec<(String, f32)>,

    /// 最近10分钟内的应用切换次数
    pub recent_app_switches: usize,

    /// 最近活跃项目距今天数（None=无项目）
    pub project_inactive_days: Option<i64>,

    /// 最近活跃项目名称
    pub inactive_project_name: Option<String>,
}
```

### 1.2 数据查询逻辑

位置：`vision-jarvis/src-tauri/src/notification/context.rs`

#### 1. 连续工作时长 (`continuous_work_minutes`)
- **数据源**：`screenshots` 表的 `captured_at` 字段
- **查询逻辑**：
  - 查询最近 4 小时内的截图时间戳
  - 从最新截图往回看，找到间隔不超过 10 分钟的连续截图
  - 计算从最早连续截图到现在的时长（分钟）
- **代码位置**：`context.rs:34-75`

#### 2. 屏幕无变化时长 (`inactive_minutes`)
- **数据源**：`screenshots` 表的 `MAX(captured_at)`
- **查询逻辑**：
  - 查询最后一次截图时间
  - 计算当前时间与最后截图时间的差值（分钟）
- **代码位置**：`context.rs:80-102`

#### 3. 匹配的习惯 (`matching_habits`)
- **数据源**：`habits` 表
- **查询字段**：
  - `pattern_name`：习惯名称（如 "每天 08:00 使用 微信"）
  - `confidence`：置信度（0.0-1.0）
  - `typical_time`：典型时间（如 "08:00"）
- **查询逻辑**：
  - 匹配当前小时的习惯记录
  - 过滤置信度 > 0.3 的记录
  - 按置信度降序排列，取前 5 条
- **代码位置**：`context.rs:105-125`

#### 4. 应用切换次数 (`recent_app_switches`)
- **数据源**：`activities` 表的 `application` 字段
- **查询逻辑**：
  - 查询最近 10 分钟内的活动记录
  - 统计相邻记录中应用名称不同的次数
- **代码位置**：`context.rs:128-150`

#### 5. 不活跃项目 (`project_inactive_days`, `inactive_project_name`)
- **数据源**：`projects` 表
- **查询字段**：
  - `title`：项目名称
  - `last_activity_date`：最后活动时间戳
- **查询逻辑**：
  - 查找最后活动时间超过 7 天的项目
  - 按最后活动时间升序排列，取最久未活跃的项目
  - 计算距今天数
- **代码位置**：`context.rs:153-178`

---

## 二、触发条件

### 2.1 四种主动建议规则

位置：`vision-jarvis/src-tauri/src/notification/smart/proactive.rs`

#### 1. 习惯提醒 (`HabitReminderRule`)

**触发条件**：
- 当前小时有匹配的习惯记录
- 习惯置信度 ≥ 0.5

**冷却时间**：60 分钟

**通知内容**：
```
标题：习惯提醒
消息：现在通常是「{习惯名称}」的时间 (置信度 {百分比}%)
```

**代码位置**：`proactive.rs:16-42`

---

#### 2. 上下文切换警告 (`ContextSwitchRule`)

**触发条件**：
- 最近 10 分钟内应用切换次数 ≥ 6 次（默认阈值）

**冷却时间**：30 分钟

**通知内容**：
```
标题：频繁切换提醒
消息：最近10分钟内切换了 {次数} 次应用，频繁切换会降低专注度，试试集中处理一件事？
```

**代码位置**：`proactive.rs:48-83`

---

#### 3. 智能休息提醒 (`SmartBreakRule`)

**触发条件**：
- 连续工作时长 ≥ 90 分钟（默认阈值）

**冷却时间**：90 分钟（与阈值相同）

**通知内容**：
```
标题：休息一下
消息：你已经连续工作了 {时长}，{提示}。起来活动活动吧！
```

**智能提示逻辑**：
- 如果最近应用切换次数 > 4：
  - "而且切换频繁，说明注意力可能已经分散了"
- 否则：
  - "保持专注很棒，但也别忘了休息"

**代码位置**：`proactive.rs:89-136`

---

#### 4. 项目进度提醒 (`ProjectProgressRule`)

**触发条件**：
- 存在不活跃项目
- 项目不活跃天数 ≥ 7 天（默认阈值）

**冷却时间**：24 小时

**通知内容**：
```
标题：项目进度提醒
消息：「{项目名称}」已经 {天数} 天没有活动了，要不要看看？
```

**代码位置**：`proactive.rs:142-177`

---

### 2.2 固定提醒规则（用户可配置）

位置：`vision-jarvis/src-tauri/src/notification/rules.rs:88-300`

#### 1. 早安提醒 (`MorningReminderRule`)
- **触发条件**：当前时间 ≥ 配置的提醒时间
- **冷却时间**：24 小时（每天一次）
- **配置字段**：
  - `morning_reminder_enabled`
  - `morning_reminder_time`（如 "08:00"）
  - `morning_reminder_message`

#### 2. 喝水提醒 (`WaterReminderRule`)
- **触发条件**：当前时间在配置的时间范围内
- **冷却时间**：配置的间隔时间（如 60 分钟）
- **配置字段**：
  - `water_reminder_enabled`
  - `water_reminder_start`（如 "09:00"）
  - `water_reminder_end`（如 "18:00"）
  - `water_reminder_interval_minutes`
  - `water_reminder_message`

#### 3. 久坐提醒 (`SedentaryReminderRule`)
- **触发条件**：
  - 当前时间在配置的时间范围内
  - 连续工作时长 ≥ 配置的阈值
- **冷却时间**：配置的阈值时间
- **配置字段**：
  - `sedentary_reminder_enabled`
  - `sedentary_reminder_start`
  - `sedentary_reminder_end`
  - `sedentary_reminder_threshold_minutes`
  - `sedentary_reminder_message`

#### 4. 屏幕无变化提醒 (`ScreenInactivityRule`)
- **触发条件**：屏幕无变化时长 ≥ 配置的阈值
- **冷却时间**：配置的阈值时间
- **配置字段**：
  - `screen_inactivity_reminder_enabled`
  - `screen_inactivity_minutes`
  - `screen_inactivity_message`

---

## 三、调度机制

### 3.1 调度器运行逻辑

位置：`vision-jarvis/src-tauri/src/notification/scheduler.rs:37-115`

**运行频率**：每 60 秒检查一次

**执行流程**：
1. **午夜重置**：每天 00:00 重置每日规则冷却
2. **构建上下文**：调用 `context::build_context()` 查询数据库
3. **评估规则**：调用 `RuleEngine::evaluate_with_cooldown()`
4. **冷却检查**：跳过冷却期内的规则
5. **保存通知**：
   - 写入 `notifications` 表
   - 如果是主动建议，同时写入 `proactive_suggestions` 表
6. **发送通知**：
   - 系统通知（`delivery::send_system_notification`）
   - 前端事件（`delivery::emit_notification_event`）

### 3.2 冷却机制

位置：`vision-jarvis/src-tauri/src/notification/rules.rs:45-85`

**实现方式**：
- 使用 `CooldownTracker` 记录每个规则的最后触发时间
- 检查当前时间与最后触发时间的差值是否 ≥ 冷却时间
- 午夜自动重置以 `morning_` 开头的规则

---

## 四、数据存储

### 4.1 `proactive_suggestions` 表结构

位置：`vision-jarvis/src-tauri/src/db/migrations.rs:514-524`

```sql
CREATE TABLE proactive_suggestions (
    id TEXT PRIMARY KEY,
    suggestion_type TEXT NOT NULL,      -- 建议类型（如 "HabitReminder"）
    trigger_context TEXT NOT NULL,      -- 触发上下文（JSON）
    message TEXT NOT NULL,              -- 建议消息
    priority INTEGER DEFAULT 0,         -- 优先级（0=Low, 1=Normal, 2=High, 3=Urgent）
    delivered INTEGER DEFAULT 0,        -- 是否已发送（0=否, 1=是）
    delivered_at INTEGER,               -- 发送时间戳
    user_action TEXT,                   -- 用户操作（"accepted" | "dismissed" | "snoozed"）
    created_at INTEGER NOT NULL         -- 创建时间戳
);
```

**索引**：
- `idx_ps_type`：按 `suggestion_type` 索引
- `idx_ps_delivered`：按 `delivered` 索引

### 4.2 保存逻辑

位置：`vision-jarvis/src-tauri/src/notification/scheduler.rs:194-221`

**主动建议类型判断**：
```rust
fn is_proactive_type(t: &NotificationType) -> bool {
    matches!(
        t,
        NotificationType::HabitReminder
            | NotificationType::ContextSwitchWarning
            | NotificationType::SmartBreakReminder
            | NotificationType::ProjectProgressReminder
    )
}
```

**保存字段**：
- `id`：通知 ID（UUID）
- `suggestion_type`：通知类型的 Debug 字符串（如 "HabitReminder"）
- `trigger_context`：JSON 格式的触发上下文
  ```json
  {
    "notification_id": "uuid",
    "title": "习惯提醒"
  }
  ```
- `message`：通知消息内容
- `priority`：优先级（0-3）
- `delivered`：固定为 1（已发送）
- `delivered_at`：发送时间戳
- `created_at`：创建时间戳

---

## 五、前端 API

### 5.1 获取建议历史

**命令**：`get_proactive_suggestions`

**位置**：`vision-jarvis/src-tauri/src/commands/notification.rs:144-177`

**参数**：
- `limit`：可选，默认 30 条

**返回字段**：
```typescript
{
  id: string;
  suggestion_type: string;
  message: string;
  priority: number;
  user_action: string | null;
  created_at: number;
}
```

**SQL 查询**：
```sql
SELECT id, suggestion_type, message, priority, user_action, created_at
FROM proactive_suggestions
ORDER BY created_at DESC
LIMIT ?
```

### 5.2 记录用户操作

**命令**：`record_suggestion_action`

**位置**：`vision-jarvis/src-tauri/src/commands/notification.rs:124-142`

**参数**：
- `id`：建议 ID
- `action`：用户操作（"accepted" | "dismissed" | "snoozed"）

**SQL 更新**：
```sql
UPDATE proactive_suggestions
SET user_action = ?1
WHERE id = ?2
```

---

## 六、总结

### 6.1 数据流向

```
数据库表 (screenshots, activities, habits, projects)
    ↓
context::build_context() 查询并构建 RuleContext
    ↓
RuleEngine::evaluate_with_cooldown() 评估规则
    ↓
生成 Notification 对象
    ↓
保存到 notifications 表 + proactive_suggestions 表
    ↓
发送系统通知 + 前端事件
```

### 6.2 关键特性

1. **基于真实数据**：所有建议都基于数据库中的实际用户行为数据
2. **智能触发**：结合多个维度（时间、行为、习惯）判断触发条件
3. **冷却机制**：避免频繁打扰用户
4. **可配置性**：固定提醒支持用户自定义时间和消息
5. **双表存储**：主动建议同时存储在 `notifications` 和 `proactive_suggestions` 表
6. **用户反馈**：记录用户对建议的操作（接受/忽略/稍后提醒）

### 6.3 核心字段总结

| 字段 | 数据源表 | 用途 |
|------|---------|------|
| `continuous_work_minutes` | `screenshots.captured_at` | 久坐提醒、智能休息提醒 |
| `inactive_minutes` | `screenshots.captured_at` | 屏幕无变化提醒 |
| `matching_habits` | `habits.pattern_name, confidence, typical_time` | 习惯提醒 |
| `recent_app_switches` | `activities.application` | 上下文切换警告、智能休息提示 |
| `project_inactive_days` | `projects.last_activity_date` | 项目进度提醒 |
| `inactive_project_name` | `projects.title` | 项目进度提醒 |

---

**文档版本**：v1.0
**创建日期**：2026-03-02
**维护者**：Vision-Jarvis Team
