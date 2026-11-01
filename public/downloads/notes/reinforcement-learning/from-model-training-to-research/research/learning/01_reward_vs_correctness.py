"""第一课：模型优化的分数，与真正的正确率有什么区别？

运行：python research/learning/01_reward_vs_correctness.py
依赖：numpy、matplotlib。只训练四个数字，不需要 GPU 或大模型。

这是单题、四选项的教学模型，使用精确期望梯度；没有随机采样，
没有模拟随机判卷噪声，也没有实现完整 GRPO。
"""

import csv
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False


def softmax(logits):
    weights = np.exp(logits - np.max(logits))
    return weights / weights.sum()


def train(initial_probs, grader_rewards, steps=200, learning_rate=0.5):
    # 四个参数分别控制回答 A、B、C、D 出现的概率。
    logits = np.log(np.asarray(initial_probs, dtype=float))
    rewards = np.asarray(grader_rewards, dtype=float)
    history = []
    for step in range(steps + 1):
        probs = softmax(logits)
        average_reward = float(probs @ rewards)
        history.append({
            "step": step,
            "p_A": float(probs[0]),
            "p_B": float(probs[1]),
            "p_C": float(probs[2]),
            "p_D": float(probs[3]),
            "true_correctness": float(probs[0]),  # 只有 A 真正正确。
            "weak_pass_rate": float(probs[0] + probs[1]),  # 弱判卷器接受 A、B。
            "training_reward": average_reward,
        })
        if step == steps:
            break
        # J = sum_j p_j * reward_j。
        # 对 softmax 的四个输入求导：dJ/dlogit_j = p_j*(reward_j-J)。
        gradient = probs * (rewards - average_reward)
        logits += learning_rate * gradient  # 梯度上升：提高平均分数。
    return history


def main():
    output = Path(__file__).resolve().parents[1] / "results" / "lesson_01"
    output.mkdir(parents=True, exist_ok=True)
    initials = {
        "equal_start": [0.25, 0.25, 0.25, 0.25],
        "B_more_likely_at_start": [0.2, 0.4, 0.2, 0.2],
    }
    graders = {
        "clean_grader": [1, 0, 0, 0],
        "weak_grader": [1, 1, 0, 0],
    }
    all_rows = []
    summaries = []
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.4), sharey=True)
    for ax, (initial_name, initial_probs) in zip(axes, initials.items()):
        for grader_name, rewards in graders.items():
            history = train(initial_probs, rewards)
            for row in history:
                all_rows.append({"initial": initial_name, "grader": grader_name, **row})
            final = history[-1]
            summaries.append({"initial": initial_name, "grader": grader_name, **final})
            color = "#2563eb" if grader_name == "clean_grader" else "#e67700"
            label = "准确判卷训练" if grader_name == "clean_grader" else "弱判卷训练"
            ax.plot([r["step"] for r in history], [r["true_correctness"] for r in history],
                    color=color, label=label + "：真正正确率")
            if grader_name == "weak_grader":
                ax.plot([r["step"] for r in history], [r["weak_pass_rate"] for r in history],
                        color=color, linestyle="--", alpha=0.8, label=label + "：判卷通过率")
        ax.set_title("起点一：四个回答最初一样常见" if initial_name == "equal_start"
                     else "起点二：错误回答 B 最初更常见")
        ax.set_xlabel("参数更新次数")
        ax.set_ylim(0, 1.03)
        ax.grid(alpha=0.2)
    axes[0].set_ylabel("概率")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", ncol=3, frameon=False, fontsize=9)
    fig.suptitle("判卷通过率越来越高，真正正确率却可能下降", fontsize=14)
    fig.tight_layout(rect=(0, 0.12, 1, 0.94))
    fig.savefig(output / "reward_vs_correctness.png", dpi=160)
    plt.close(fig)
    with (output / "trace.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(all_rows[0]))
        writer.writeheader()
        writer.writerows(all_rows)
    record = {
        "scope": "Deterministic exact-expectation softmax bandit teaching example; not GRPO or LLM training.",
        "true_labels": [1, 0, 0, 0],
        "graders": graders,
        "steps": 200,
        "learning_rate": 0.5,
        "summaries": summaries,
    }
    (output / "summary.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("initial | grader | P(A): actual correctness | P(B) | weak pass rate")
    for row in summaries:
        print(f"{row['initial']} | {row['grader']} | {row['p_A']:.4f} | "
              f"{row['p_B']:.4f} | {row['weak_pass_rate']:.4f}")
    print(output)


if __name__ == "__main__":
    main()
