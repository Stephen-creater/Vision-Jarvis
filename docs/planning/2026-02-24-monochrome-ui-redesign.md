# 实现计划：前端黑白灰极简风格重设计

**日期：** 2026-02-24
**分支：** memory
**状态：** 等待确认

---

## 一、需求重述

将整个前端从"深色科技蓝紫渐变"风格改为**纯黑白灰+透明**的极简高级风格：

1. **颜色系统**：消除所有鲜艳色（蓝、绿、紫、橙），只保留黑/白/灰/透明。信息层级通过亮度差异区分。
2. **Toggle（开关）**：重设计 ON/OFF 状态，去掉绿色渐变，改用白/灰对比。
3. **Slider（滑动条）**：重设计原生 `<input type="range">`，添加自定义 CSS 轨道和滑块。
4. **Select / Tab / Button 选择组件**：重设计为极简线条风格，无彩色渐变背景。
5. **整体交互**：过渡动画更丝滑（cubic-bezier），hover/focus 反馈微妙但清晰。

---

## 二、设计思路

### 颜色语言

```
背景层（深到浅）：
  Layer 0:  #000000  纯黑（最底层）
  Layer 1:  #0A0A0A  应用背景
  Layer 2:  #111111  页面/主区域
  Layer 3:  #1A1A1A  侧边栏/卡片
  Layer 4:  #222222  输入框/列表项
  Layer 5:  #2A2A2A  次要背景/分隔线

边框（透明度叠加）：
  subtle:   rgba(255,255,255,0.05)
  normal:   rgba(255,255,255,0.10)
  strong:   rgba(255,255,255,0.20)
  focus:    rgba(255,255,255,0.50)

文字（亮度层级）：
  primary:    #FFFFFF  主文字
  secondary:  #CCCCCC  次要文字
  muted:      #888888  静默/标签
  disabled:   #444444  禁用/极弱

功能性文字（灰度，不用彩色）：
  success:  #AAAAAA（不再用绿色，改用浅灰）
  error:    #FFFFFF + border（用白字+红边框区分）
  warning:  #AAAAAA + 斜体���避免橙色）
```

### 交互动效规范

```
过渡时长：
  micro:  100ms  — 颜色、透明度微变化
  fast:   200ms  — hover 反馈、Toggle 切换
  normal: 300ms  — 展开/折叠、页面切换

缓动函数：
  default:   cubic-bezier(0.4, 0, 0.2, 1)  — Material Design easing
  spring:    cubic-bezier(0.34, 1.56, 0.64, 1)  — Toggle 弹簧感
  smooth:    cubic-bezier(0.25, 0.1, 0.25, 1)   — Slider 平滑

Hover 效果：
  背景：rgba(255,255,255,0.04) 叠加
  边框：透明度从 0.10 升至 0.25
  无位移、无阴影扩散（保持干净）

Focus 效果：
  outline: 1px solid rgba(255,255,255,0.50)
  outline-offset: 2px
  无颜色（不用蓝色 ring）
```

---

## 三、组件重设计方案

### 3.1 Toggle 开关

**现状：** ON=绿蓝渐变，OFF=灰色 #2A2A30，球为白色圆点。

**新设计：**
```
轨道（track）：
  OFF:  background: #222222, border: 1px solid rgba(255,255,255,0.10)
  ON:   background: #FFFFFF, border: none

滑块（thumb）：
  OFF:  background: #555555, box-shadow: none
  ON:   background: #000000, box-shadow: 0 1px 4px rgba(0,0,0,0.8)

过渡：
  all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)  — 弹簧感

尺寸：
  sm: track 44px×22px, thumb 16px
  lg: track 56px×28px, thumb 22px
```

**状态表达：**
- OFF：暗灰轨道 + 中灰滑块（整体低调）
- ON：纯白轨道 + 黑色滑块（强烈反差 = 开启）
- Hover：轨道 border 加深到 rgba(255,255,255,0.25)
- Disabled：opacity 0.3，pointer-events none

### 3.2 Slider 滑动条

**现状：** 原生浏览器渲染，无样式。

**新设计（自定义 CSS）：**
```css
/* 轨道 */
track:
  height: 3px
  background: linear-gradient(
    to right,
    #FFFFFF 0%,
    #FFFFFF var(--value-percent),
    rgba(255,255,255,0.12) var(--value-percent),
    rgba(255,255,255,0.12) 100%
  )
  border-radius: 2px

/* 滑块 */
thumb:
  width: 16px, height: 16px
  background: #FFFFFF
  border-radius: 50%
  border: none
  box-shadow: 0 1px 4px rgba(0,0,0,0.6)
  cursor: grab / grabbing

/* 交互 */
hover thumb: scale(1.2), 150ms ease
active thumb: scale(0.95), cursor grabbing
focus: outline 1px solid rgba(255,255,255,0.4)
```

**关键实现：** 通过 JS 动态更新 `--value-percent` CSS 变量，实现已填充/未填充的双色轨道。

### 3.3 Select 下拉选择框

