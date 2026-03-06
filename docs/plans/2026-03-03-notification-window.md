# 桌面级通知弹窗系统 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个独立的桌面级通知弹窗窗口，在屏幕右上角显示所有类型的智能提醒。

**Architecture:** 单例通知窗口模式。后端在发送通知时动态创建/显示通知窗口，前端监听事件管理通知队列（最多3条），5秒自动消失，悬停暂停计时，队列清空后自动隐藏窗口。

**Tech Stack:** Tauri 2 (Rust) + Astro + TypeScript，复用现有窗口管理模式。

**Worktree:** `/Users/lettery/Documents/code/Vision-Jarvis/worktrees/notification-window`

---

### Task 1: 后端 - 通知窗口管理命令

**Files:**
- Modify: `vision-jarvis/src-tauri/src/commands/window.rs`

**Step 1: 添加 show_notification_window 命令**

在 `window.rs` 末尾（`collapse_to_ball` 函数之后，`#[cfg(test)]` 之前）添加：

```rust
/// 显示通知弹窗窗口（单例模式）
#[tauri::command]
pub async fn show_notification_window(app: AppHandle) -> ApiResponse<String> {
    match app.get_webview_window("notification") {
        Some(window) => {
            // 窗口已存在，确保可见并置顶
            let _ = window.show();
            let _ = window.set_focus();
            ApiResponse::success("Notification window shown".to_string())
        }
        None => {
            // 获取主显示器信息计算位置
            let (x, y) = {
                // 临时借用 floating-ball 窗口获取显示器信息
                let monitor = app.get_webview_window("floating-ball")
                    .and_then(|w| w.primary_monitor().ok().flatten());

                match monitor {
                    Some(m) => {
                        let physical_size = m.size();
                        let scale_factor = m.scale_factor();
                        let screen_width = physical_size.width as f64 / scale_factor;

                        let window_width = 360.0;
                        let margin_right = 20.0;
                        let margin_top = 60.0;

                        (
                            (screen_width - window_width - margin_right).max(0.0),
                            margin_top,
                        )
                    }
                    None => (100.0, 60.0),
                }
            };

            // 创建通知窗口
            match WebviewWindowBuilder::new(
                &app,
                "notification",
                tauri::WebviewUrl::App("/notification".into()),
            )
            .title("Notifications")
            .inner_size(360.0, 400.0)
            .position(x, y)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .build()
            {
                Ok(_) => ApiResponse::success("Notification window created".to_string()),
                Err(e) => ApiResponse::error(format!("Failed to create notification window: {}", e)),
            }
        }
    }
}

/// 隐藏通知弹窗窗口
#[tauri::command]
pub async fn hide_notification_window(app: AppHandle) -> ApiResponse<String> {
    match app.get_webview_window("notification") {
        Some(window) => {
            let _ = window.hide();
            ApiResponse::success("Notification window hidden".to_string())
        }
        None => ApiResponse::success("No notification window to hide".to_string()),
    }
}
```

**Step 2: 注册新命令到 lib.rs**

在 `vision-jarvis/src-tauri/src/lib.rs` 的 `invoke_handler` 中，在 `commands::window::collapse_to_ball,` 之后添加：

```rust
            commands::window::show_notification_window,
            commands::window::hide_notification_window,
```

**Step 3: 验证编译**

Run: `cd vision-jarvis && cargo build -p vision-jarvis-lib 2>&1 | tail -5`
Expected: 编译成功

**Step 4: Commit**

```bash
git add vision-jarvis/src-tauri/src/commands/window.rs vision-jarvis/src-tauri/src/lib.rs
git commit -m "feat: 添加通知窗口管理命令 (show/hide)"
```

---

### Task 2: 后端 - delivery 自动弹出通知窗口

**Files:**
- Modify: `vision-jarvis/src-tauri/src/notification/delivery.rs`

**Step 1: 修改 emit_notification_event 增加自动弹窗**

