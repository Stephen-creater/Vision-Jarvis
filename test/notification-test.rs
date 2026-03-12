/// macOS 原生通知测试
///
/// 使用方法：
/// 1. 将此文件放入 src-tauri/src/bin/ 目录
/// 2. 运行: cargo run --bin notification-test

use tauri_plugin_notification::NotificationExt;

#[cfg(target_os = "macos")]
fn main() {
    // 方式1: 使用 Tauri 插件（推荐）
    test_tauri_notification();

    // 方式2: 使用 macOS 原生 API
    test_native_notification();
}

fn test_tauri_notification() {
    println!("测试 Tauri 通知插件...");

    // 注意：需要在 Tauri 应用上下文中运行
    // 这里仅展示 API 调用方式
}

#[cfg(target_os = "macos")]
fn test_native_notification() {
    use objc::{class, msg_send, sel, sel_impl};
    use objc::runtime::Object;
    use objc_foundation::{INSString, NSString};
    use objc_id::Id;

    println!("测试 macOS 原生通知...");

    unsafe {
        let center: *mut Object = msg_send![class!(NSUserNotificationCenter), defaultUserNotificationCenter];
        let notification: *mut Object = msg_send![class!(NSUserNotification), alloc];
        let notification: *mut Object = msg_send![notification, init];

        let title = NSString::from_str("测试通知");
        let body = NSString::from_str("这是一条 macOS 原生通知");

        let _: () = msg_send![notification, setTitle: title];
        let _: () = msg_send![notification, setInformativeText: body];
        let _: () = msg_send![center, deliverNotification: notification];

        println!("原生通知已发送");
    }
}

#[cfg(not(target_os = "macos"))]
fn main() {
    println!("此测试仅支持 macOS");
}
