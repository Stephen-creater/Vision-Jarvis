#!/usr/bin/env python3
"""
视频分析完整对比测试（结构化 JSON 输出版）
方案 A：帧提取 + 图像模型（claude-sonnet-4-6, gpt-5.2, gemini-2.5-flash）
方案 B：原生视频理解（qwen3-vl-plus，video_url + base64）
"""

import base64
import json
import os
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import requests

BASE_URL = "https://aihubmix.com/v1"
API_KEY = "sk-iIk4fURUeHTiPi3V09985312D92243819c6c2d31C4132a7e"

FRAME_MODELS = ["claude-sonnet-4-6", "gpt-5.2", "gemini-2.5-flash"]
VIDEO_MODELS = ["qwen3-vl-plus"]

VIDEO_DIR = Path(__file__).parent / "test-video"
RESULTS_DIR = Path(__file__).parent / "results"
FFMPEG = "/opt/homebrew/bin/ffmpeg"

ANALYSIS_PROMPT = """分析这段屏幕录制视频，一次性提取所有结构化信息。严格按JSON格式返回，不要包含任何其他文字。

{
  "application": "主要使用的应用程序名称（如 VS Code、Chrome、微信、Terminal）",
  "window_title": "当前窗口或标签页标题（如 main.rs - vision-jarvis、GitHub - Pull Requests），无法识别返回null",
  "url": "当前访问的URL（仅浏览器场景），非浏览器返回null",

  "activity_category": "work|entertainment|communication|learning|other",
  "productivity_score": 7,
  "focus_level": "deep|normal|fragmented",
  "interaction_mode": "typing|reading|navigating|watching|idle|mixed",
  "is_continuation": false,

  "activity_description": "用户在这段时间内做了什么（一句话，现在时态，要具体，如\\"在VS Code中调试Rust内存管理���块\\"）",
  "activity_summary": "这段时间的活动概述，2-3句（供时间线展示用）",
  "accomplishments": ["完成了XX功能", "修复了YY问题"],

  "key_elements": ["其他关键元素（排除URL和文件名）"],
  "context_tags": ["rust", "debugging", "memory-system"],
  "project_name": "项目名称，无法识别返回null",
  "people_mentioned": ["张三", "Alice"],
  "technologies": ["rust", "tauri", "sqlite"],

  "ocr_text": "屏幕上的重要文字内容（仅提取有意义的部分，如错误信息、标题、关键代码）",
  "file_names": ["main.rs", "schema.rs", "README.md"],
  "error_indicators": ["error[E0382]: use of moved value", "test failed: assertion failed"]
}

字段说明：

【应用识别】
- application: 识别录制中主要使用的应用程序
- window_title: 提取窗口标题栏或浏览器标签页标题，有助于识别具体内容
- url: 浏览器地址栏中的URL（完整URL或域名均可）

【活动分类】
- activity_category: 只能是 work / entertainment / communication / learning / other 之一
  * work: 编程、写作、设计、分析等生产性工作
  * entertainment: 看视频、游戏、刷社交媒体等娱乐
  * communication: 邮件、聊天、视频会议、社区讨论
  * learning: 看教程、阅读文档、学习课程
  * other: 系统设置、文件管理等其他操作
- productivity_score: 整数1-10（1=纯娱乐 5=一般工作 8=高效工作 10=深度专注）
- focus_level: 专注程度
  * deep: 持续专注于单一任务，无明显切换
  * normal: 正常工作节奏，偶尔切换
  * fragmented: 频繁切换应用或标签，注意力分散
- interaction_mode: 主要交互方式
  * typing: 主要在输入文字（编码、写作）
  * reading: 主要在阅读内容（文档、代码、网页）
  * navigating: 主要在点击/浏览/操作界面
  * watching: 主要在观看视频/演示
  * idle: 屏幕静止，无明显操作
  * mixed: 多种交互方式混合
- is_continuation: 此分段是否明显是上一个分段同一任务的延续（true/false，无上下文时填false）

【活动描述】
- activity_description: 简洁描述用户正在做什么，动词开头，具体到操作层面
- activity_summary: 更详细的活动概述，适合展示在时间线上
- accomplishments: 这段时间的具体成果（1-3条），无明显成果填空数组[]

【上下文增强】
- key_elements: 其他重要元素（不含URL和文件名，如窗口名称、功能区域、特殊界面元素）
- context_tags: 2-5个描述当前情境的标签（英文小写，如 debugging、code-review、meeting）
- project_name: 识别到的项目名称（如 vision-jarvis、论文写作、个人博客），无法识别填null
- people_mentioned: 出现的人名（邮件收件人、PR作者、会议参与者、聊天对象等），空则填[]
- technologies: 识别到的技术栈（编程语言、框架、工具），如 rust、react、docker，空则填[]

【内容提取】
- ocr_text: 屏幕上有意义的文字（优先提取：错误信息、重要标题、关键配置，不要提取无意义的UI文字）
- file_names: 识别到的文件名（编辑器标签、终端路径、文件浏览器中的文件），空则填[]
- error_indicators: 识别到的错误或异常信息（编译错误、测试失败、运行异常），空则填[]

只返回JSON对象，不要包含任何解释文字、markdown代码块标记或其他内容。"""