将 `delivery.rs` 替换为：

```rust
/// 通知投递
///
/// 通过系统通知和 Tauri 事件双通道投递

use super::Notification;

/// 通过 tauri-plugin-notification 发送系统通知
pub fn send_system_notification(
    app: &tauri::AppHandle,
    notification: &Notification,
) -> anyhow::Result<()> {
    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(&notification.title)
        .body(&notification.message)
        .show()?;

    Ok(())
}

/// 通过 Tauri 事件发送到前端，并确保通知窗口可见
pub fn emit_notification_event(
    app: &tauri::AppHandle,
    notification: &Notification,
) -> anyhow::Result<()> {
    use tauri::{Emitter, Manager};

    // 1. 确保通知窗口存在并显示
    ensure_notification_window(app);

    // 2. 发送事件到前端
    app.emit("notification:new", serde_json::json!({
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "type": format!("{:?}", notification.notification_type),
        "priority": notification.priority.clone() as i32,
    }))?;

    Ok(())
}

/// 确保通知窗口存在并可见
fn ensure_notification_window(app: &tauri::AppHandle) {
    use tauri::Manager;

    match app.get_webview_window("notification") {
        Some(window) => {
            let _ = window.show();
        }
        None => {
            // 计算屏幕右上角位置
            let (x, y) = calc_notification_position(app);

            let _ = tauri::WebviewWindowBuilder::new(
                app,
                "notification",
                tauri::WebviewUrl::App("/notification".into()),
            )
            .title("Notifications")
            .inner_size(360.0, 400.0)
            .position(x, y)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .build();
        }
    }
}

/// 计算通知窗口位置（屏幕右上角）
fn calc_notification_position(app: &tauri::AppHandle) -> (f64, f64) {
    use tauri::Manager;

    let monitor = app
        .get_webview_window("floating-ball")
        .and_then(|w| w.primary_monitor().ok().flatten());

    match monitor {
        Some(m) => {
            let physical_size = m.size();
            let scale_factor = m.scale_factor();
            let screen_width = physical_size.width as f64 / scale_factor;

            let window_width = 360.0;
            let margin_right = 20.0;
            let margin_top = 60.0;

            (
                (screen_width - window_width - margin_right).max(0.0),
                margin_top,
            )
        }
        None => (100.0, 60.0),
    }
}
```

**Step 2: 验证编译**

Run: `cd vision-jarvis && cargo build -p vision-jarvis-lib 2>&1 | tail -5`
Expected: 编译成功

**Step 3: Commit**

```bash
git add vision-jarvis/src-tauri/src/notification/delivery.rs
git commit -m "feat: delivery 自动创建/显示通知窗口"
```

---

### Task 3: 前端 - 通知页面与通知卡片

**Files:**
- Create: `vision-jarvis/src/pages/notification.astro`

**Step 1: 创建通知弹窗页面**

