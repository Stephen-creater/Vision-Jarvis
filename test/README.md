# 通知测试说明

## 快速测试

### 方法1：在 Tauri 应用中测试（推荐）

1. 启动应用：
```bash
cd vision-jarvis
npm run tauri:dev
```

2. 在浏览器访问：
```
http://localhost:4321/test/notification-test.html
```

3. 点击按钮测试：
   - **发送系统通知** - macOS 原生通知中心
   - **发送自定义通知** - 应用内通知窗口

### 方法2：自动测试

应用启动后 2 秒会自动发送测试通知（已内置）。

## 已添加的测试命令

```rust
// 在 Rust 中调用
test_system_notification()  // macOS 系统通知
test_custom_notification()  // 自定义通知窗口
```

```javascript
// 在前端调用
await window.__TAURI__.core.invoke('test_system_notification');
await window.__TAURI__.core.invoke('test_custom_notification');
```

## 通知实现

项目使用 `tauri-plugin-notification` 插件，代码位于：
- `src-tauri/src/notification/delivery.rs` - 通知投递逻辑
- `src-tauri/src/commands/notification.rs` - 测试命令