def extract_frames(video_path: str, num_frames: int = 5) -> List[str]:
    """从视频中均匀提取帧，返回 base64 列表"""
    probe_cmd = [
        "/opt/homebrew/bin/ffprobe", "-v", "quiet",
        "-print_format", "json", "-show_format", video_path
    ]
    try:
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
        duration = float(json.loads(probe_result.stdout)["format"]["duration"])
    except Exception:
        duration = 60.0

    frames_b64 = []
    with tempfile.TemporaryDirectory() as tmpdir:
        for i in range(num_frames):
            t = duration * (i + 0.5) / num_frames
            frame_path = os.path.join(tmpdir, f"frame_{i:03d}.jpg")
            cmd = [
                FFMPEG, "-ss", str(t), "-i", video_path,
                "-vframes", "1", "-vf", "scale=1280:-1",
                "-q:v", "3", "-y", frame_path, "-v", "quiet"
            ]
            result = subprocess.run(cmd, capture_output=True, timeout=30)
            if result.returncode == 0 and os.path.exists(frame_path):
                with open(frame_path, "rb") as f:
                    frames_b64.append(base64.b64encode(f.read()).decode("utf-8"))
    return frames_b64


def analyze_with_frames(model: str, frames_b64: List[str], prompt: str) -> dict:
    """方案 A：帧图像发给图像模型"""
    content = []
    for frame_b64 in frames_b64:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{frame_b64}"}
        })
    content.append({"type": "text", "text": prompt})

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 2000,
    }

    start_time = time.time()
    try:
        resp = requests.post(
            f"{BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=120,
        )
        elapsed = time.time() - start_time
        resp.raise_for_status()
        data = resp.json()
        raw = data["choices"][0]["message"]["content"].strip()
        # 尝试解析 JSON，去掉可能的 markdown 代码块
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        return {"success": True, "answer": parsed, "raw": raw, "elapsed": round(elapsed, 2), "error": None}
    except json.JSONDecodeError as e:
        elapsed = time.time() - start_time
        return {"success": False, "answer": None, "raw": locals().get("raw", ""), "elapsed": round(elapsed, 2), "error": f"JSON解析失败: {e}"}
    except Exception as e:
        elapsed = time.time() - start_time
        return {"success": False, "answer": None, "raw": "", "elapsed": round(elapsed, 2), "error": str(e)}