```astro
---
import TransparentLayout from '../layouts/TransparentLayout.astro';
---

<TransparentLayout>
  <div id="notification-container"></div>

  <script>
    import { listen } from '@tauri-apps/api/event';
    import { invoke } from '@tauri-apps/api/core';

    // ========================================
    // 类型定义
    // ========================================

    interface NotificationPayload {
      id: string;
      title: string;
      message: string;
      type: string;
      priority: number;
    }

    interface NotificationItem extends NotificationPayload {
      timer: number | null;
      element: HTMLElement;
    }

    // ========================================
    // 通知队列管理
    // ========================================

    const MAX_VISIBLE = 3;
    const AUTO_DISMISS_MS = 5000;
    const activeNotifications: Map<string, NotificationItem> = new Map();
    const pendingQueue: NotificationPayload[] = [];

    // 通知类型 → 左侧色条颜色
    function getTypeColor(type: string): string {
      const colors: Record<string, string> = {
        HabitReminder: '#60a5fa',           // 蓝色
        ContextSwitchWarning: '#f59e0b',    // 橙色
        SmartBreakReminder: '#34d399',      // 绿色
        ProjectProgressReminder: '#a78bfa', // 紫色
        MorningReminder: '#fbbf24',         // 金色
        WaterReminder: '#38bdf8',           // 浅蓝
        SedentaryReminder: '#fb923c',       // 橙红
        ScreenInactivityReminder: '#94a3b8',// 灰色
        ReturnReminder: '#4ade80',          // 翠绿
        Custom: '#e2e8f0',                  // 浅灰
      };
      return colors[type] || '#e2e8f0';
    }

    // 通知类型 → 图标
    function getTypeIcon(type: string): string {
      const icons: Record<string, string> = {
        HabitReminder: '🔁',
        ContextSwitchWarning: '⚡',
        SmartBreakReminder: '☕',
        ProjectProgressReminder: '📋',
        MorningReminder: '🌅',
        WaterReminder: '💧',
        SedentaryReminder: '🧘',
        ScreenInactivityReminder: '🖥️',
        ReturnReminder: '👋',
        Custom: '🔔',
      };
      return icons[type] || '🔔';
    }

    // ========================================
    // 通知卡片创建
    // ========================================

    function createNotificationCard(payload: NotificationPayload): HTMLElement {
      const card = document.createElement('div');
      card.className = 'notification-card';
      card.dataset.id = payload.id;

      const color = getTypeColor(payload.type);
      const icon = getTypeIcon(payload.type);

      card.innerHTML = `
        <div class="card-accent" style="background: ${color}"></div>
        <div class="card-body">
          <div class="card-header">
            <span class="card-icon">${icon}</span>
            <span class="card-title">${payload.title}</span>
            <button class="card-close" aria-label="关闭">×</button>
          </div>
          <div class="card-message">${payload.message}</div>
        </div>
      `;

      // 进入动画：初始状态
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';

      return card;
    }

    // ========================================
    // 通知生命周期管理
    // ========================================

    function showNotification(payload: NotificationPayload) {
      if (activeNotifications.size >= MAX_VISIBLE) {
        pendingQueue.push(payload);
        return;
      }

      const container = document.getElementById('notification-container');
      if (!container) return;

      const card = createNotificationCard(payload);
      container.appendChild(card);

      // 触发进入动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.transition = 'opacity 300ms ease, transform 300ms ease';
          card.style.opacity = '1';
          card.style.transform = 'translateX(0)';
        });
      });

      // 自动消失计时器
      const timer = window.setTimeout(() => {
        dismissNotification(payload.id);
      }, AUTO_DISMISS_MS);

      const item: NotificationItem = { ...payload, timer, element: card };
      activeNotifications.set(payload.id, item);

      // 悬停暂停计时
      card.addEventListener('mouseenter', () => {
        const n = activeNotifications.get(payload.id);
        if (n?.timer) {
          clearTimeout(n.timer);
          n.timer = null;
        }
      });

      // 离开恢复计时
      card.addEventListener('mouseleave', () => {
        const n = activeNotifications.get(payload.id);
        if (n && !n.timer) {
          n.timer = window.setTimeout(() => {
            dismissNotification(payload.id);
          }, AUTO_DISMISS_MS);
        }
      });

      // 点击关闭按钮
      const closeBtn = card.querySelector('.card-close');
      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissNotification(payload.id);
      });

      // 点击卡片本体也关闭
      card.addEventListener('click', () => {
        dismissNotification(payload.id);
      });
    }

    function dismissNotification(id: string) {
      const item = activeNotifications.get(id);
      if (!item) return;

      // 清除计时器
      if (item.timer) {
        clearTimeout(item.timer);
      }

      // 退出动画
      item.element.style.transition = 'opacity 200ms ease, transform 200ms ease';
      item.element.style.opacity = '0';
      item.element.style.transform = 'translateX(20px)';

      setTimeout(() => {
        item.element.remove();
        activeNotifications.delete(id);

        // 如果有排队的通知，显示下一条
        if (pendingQueue.length > 0) {
          const next = pendingQueue.shift()!;
          showNotification(next);
        }

        // 队列全部清空，隐藏窗口
        if (activeNotifications.size === 0 && pendingQueue.length === 0) {
          invoke('hide_notification_window').catch(() => {});
        }
      }, 200);
    }

    // ========================================
    // 事件监听
    // ========================================

    window.addEventListener('DOMContentLoaded', () => {
      listen<NotificationPayload>('notification:new', (event) => {
        showNotification(event.payload);
      });
    });
  </script>

  <style is:global>
    body {
      margin: 0;
      padding: 0;
      background: transparent;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }

    #notification-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      width: 360px;
      box-sizing: border-box;
    }

    .notification-card {
      display: flex;
      flex-direction: row;
      background: rgba(30, 30, 40, 0.95);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
      user-select: none;
      will-change: opacity, transform;
    }

    .notification-card:hover {
      border-color: rgba(255, 255, 255, 0.15);
    }

    .card-accent {
      width: 4px;
      flex-shrink: 0;
    }

    .card-body {
      flex: 1;
      padding: 12px 14px;
      min-width: 0;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .card-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      font-size: 16px;
      cursor: pointer;
      padding: 0 2px;
      line-height: 1;
      flex-shrink: 0;
      transition: color 150ms ease;
    }

    .card-close:hover {
      color: rgba(255, 255, 255, 0.8);
    }

    .card-message {
      font-size: 12px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.7);
      word-break: break-word;
    }
  </style>
</TransparentLayout>
```