**现状：** `bg-input` + `border-secondary` + focus `border-glow`（蓝色）。

**新设计：**
```
default:
  background: transparent
  border: 1px solid rgba(255,255,255,0.10)
  color: #CCCCCC
  border-radius: 8px

hover:
  border-color: rgba(255,255,255,0.25)

focus:
  border-color: rgba(255,255,255,0.50)
  outline: none

option:
  background: #1A1A1A
  color: #CCCCCC
```

### 3.4 Tab 切换 / Provider 选择按钮

**现状：** 激活=渐变蓝紫或蓝色边框，非激活=暗灰。

**新设计：**
```
Tab 切换（Settings 页 general/ai）：
  非激活:
    background: transparent
    border-bottom: 2px solid transparent
    color: #555555
  激活:
    border-bottom: 2px solid #FFFFFF
    color: #FFFFFF

Provider 选择按钮：
  非激活:
    background: transparent
    border: 1px solid rgba(255,255,255,0.08)
    color: #666666
  hover:
    border-color: rgba(255,255,255,0.20)
    color: #AAAAAA
  激活:
    background: rgba(255,255,255,0.08)
    border: 1px solid rgba(255,255,255,0.30)
    color: #FFFFFF
```

### 3.5 Progress Bar（存储进度）

**现状：** `gradient-primary` 蓝紫渐变。

**新设计：**
```
轨道:
  height: 2px
  background: rgba(255,255,255,0.08)
  border-radius: 1px

填充:
  background: #FFFFFF
  border-radius: 1px
  transition: width 500ms cubic-bezier(0.4, 0, 0.2, 1)

高使用率警告（>80%）:
  background: rgba(255,255,255,0.7)（略暗，非红色）
```

### 3.6 按钮规范

```
主按钮（Primary）：
  background: #FFFFFF
  color: #000000
  border: none
  border-radius: 8px
  hover: background #E0E0E0

次要按钮（Secondary）：
  background: transparent
  border: 1px solid rgba(255,255,255,0.15)
  color: #AAAAAA
  hover: border rgba(255,255,255,0.30), color #FFFFFF

危险按钮（Danger）：
  background: transparent
  border: 1px solid rgba(255,255,255,0.20)
  color: #AAAAAA
  hover: border rgba(255,255,255,0.50), color #FFFFFF
  （不用红色，用边框加重+字色加亮表达危险）
```

---

## 四、实现范围（文件清单）

| 文件 | 改动类型 | 影响面 |
|------|----------|--------|
| `src/styles/global.css` | 重写全局颜色变量、工具类 | 所有页面 |
| `src/components/ui/Toggle.tsx` | 重写组件样式 | 所有 Toggle |
| `src/components/settings/SettingsPage.tsx` | Slider CSS、Select、Tab、Provider 按钮 | 设置页 |
| `src/components/memory/MemoryPage.tsx` | Toggle、Slider、按钮 | 记忆页 |
| `src/components/files/FileBrowser.tsx` | ProgressBar、Tab 按钮 | 文件页 |
| `src/components/Header/HeaderExpanded.astro` | Toggle inline CSS | 顶栏 |

---

## 五、实现阶段

### Phase 1：全局 CSS 变量和工具类重写
- 重写 `global.css`，删除所有鲜艳渐变
- 建立新的黑白灰 utility 类替换现有类
- 新建 `--value-percent` 等 CSS 变量约定

### Phase 2：Toggle 组件重设计
- 重写 `Toggle.tsx`
- 更新 `HeaderExpanded.astro` 中的内联 Toggle

### Phase 3：Slider 自定义样式
- 为所有 `<input type="range">` 添加自定义跨浏览器 CSS
- 通过 JS/React state 动态更新填充进度

### Phase 4：Select / Tab / Button 重设计
- 更新 `SettingsPage.tsx` 中的 Tab、Provider 按钮、Select
- 更新 `FileBrowser.tsx` 中的 Tab 按钮
- 更新 Progress Bar 样式

### Phase 5：全局清理
- 删除 `gradient-primary`、`gradient-success`、`gradient-card` 等不再使用的类
- 删除 `glow-primary`、`glow-success`、`pulse-glow` 等发光效果
- 统一 `text-info` → 改为白/灰

---

## 六、风险评估

| 风险 | 等级 | 说明 |
|------|------|------|
| 信息层级模糊 | MEDIUM | 去掉彩色后，错误/成功状态需用其他方式区分，需细心设计 |
| Slider 跨浏览器兼容 | LOW | `::-webkit-slider-*` 伪元素在 Tauri WebKit 上工作良好 |
| Astro 文件热更新 | LOW | `.astro` 文件改动需完整重启验证 |
| 用户视觉感知 | LOW | 黑白灰对比明确，可读性不低于彩色设计 |

---

## 七、不改动范围

- Tauri 后端逻辑（Rust）
- 路由结构、组件数量
- 功能逻辑（只改样式层）
- 字体（保留 Inter）

---

**等待确认**：是否按此方案推进实现？可回复 yes/modify/skip phase X。
