# Vision-Jarvis

> 智能记忆助手 - 自动记录和理解你的工作

Vision-Jarvis 是一个基于 AI 的桌面应用，能够自动捕获、分析和记忆你的工作活动，帮助你更好地管理时间和项目。

## 核心功能

### ✨记忆系统构建

![文件管理](vision-jarvis/public/flies.png)

### 📊 智能活动记录

- 自动捕获屏幕活动和应用使用情况
- 智能分析活动内容和上下文
- 按时间段分组展示（上午、下午、晚上）

![活动记录](vision-jarvis/public/memoryread_active.png)

### 🔄 习惯模式识别

- 自动检测工作习惯和行为模式
- 置信度评分和出现频率统计
- 帮助优化工作流程

### 📁 项目管理

- 自动识别和并根据分类持续跟踪项目进度
- 项目活动时间线
- 项目状态和进度追踪

![项目管理](vision-jarvis/public/memoryread_project.png)

### 📝 每日总结

- AI 生成的每日工作总结
- 时间分布可视化
- 应用使用统计

![每日总结](vision-jarvis/public/memoryread_summary.png)

### ⚙️ 灵活配置

- API 密钥管理
- 录制间隔自定义
- 智能提醒设置

![设置界面](vision-jarvis/public/popup_setting.png)

## 🚀 快速开始

### 前置要求

- macOS 10.15+
- Node.js 22+
- Rust 1.93+
- API 密钥

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/Vision-Jarvis.git
cd Vision-Jarvis/vision-jarvis

# 安装依赖
npm install

# 开发模式运行
npm run tauri:dev
```

### 首次配置

1. 启动应用后，点击悬浮球打开设置
2. 在"AI 配置"中输入你的 API 密钥（视觉模型推荐使用qwen3-vl-8B-instruct，响应快，成本低，视觉理解效果与opus4.6相当）
3. 调整录制分段时长（默认 1 分钟）

![API 配置](vision-jarvis/public/apikey_setting.png)

## 🎯 使用场景

- **时间追踪**: 自动记录工作时间，无需手动计时
- 
- **项目管理**: 了解每个项目的实际投入时间
- **习惯优化**: 发现并改善工作习惯
- **工作回顾**: 快速回忆某天做了什么

## 🏗️ 技术架构

- **前端**: Astro 5 + React + Tailwind CSS
- **后端**: Tauri 2 (Rust)
- **AI**: Claude API (Anthropic)
- **数据库**: SQLite (本地存储)
- **UI 设计**: 暗色主题 + 现代化组件

## 📁 项目结构

```
vision-jarvis/
├── src/                    # 前端源码
│   ├── pages/             # 页面路由
│   ├── components/        # UI 组件
│   └── styles/            # 样式文件
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── commands/      # Tauri 命令
│   │   ├── memory/        # 记忆系统
│   │   └── notification/  # 通知系统
│   └── Cargo.toml
└── public/                # 静态资源
```

## 🔒 隐私保护

- ✅ 所有数据存储在本地
- ✅ 不上传任何屏幕截图到云端
- ✅ API 密钥加密存储
- ✅ 可随时删除所有数据

数据目录：`~/Library/Application Support/VisionJarvis/`

## 🛠️ 开发

```bash
# 开发模式（热重载）
npm run tauri:dev

# 构建生产版本
npm run tauri:build

# 仅运行前端
npm run dev
```

## 📝 许可证

Apache License 2.0

---

**注意**: 本应用需要屏幕录制权限，首次运行时请在系统设置中授权。