**Step 2: 验证前端构建**

Run: `cd vision-jarvis && npm run build 2>&1 | tail -5`
Expected: 构建成功

**Step 3: Commit**

```bash
git add vision-jarvis/src/pages/notification.astro
git commit -m "feat: 创建桌面级通知弹窗页面"
```

---

### Task 4: 移除 floating-ball 中的旧通知监听

**Files:**
- Modify: `vision-jarvis/src/pages/floating-ball.astro`

**Step 1: 移除旧的 ReturnReminder toast 逻辑**

删除 `floating-ball.astro` 中以下代码：

1. `showReturnToast` 函数（约 139-192 行）
2. `listen<{ id: string; ... }>('notification:new', ...)` 监听器（约 379-387 行）

这些通知现在由独立的 notification 窗口处理，不再需要 floating-ball 处理。

**Step 2: 验证前端构建**

Run: `cd vision-jarvis && npm run build 2>&1 | tail -5`
Expected: 构建成功

**Step 3: Commit**

```bash
git add vision-jarvis/src/pages/floating-ball.astro
git commit -m "refactor: 移除 floating-ball 中的旧通知 toast 逻辑"
```

---

### Task 5: 集成测试与验证

**Step 1: 编译完整项目**

Run: `cd vision-jarvis && cargo build 2>&1 | tail -10`
Expected: 编译成功

**Step 2: 运行 Rust 测试**

Run: `cd vision-jarvis && cargo test 2>&1 | tail -20`
Expected: 所有现有测试通过

**Step 3: 运行前端构建**

Run: `cd vision-jarvis && npm run build 2>&1 | tail -5`
Expected: 构建成功

**Step 4: Commit**

如果有任何修复，提交修复。

---

## 文件变更总结

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| Modify | `src-tauri/src/commands/window.rs` | 添加 show/hide_notification_window |
| Modify | `src-tauri/src/lib.rs` | 注册新命令 |
| Modify | `src-tauri/src/notification/delivery.rs` | 发通知时自动弹窗 |
| Create | `src/pages/notification.astro` | 通知弹窗页面 |
| Modify | `src/pages/floating-ball.astro` | 移除旧 toast 逻辑 |
