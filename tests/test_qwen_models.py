#!/usr/bin/env python3
"""
Qwen VL 系列不同模型对比测试
格式：video_url + data:video/mp4;base64 + fps=2
"""

import base64
import json
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import requests

BASE_URL = "https://aihubmix.com/v1"
API_KEY = "sk-iIk4fURUeHTiPi3V09985312D92243819c6c2d31C4132a7e"

MODELS = [
    "qwen3-vl-flash",
    "qwen3-vl-30b-a3b-instruct",
    "qwen3-vl-235b-a22b-instruct",
    "qwen3-vl-235b-a22b-thinking",
]

VIDEO_DIR = Path(__file__).parent / "test-video"
RESULTS_DIR = Path(__file__).parent / "results"

ANALYSIS_PROMPT = """分析这段屏幕录制视频，一次性提取所有结构化信息。严格按JSON格式返回，不要包含任何其他文字。

{
  "application": "主要使用的应用程序名称",
  "window_title": "当前窗口或标签页标题，无法识别返回null",
  "url": "当前访问的URL（仅浏览器场景），非浏览器返回null",
  "activity_category": "work|entertainment|communication|learning|other",
  "productivity_score": 7,
  "focus_level": "deep|normal|fragmented",
  "interaction_mode": "typing|reading|navigating|watching|idle|mixed",
  "is_continuation": false,
  "activity_description": "用户在做什么（一句话，现在时态，具体）",
  "activity_summary": "活动概述，2-3句",
  "accomplishments": [],
  "key_elements": [],
  "context_tags": [],
  "project_name": null,
  "people_mentioned": [],
  "technologies": [],
  "ocr_text": "屏幕上的重要文字",
  "file_names": [],
  "error_indicators": []
}

只返回JSON对象，不要包含任何解释文字、markdown代码块标记或其他内容。"""


def analyze(model: str, video_path: str) -> dict:
    with open(video_path, "rb") as f:
        video_b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": [
            {"type": "video_url", "video_url": {"url": f"data:video/mp4;base64,{video_b64}"}, "fps": 2},
            {"type": "text", "text": ANALYSIS_PROMPT},
        ]}],
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
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        # 去掉可能的 markdown 代码块
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        parsed = json.loads(raw)
        return {"success": True, "answer": parsed, "elapsed": round(elapsed, 2), "error": None}
    except json.JSONDecodeError as e:
        elapsed = time.time() - start_time
        raw_text = locals().get("raw", "")
        return {"success": False, "answer": None, "raw": raw_text[:500], "elapsed": round(elapsed, 2), "error": f"JSON解析失败: {e}"}
    except Exception as e:
        elapsed = time.time() - start_time
        error_detail = str(e)
        try:
            error_detail += f" | {resp.text[:200]}"
        except Exception:
            pass
        return {"success": False, "answer": None, "raw": "", "elapsed": round(elapsed, 2), "error": error_detail}


def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    video_files = sorted(VIDEO_DIR.glob("*.mp4"))

    print(f"测试模型：{MODELS}")
    print(f"视频数：{len(video_files)}")
    print("=" * 60)

    # 结构：{model: [{video, size_mb, success, answer, elapsed, error}]}
    all_results = {m: [] for m in MODELS}

    for video_path in video_files:
        name = video_path.name
        size_mb = round(video_path.stat().st_size / 1024 / 1024, 1)
        print(f"\n{name} ({size_mb}MB)")

        for model in MODELS:
            print(f"  {model} ...", end="", flush=True)
            r = analyze(model, str(video_path))
            r["video"] = name
            r["size_mb"] = size_mb
            all_results[model].append(r)
            status = "OK" if r["success"] else f"FAIL: {r['error'][:70]}"
            print(f" {r['elapsed']}s  {status}")

    # 保存原始数据
    json_path = RESULTS_DIR / "qwen_models_raw.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    # 生成报告
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "# Qwen VL 系列模型对比报告",
        "",
        f"- 测试时间：{now}",
        f"- 视频数量：{len(video_files)}",
        f"- 格式：`video_url` + `data:video/mp4;base64` + `fps=2`",
        "",
        "## 综合对比",
        "",
        "| 模型 | 成功率 | 平均耗时(s) |",
        "|------|--------|------------|",
    ]

    for model in MODELS:
        results = all_results[model]
        successes = sum(1 for r in results if r["success"])
        times = [r["elapsed"] for r in results if r["success"]]
        avg_t = round(sum(times) / len(times), 1) if times else 0
        lines.append(f"| {model} | {successes}/{len(results)} | {avg_t} |")

    lines += ["", "## 详细结果", ""]

    for model in MODELS:
        lines += [f"### {model}", ""]
        for r in all_results[model]:
            lines.append(f"**{r['video']}** ({r['size_mb']}MB) — {r['elapsed']}s")
            lines.append("")
            if r["success"]:
                lines.append("```json")
                lines.append(json.dumps(r["answer"], ensure_ascii=False, indent=2))
                lines.append("```")
            else:
                lines.append(f"> 错误：{r['error']}")
                if r.get("raw"):
                    lines.append(f"> 原始输出：`{r['raw'][:200]}`")
            lines.append("")

    report_path = RESULTS_DIR / "qwen_models_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\n原始数据：{json_path}")
    print(f"报告：{report_path}")


if __name__ == "__main__":
    main()
