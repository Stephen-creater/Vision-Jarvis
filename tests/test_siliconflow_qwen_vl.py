#!/usr/bin/env python3
"""
SiliconFlow Qwen3-VL 系列模型视频分析测试
API: https://api.siliconflow.cn/v1/chat/completions
格式: video_url + url(base64) + fps + max_frames
"""

import base64
import json
import time
from datetime import datetime
from pathlib import Path

import requests

BASE_URL = "https://api.siliconflow.cn/v1"
API_KEY = "sk-ugxdolmuecwkikhfjgmksjqgqajpybjbhvntenbbagzbvufw"

MODELS = [
    "Qwen/Qwen3-VL-8B-Instruct",
    "Qwen/Qwen3-VL-8B-Thinking",
    "Qwen/Qwen3-VL-30B-A3B-Instruct",
    "Qwen/Qwen3-VL-30B-A3B-Thinking",
    "Qwen/Qwen3-VL-32B-Instruct",
    "Qwen/Qwen3-VL-32B-Thinking",
    "Qwen/Qwen3-VL-235B-A22B-Instruct",
    "Qwen/Qwen3-VL-235B-A22B-Thinking",
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

    # SiliconFlow 视频参数格式
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "video_url",
                        "video_url": {
                            "url": f"data:video/mp4;base64,{video_b64}",
                            "detail": "auto",
                            "max_frames": 10,
                            "fps": 2,
                        },
                    },
                    {
                        "type": "text",
                        "text": ANALYSIS_PROMPT,
                    },
                ],
            }
        ],
        "max_tokens": 2000,
    }

    start_time = time.time()
    try:
        resp = requests.post(
            f"{BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
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
        return {
            "success": False,
            "answer": None,
            "raw": raw_text[:500],
            "elapsed": round(elapsed, 2),
            "error": f"JSON解析失败: {e}",
        }
    except Exception as e:
        elapsed = time.time() - start_time
        error_detail = str(e)
        try:
            error_detail += f" | {resp.text[:300]}"
        except Exception:
            pass
        return {
            "success": False,
            "answer": None,
            "raw": "",
            "elapsed": round(elapsed, 2),
            "error": error_detail,
        }


def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    video_files = sorted(VIDEO_DIR.glob("*.mp4"))

    if not video_files:
        print(f"未找到测试视频，请确认 {VIDEO_DIR} 目录存在 .mp4 文件")
        return

    # 全量测试所有视频

    print(f"SiliconFlow Qwen3-VL 测试")
    print(f"测试模型数：{len(MODELS)}")
    print(f"视频数：{len(video_files)}")
    print("=" * 70)

    all_results = {m: [] for m in MODELS}

    for video_path in video_files:
        name = video_path.name
        size_mb = round(video_path.stat().st_size / 1024 / 1024, 1)
        print(f"\n视频: {name} ({size_mb}MB)")

        for model in MODELS:
            short = model.split("/")[-1]
            print(f"  [{short}] ...", end="", flush=True)
            r = analyze(model, str(video_path))
            r["video"] = name
            r["size_mb"] = size_mb
            all_results[model].append(r)
            if r["success"]:
                print(f" {r['elapsed']}s  OK")
            else:
                err_short = r["error"][:80] if r["error"] else "unknown"
                print(f" {r['elapsed']}s  FAIL: {err_short}")

    # 保存原始数据
    json_path = RESULTS_DIR / "siliconflow_qwen_vl_raw.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    # 生成报告
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "# SiliconFlow Qwen3-VL 系列模型测试报告",
        "",
        f"- 测试时间：{now}",
        f"- API：`{BASE_URL}/chat/completions`",
        f"- 视频数量：{len(video_files)}",
        f"- 格式：`video_url` + `data:video/mp4;base64` + `fps=2` + `max_frames=10`",
        "",
        "## 综合对比",
        "",
        "| 模型 | 成功率 | 平均耗时(s) | 状态 |",
        "|------|--------|------------|------|",
    ]

    for model in MODELS:
        results = all_results[model]
        successes = sum(1 for r in results if r["success"])
        times = [r["elapsed"] for r in results if r["success"]]
        avg_t = round(sum(times) / len(times), 1) if times else 0
        status = "可用" if successes > 0 else "不可用"
        lines.append(f"| `{model}` | {successes}/{len(results)} | {avg_t} | {status} |")

    lines += ["", "## 详细结果", ""]

    for model in MODELS:
        lines += [f"### `{model}`", ""]
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

    report_path = RESULTS_DIR / "siliconflow_qwen_vl_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\n原始数据：{json_path}")
    print(f"报告：{report_path}")


if __name__ == "__main__":
    main()
