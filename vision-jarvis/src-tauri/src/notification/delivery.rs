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
    use tauri::Emitter;

    log::info!("发送通知事件: {} - {}", notification.title, notification.message);

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

    log::info!("通知事件已发送");

    Ok(())
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
            // 计算屏幕右上角位置
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
            .visible(false)
            .build() {
                log::info!("通知窗口创建成功，设置鼠标穿透并显示");
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
