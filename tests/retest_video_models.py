#!/usr/bin/env python3
"""
针对 Gemini 和 Qwen 修正格式后的单独重测脚本

Gemini 修正：通过 aihubmix OpenAI 兼容接口时，inline 视频应使用
  {"type": "image_url", "image_url": {"url": "data:video/mp4;base64,..."}}

Qwen 修正：根据官方文档，视频需使用
  {"type": "video_url", "video_url": {"url": "data:video/mp4;base64,..."}, "fps": 2}
"""

import base64
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests

BASE_URL = "https://aihubmix.com/v1"
API_KEY = "sk-iIk4fURUeHTiPi3V09985312D92243819c6c2d31C4132a7e"

VIDEO_DIR = Path(__file__).parent / "test-video"
RESULTS_DIR = Path(__file__).parent / "results"

ANALYSIS_PROMPT = """请分析这段视频内容，描述：
1. 用户正在做什么操作
2. 屏幕上显示的主要应用程序
3. 主要内容摘要（50字以内）
4. 活动类型（工作/娱乐/学习/其他）"""


def analyze_gemini(video_path: str, prompt: str) -> dict:
    """
    Gemini inline 视频：通过 aihubmix OpenAI 兼容接口
    使用 image_url 类型 + data:video/mp4;base64 格式
    """
    with open(video_path, "rb") as f:
        video_b64 = base64.b64encode(f.read()).decode("utf-8")

    content = [
        {
            "type": "image_url",
            "image_url": {"url": f"data:video/mp4;base64,{video_b64}"},
        },
        {"type": "text", "text": prompt},
    ]

    payload = {
        "model": "gemini-3-flash-preview",
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 1000,
    }

    start_time = time.time()
    try:
        resp = requests.post(
            f"{BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=180,
        )
        elapsed = time.time() - start_time
        resp.raise_for_status()
        data = resp.json()
        answer = data["choices"][0]["message"]["content"]
        return {"success": True, "answer": answer, "elapsed": round(elapsed, 2), "error": None}
    except Exception as e:
        elapsed = time.time() - start_time
        # 打印详细错误便于调试
        error_detail = str(e)
        try:
            error_detail += f" | response: {resp.text[:300]}"
        except Exception:
            pass
        return {"success": False, "answer": None, "elapsed": round(elapsed, 2), "error": error_detail}


def analyze_qwen(video_path: str, prompt: str) -> dict:
    """
    Qwen 视频：根据官方文档使用 video_url 类型
    支持 base64 data URL 格式：data:video/mp4;base64,...
    fps=2 表示每秒采样 2 帧
    """
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
        "model": "qwen3-vl-plus",
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 1000,
    }

    start_time = time.time()
    try:
        resp = requests.post(
            f"{BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=300,
        )
        elapsed = time.time() - start_time
        resp.raise_for_status()
        data = resp.json()
        answer = data["choices"][0]["message"]["content"]
        return {"success": True, "answer": answer, "elapsed": round(elapsed, 2), "error": None}
    except Exception as e:
        elapsed = time.time() - start_time
        error_detail = str(e)
        try:
            error_detail += f" | response: {resp.text[:300]}"
        except Exception:
            pass
        return {"success": False, "answer": None, "elapsed": round(elapsed, 2), "error": error_detail}


def _escape_md(text: Optional[str]) -> str:
    if not text:
        return ""
    return text.replace("|", "\\|").replace("\n", " ").strip()


def main():
    RESULTS_DIR.mkdir(exist_ok=True)

    video_files = sorted(VIDEO_DIR.glob("*.mp4"))
    if not video_files:
        print(f"未找到测试视频：{VIDEO_DIR}")
        return

    print(f"找到 {len(video_files)} 个视频，开始重测 Gemini 和 Qwen")
    print("=" * 60)

    all_results = []

    for video_path in video_files:
        name = video_path.name
        size_mb = round(video_path.stat().st_size / 1024 / 1024, 1)
        print(f"\n视频：{name} ({size_mb}MB)")

        result = {"video": name, "size_mb": size_mb, "gemini": {}, "qwen": {}}

        print(f"  [Gemini] gemini-3-flash-preview ...", end="", flush=True)
        r = analyze_gemini(str(video_path), ANALYSIS_PROMPT)
        result["gemini"] = r
        status = "OK" if r["success"] else f"FAIL: {r['error'][:80]}"
        print(f" {r['elapsed']}s  {status}")

        print(f"  [Qwen  ] qwen3-vl-plus ...", end="", flush=True)
        r = analyze_qwen(str(video_path), ANALYSIS_PROMPT)
        result["qwen"] = r
        status = "OK" if r["success"] else f"FAIL: {r['error'][:80]}"
        print(f" {r['elapsed']}s  {status}")

        all_results.append(result)

    # 保存 JSON
    json_path = RESULTS_DIR / "retest_raw.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    # 生成 Markdown 报告
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "# Gemini & Qwen 修正格式后重测报告",
        "",
        f"- 测试时间：{now}",
        f"- 视频数量：{len(all_results)}",
        "- Gemini 修正：`image_url` 类型 + `data:video/mp4;base64,...`",
        "- Qwen 修正：`video_url` 类型 + `data:video/mp4;base64,...` + `fps=2`",
        "",
        "## 综合对比",
        "",
        "| 模型 | 平均响应时间(s) | 成功率 |",
        "|------|----------------|--------|",
    ]

    for key, label in [("gemini", "gemini-3-flash-preview"), ("qwen", "qwen3-vl-plus")]:
        times = [r[key]["elapsed"] for r in all_results if r[key].get("success")]
        total = len(all_results)
        successes = sum(1 for r in all_results if r[key].get("success"))
        avg_t = round(sum(times) / len(times), 2) if times else 0
        sr = round(successes / total * 100, 1)
        lines.append(f"| {label} | {avg_t} | {sr}% |")

    lines += ["", "## 详细结果", ""]

    for r in all_results:
        lines.append(f"### {r['video']} ({r['size_mb']}MB)")
        lines.append("")
        for key, label in [("gemini", "gemini-3-flash-preview"), ("qwen", "qwen3-vl-plus")]:
            res = r[key]
            lines.append(f"**{label}** — 耗时 {res.get('elapsed', '-')}s")
            lines.append("")
            if res.get("success"):
                lines.append(res["answer"])
            else:
                lines.append(f"> 错误：{res.get('error', '未知')}")
            lines.append("")

    report_path = RESULTS_DIR / "retest_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\n原始数据：{json_path}")
    print(f"报告已生成：{report_path}")


if __name__ == "__main__":
    main()
