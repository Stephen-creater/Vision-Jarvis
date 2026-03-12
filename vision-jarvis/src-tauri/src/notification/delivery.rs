use super::Notification;
use std::sync::Mutex;
use std::collections::VecDeque;
use once_cell::sync::Lazy;

// 全局存储待显示的通知队列
static PENDING_NOTIFICATIONS: Lazy<Mutex<VecDeque<Notification>>> = Lazy::new(|| Mutex::new(VecDeque::new()));

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
    log::info!("准备显示通知: {} - {}", notification.title, notification.message);

    // 1. 添加通知到队列
    {
        let mut queue = PENDING_NOTIFICATIONS.lock().unwrap();
        queue.push_back(notification.clone());
        log::info!("通知已加入队列，当前队列长度: {}", queue.len());
    }

    // 2. 确保通知窗口存在并显示
    ensure_notification_window(app);

    log::info!("通知窗口已准备，等待前端拉取");

    Ok(())
}

/// 前端拉取待显示的通知
#[tauri::command]
pub fn get_pending_notification() -> Option<Notification> {
    let mut queue = PENDING_NOTIFICATIONS.lock().unwrap();
    let notification = queue.pop_front();
    if notification.is_some() {
        log::info!("前端拉取通知，剩余队列长度: {}", queue.len());
    }
    notification
}

/// 确保通知窗口存在并可见
fn ensure_notification_window(app: &tauri::AppHandle) {
    use tauri::Manager;

    match app.get_webview_window("notification") {
        Some(window) => {
            log::info!("通知窗口已存在，显示窗口");
            let _ = window.show();
            let _ = window.set_focus();
        }
        None => {
            let (x, y) = calc_notification_position(app);
            log::info!("创建通知窗口，位置: x={}, y={}", x, y);

            if let Ok(window) = tauri::WebviewWindowBuilder::new(
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
            .build() {
                log::info!("通知窗口创建成功");
                let _ = window.set_ignore_cursor_events(false);
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                log::error!("通知窗口创建失败");
            }
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
