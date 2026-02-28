# Gemini & Qwen 修正格式后重测报告

- 测试时间：2026-02-21 15:25:19
- 视频数量：6
- Gemini 修正：`image_url` 类型 + `data:video/mp4;base64,...`
- Qwen 修正：`video_url` 类型 + `data:video/mp4;base64,...` + `fps=2`

## 综合对比

| 模型 | 平均响应时间(s) | 成功率 |
|------|----------------|--------|
| gemini-3-flash-preview | 0 | 0.0% |
| qwen3-vl-plus | 72.91 | 66.7% |

## 详细结果

### 03-21-45_ec6239fb-f019-4b9c-9625-6f3ff7aa883e.mp4 (2.6MB)

**gemini-3-flash-preview** — 耗时 5.28s

> 错误：400 Client Error: Bad Request for url: https://aihubmix.com/v1/chat/completions | response: {"error":{"message":"Unsupported MIME type:  (tid: 202602210709047777684790722212)","type":"","param":"","code":400}}

**qwen3-vl-plus** — 耗时 120.58s

1. 用户正在使用 Claude Code（AI编程助手）调试 Vision-Jarvis 项目，尝试通过查阅 FFmpeg 文档、执行命令、排查网络错误（如 `domain ffmpeg.org is not safe`）来解决屏幕录制问题。

2. 屏幕主要显示：  
   - 左侧：Claude Code AI 助手界面（含代码终端与思考过程）  
   - 中间：终端窗口（运行 `git`, `cd`, `cargo`, `ffmpeg` 相关命令）  
   - 右侧：Astro 开发服务器日志与本地服务（`localhost:4321`）  
   - 底部：macOS Dock 栏（含 VS Code、浏览器等）

3. 用户借助 AI 助手排查 Vision-Jarvis 屏幕录制失败问题，涉及 FFmpeg 配置、网络权限及命令执行，多次尝试未果。

4. 活动类型：**工作**（软件开发与调试）

### 03-22-46_3b66c733-567c-44db-9994-ec9c2cc67447.mp4 (3.6MB)

**gemini-3-flash-preview** — 耗时 7.05s

> 错误：400 Client Error: Bad Request for url: https://aihubmix.com/v1/chat/completions | response: {"error":{"message":"Unsupported MIME type:  (tid: 2026022107110980800679949075108)","type":"","param":"","code":400}}

**qwen3-vl-plus** — 耗时 66.1s

1. 用户在 macOS 系统设置中浏览多个选项（通用、屏幕保护程序、控制中心、关于本机、MySQL 等），并最终切换到终端窗口查看开发日志与错误信息。  
2. 主要应用程序：系统设置（System Settings）、终端（Terminal）、左侧疑似笔记/知识库应用（含 Claude 4.5 Sonnet 文档）。  
3. 用户操作 macOS 设置并排查 FFmpeg 网络错误与 Vision-Jarvis 开发日志，涉及 MySQL 配置与命令行调试。  
4. 活动类型：工作

### 03-23-47_bdc74ddc-5cd0-4e06-b051-b8b6c63e907c.mp4 (3.6MB)

**gemini-3-flash-preview** — 耗时 5.26s

> 错误：400 Client Error: Bad Request for url: https://aihubmix.com/v1/chat/completions | response: {"error":{"message":"Unsupported MIME type:  (tid: 2026022107122294647795788592642)","type":"","param":"","code":400}}

**qwen3-vl-plus** — 耗时 45.83s

1. 用户在终端中调试FFmpeg相关问题，使用Claude AI助手规划任务（P1/P2/P0），切换应用（系统设置、Monica笔记、Chrome等）查阅文档与执行命令。  
2. 主要应用程序：终端（iTerm2）、Claude 4.5 Sonnet（AI助手）、系统设置、Monica知识管理工具、Chrome浏览器。  
3. 用户结合AI规划任务，排查FFmpeg屏幕录制低帧率与管道阻塞问题，查阅文档并执行Git/命令行操作。  
4. 工作

### 03-24-49_5aa59464-e133-4c0b-8d3a-094bc1736d31.mp4 (5.0MB)

**gemini-3-flash-preview** — 耗时 7.84s

> 错误：400 Client Error: Bad Request for url: https://aihubmix.com/v1/chat/completions | response: {"error":{"message":"Unsupported MIME type:  (tid: 2026022107131414805850041380262)","type":"","param":"","code":400}}

**qwen3-vl-plus** — 耗时 59.15s

1. 用户正在使用Claude AI助手调试Rust项目中的FFmpeg屏幕录制问题，尝试修复`is_recording`字段及日志输出异常，并通过终端执行命令与查看日志。
2. 屏幕主要显示：左侧为Claude Code（AI编程助手）对话界面；中间为macOS终端（zsh），含Git、Cargo、FFmpeg命令及错误日志；右侧为Astro（Rust GUI框架）的Dev Server日志与本地服务信息。
3. 用户借助AI分析并修改Rust代码以解决屏幕录制阻塞与日志缺失问题，涉及scheduler.rs与screen_recorder.rs文件调整。
4. 工作

### 03-25-50_c7b614b1-bd8d-4cb8-8274-abe93296f886.mp4 (14.0MB)

**gemini-3-flash-preview** — 耗时 22.69s

> 错误：400 Client Error: Bad Request for url: https://aihubmix.com/v1/chat/completions | response: {"error":{"message":"Unsupported MIME type:  (tid: 2026022107142123957407360289497)","type":"","param":"","code":400}}

**qwen3-vl-plus** — 耗时 312.67s

> 错误：HTTPSConnectionPool(host='aihubmix.com', port=443): Read timed out. (read timeout=300)

### 05-20-55_b441b051-559d-4d66-b31c-384fb2a05d6b.mp4 (10.3MB)

**gemini-3-flash-preview** — 耗时 18.5s

> 错误：400 Client Error: Bad Request for url: https://aihubmix.com/v1/chat/completions | response: {"error":{"message":"Unsupported MIME type:  (tid: 2026022107195669428219495105200)","type":"","param":"","code":400}}

**qwen3-vl-plus** — 耗时 304.32s

> 错误：HTTPSConnectionPool(host='aihubmix.com', port=443): Read timed out. (read timeout=300)
