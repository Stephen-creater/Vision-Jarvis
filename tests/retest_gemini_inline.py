#!/usr/bin/env python3
"""
Gemini inline_data 视频分析重测
模型：gemini-2.5-flash-lite-preview-09-2025
格式：{"type": "inline_data", "inline_data": {"mime_type": "video/mp4", "data": "<base64>"}}
"""

import base64
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, List

import requests

BASE_URL = "https://aihubmix.com/v1"
API_KEY = "sk-iIk4fURUeHTiPi3V09985312D92243819c6c2d31C4132a7e"
MODEL = "gemini-2.5-flash-lite-preview-09-2025"

VIDEO_DIR = Path(__file__).parent / "test-video"
RESULTS_DIR = Path(__file__).parent / "results"

ANALYSIS_PROMPT = """请分析这段视频内容，描述：
1. 用户正在做什么操作
2. 屏幕上显示的主要应用程序
3. 主要内容摘要（50字以内）
4. 活动类型（工作/娱乐/学习/其他）"""


def analyze_gemini_inline(video_path: str, prompt: str) -> dict:
    with open(video_path, "rb") as f:
        video_b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "inline_data", "inline_data": {"mime_type": "video/mp4", "data": video_b64}},
        ]}],
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
        error_detail = str(e)
        try:
            error_detail += f" | {resp.text[:300]}"
        except Exception:
            pass
        return {"success": False, "answer": None, "elapsed": round(elapsed, 2), "error": error_detail}


def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    video_files = sorted(VIDEO_DIR.glob("*.mp4"))

    print(f"模型：{MODEL}")
    print(f"格式：inline_data + video/mp4")
    print(f"视频数：{len(video_files)}")
    print("=" * 60)

    all_results = []
    for video_path in video_files:
        name = video_path.name
        size_mb = round(video_path.stat().st_size / 1024 / 1024, 1)
        print(f"\n{name} ({size_mb}MB) ...", end="", flush=True)

        r = analyze_gemini_inline(str(video_path), ANALYSIS_PROMPT)
        all_results.append({"video": name, "size_mb": size_mb, **r})

        status = "OK" if r["success"] else f"FAIL: {r['error'][:80]}"
        print(f" {r['elapsed']}s  {status}")
        if r["success"]:
            print(r["answer"][:300])

    # 保存 JSON
    json_path = RESULTS_DIR / "gemini_inline_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    # 生成报告
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    successes = sum(1 for r in all_results if r["success"])
    times = [r["elapsed"] for r in all_results if r["success"]]
    avg_t = round(sum(times) / len(times), 2) if times else 0

    lines = [
        "# Gemini inline_data 视频分析报告",
        "",
        f"- 测试时间：{now}",
        f"- 模型：`{MODEL}`",
        f"- 格式：`inline_data` + `video/mp4`（aihubmix OpenAI 兼容接口）",
        f"- 成功率：{successes}/{len(all_results)}",
        f"- 平均响应时间：{avg_t}s",
        "",
        "| 视频 | 大小 | 耗时(s) | 状态 |",
        "|------|------|---------|------|",
    ]
    for r in all_results:
        status = "OK" if r["success"] else "FAIL"
        lines.append(f"| {r['video']} | {r['size_mb']}MB | {r['elapsed']} | {status} |")

    lines += ["", "## 详细结果", ""]
    for r in all_results:
        lines.append(f"### {r['video']} ({r['size_mb']}MB) — {r['elapsed']}s")
        lines.append("")
        if r["success"]:
            lines.append(r["answer"])
        else:
            lines.append(f"> 错误：{r['error']}")
        lines.append("")

    report_path = RESULTS_DIR / "gemini_inline_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\n\n原始数据：{json_path}")
    print(f"报告：{report_path}")
    print(f"成功率：{successes}/{len(all_results)}，平均耗时：{avg_t}s")


if __name__ == "__main__":
    main()