def analyze_with_video(model: str, video_path: str, prompt: str) -> dict:
    """方案 B：Qwen video_url + base64 原生视频"""
    with open(video_path, "rb") as f:
        video_b64 = base64.b64encode(f.read()).decode("utf-8")

    content = [
        {
            "type": "video_url",
            "video_url": {"url": f"data:video/mp4;base64,{video_b64}"},
            "fps": 2,
        },
        {"type": "text", "text": prompt},
    ]

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 2000,
    }

    start_time = time.time()
    try:
        resp = requests.post(
            f"{BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=600,
        )
        elapsed = time.time() - start_time
        resp.raise_for_status()
        data = resp.json()
        raw = data["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        return {"success": True, "answer": parsed, "raw": raw, "elapsed": round(elapsed, 2), "error": None}
    except json.JSONDecodeError as e:
        elapsed = time.time() - start_time
        return {"success": False, "answer": None, "raw": locals().get("raw", ""), "elapsed": round(elapsed, 2), "error": f"JSON解析失败: {e}"}
    except Exception as e:
        elapsed = time.time() - start_time
        return {"success": False, "answer": None, "raw": "", "elapsed": round(elapsed, 2), "error": str(e)}


def run_comparison(video_path: str) -> dict:
    video_name = Path(video_path).name
    size_mb = round(Path(video_path).stat().st_size / 1024 / 1024, 1)
    print(f"\n{'='*60}")
    print(f"视频：{video_name} ({size_mb}MB)")
    print(f"{'='*60}")

    results = {"video": video_name, "size_mb": size_mb, "frame_models": {}, "video_models": {}}

    print("  正在提取帧...", end="", flush=True)
    frames_b64 = extract_frames(video_path, num_frames=5)
    print(f" {len(frames_b64)} 帧")

    for model in FRAME_MODELS:
        print(f"  [方案A] {model} ...", end="", flush=True)
        result = analyze_with_frames(model, frames_b64, ANALYSIS_PROMPT)
        results["frame_models"][model] = result
        status = "OK" if result["success"] else f"FAIL: {result['error'][:60]}"
        print(f" {result['elapsed']}s  {status}")

    for model in VIDEO_MODELS:
        print(f"  [方案B] {model} ...", end="", flush=True)
        result = analyze_with_video(model, video_path, ANALYSIS_PROMPT)
        results["video_models"][model] = result
        status = "OK" if result["success"] else f"FAIL: {result['error'][:60]}"
        print(f" {result['elapsed']}s  {status}")

    return results


def _fmt_json(obj) -> str:
    if obj is None:
        return ""
    if isinstance(obj, dict):
        return json.dumps(obj, ensure_ascii=False, indent=2)
    return str(obj)


def generate_report(all_results: List[dict]) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = [
        "# 视频分析结构化输出对比报告",
        "",
        "## 测试概览",
        f"- 测试时间：{now}",
        f"- 视频数量：{len(all_results)}",
        f"- 帧提取模型（方案A）：{', '.join(FRAME_MODELS)}",
        f"- 原生视频模型（方案B）：{', '.join(VIDEO_MODELS)}",
        "",
    ]

    # 综合对比表
    lines += ["## 综合对比", "", "| 模型 | 方案 | 平均响应时间(s) | 成功率 | JSON有效率 |",
              "|------|------|----------------|--------|-----------|"]

    all_model_keys = [(m, "frame_models") for m in FRAME_MODELS] + [(m, "video_models") for m in VIDEO_MODELS]
    for model, key in all_model_keys:
        scheme = "帧提取" if key == "frame_models" else "原生视频"
        times, successes, total = [], 0, 0
        for r in all_results:
            res = r[key].get(model, {})
            if res:
                total += 1
                if res.get("success"):
                    successes += 1
                    times.append(res["elapsed"])
        avg_t = round(sum(times) / len(times), 2) if times else 0
        sr = f"{successes}/{total}"
        lines.append(f"| {model} | {scheme} | {avg_t} | {sr} | {sr} |")
    lines.append("")

    # 每个模型详细结果
    for model, key in all_model_keys:
        scheme = "方案A 帧提取" if key == "frame_models" else "方案B 原生视频"
        lines += [f"## [{scheme}] {model}", ""]
        for r in all_results:
            res = r[key].get(model, {})
            lines.append(f"### {r['video']} ({r['size_mb']}MB) — {res.get('elapsed', '-')}s")
            lines.append("")
            if res.get("success") and res.get("answer"):
                lines.append("```json")
                lines.append(json.dumps(res["answer"], ensure_ascii=False, indent=2))
                lines.append("```")
            elif res.get("raw"):
                lines.append("> JSON 解析失败，原始输出：")
                lines.append("")
                lines.append("```")
                lines.append(res["raw"][:500])
                lines.append("```")
                lines.append(f"> 错误：{res.get('error', '')}")
            else:
                lines.append(f"> 错误：{res.get('error', '未知')}")
            lines.append("")

    return "\n".join(lines)


def main():
    RESULTS_DIR.mkdir(exist_ok=True)

    video_files = sorted(VIDEO_DIR.glob("*.mp4"))
    if not video_files:
        print(f"未找到测试视频：{VIDEO_DIR}")
        return

    print(f"找到 {len(video_files)} 个测试视频")
    print(f"帧提取模型（方案A）：{FRAME_MODELS}")
    print(f"原生视频模型（方案B）：{VIDEO_MODELS}")
    print(f"Qwen 超时：600s")

    all_results = []
    for video_path in video_files:
        result = run_comparison(str(video_path))
        all_results.append(result)

    json_path = RESULTS_DIR / "structured_raw.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\n原始数据：{json_path}")

    report = generate_report(all_results)
    report_path = RESULTS_DIR / "structured_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"报告：{report_path}")


if __name__ == "__main__":
    main()
