"""กราฟแท่ง: เทียบ 4 วิธีที่จำนวนคำในคำค้นเท่ากัน (ค่าเริ่มต้น 4 คำ = จุด elbow ของ F1@10 ของระบบเรา)
ใช้ผลจาก 4_metrics_K10_by_length.csv ที่ run_k_test.py สร้างไว้ (วิธีละ 1,000 คำค้น, K = 10)
รัน: python Evaluation/K-Test/make_same_length_bar.py [จำนวนคำ]
"""
import sys
from pathlib import Path
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

HERE = Path(__file__).parent
N = int(sys.argv[1]) if len(sys.argv) > 1 else 4
PALETTE = {"Matching word": "#eda100", "Dense 100%": "#1baf7a", "Lexical 100%": "#eb6834", "Hybrid (ระบบเรา)": "#2a78d6"}
METRICS = ["Precision@10", "Recall@10", "Accuracy (P@1)", "F1@10"]

bl = pd.read_csv(HERE / "4_metrics_K10_by_length.csv", encoding="utf-8-sig")
words_col = bl.columns[1]  # "จำนวนคำ"
sel = bl[bl[words_col] == N]
sel[["วิธี", words_col] + METRICS + ["MRR"]].to_csv(HERE / f"10_metrics_at_{N}_words.csv", index=False, encoding="utf-8-sig")
long = sel.melt(id_vars="วิธี", value_vars=METRICS, var_name="ค่าวัดผล", value_name="ค่า")

plt.rcParams["font.family"] = "Leelawadee UI"
fig, ax = plt.subplots(figsize=(13, 6.5), dpi=150)
sns.barplot(data=long, x="ค่าวัดผล", y="ค่า", hue="วิธี", hue_order=list(PALETTE), palette=PALETTE, ax=ax,
            edgecolor="white", linewidth=1.5, saturation=1)
for bars in ax.containers:
    ax.bar_label(bars, fmt="%.3f", padding=3, fontsize=9)
ax.set_ylim(0, 1.1); ax.set_xlabel(""); ax.set_ylabel("ค่า")
ax.set_title(f"เปรียบเทียบ 4 วิธีที่คำค้นยาวเท่ากัน {N} คำ · K = 10 · วิธีละ 1,000 คำค้น", fontsize=13, pad=12)
ax.grid(axis="y", color="#e6e8ee"); ax.set_axisbelow(True); sns.despine(left=True)
ax.legend(title="", ncol=4, loc="upper center", bbox_to_anchor=(0.5, -0.08), frameon=False)
fig.text(0.01, 0.01, "Precision@10 สูงสุดได้ 0.10 และ F1@10 สูงสุดได้ 0.182 เพราะแต่ละคำค้นมีเพลงที่ถูกเพียง 1 เพลง · "
         f"{N} คำ = จุด elbow ของ F1@10 ของระบบ Hybrid", fontsize=9, color="#5b6475")
fig.tight_layout(rect=(0, 0.03, 1, 1))
fig.savefig(HERE / f"10_bar_at_{N}_words.png")
print(sel[["วิธี"] + METRICS + ["MRR"]].round(4).to_string(index=False))
