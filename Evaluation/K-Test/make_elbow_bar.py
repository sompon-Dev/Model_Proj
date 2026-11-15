"""กราฟแท่ง: ทดสอบแต่ละวิธีที่จำนวนคำในคำค้นตามจุด elbow ของ F1@10 (จาก 7_by_length_K10.png)
  Matching word = 7 คำ, Dense = 8 คำ, Lexical = 4 คำ, Hybrid = 4 คำ   (คำค้นละ 1,000 คำค้น, K = 10)
ใช้ผลจาก 4_metrics_K10_by_length.csv ที่ run_k_test.py สร้างไว้
รัน: python Evaluation/K-Test/make_elbow_bar.py
"""
from pathlib import Path
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

HERE = Path(__file__).parent
ELBOW = {"Matching word": 7, "Dense 100%": 8, "Lexical 100%": 4, "Hybrid (ระบบเรา)": 4}
PALETTE = {"Matching word": "#eda100", "Dense 100%": "#1baf7a", "Lexical 100%": "#eb6834", "Hybrid (ระบบเรา)": "#2a78d6"}
METRICS = ["Precision@10", "Recall@10", "Accuracy (P@1)", "F1@10"]

bl = pd.read_csv(HERE / "4_metrics_K10_by_length.csv", encoding="utf-8-sig")
words_col = bl.columns[1]  # "จำนวนคำ"
sel = pd.concat([bl[(bl["วิธี"] == m) & (bl[words_col] == n)] for m, n in ELBOW.items()])
sel[["วิธี", words_col] + METRICS + ["MRR"]].to_csv(HERE / "9_metrics_at_F1_elbow.csv", index=False, encoding="utf-8-sig")

sel["วิธี (จำนวนคำ)"] = sel["วิธี"] + " · " + sel[words_col].astype(str) + " คำ"
pal = dict(zip(sel["วิธี (จำนวนคำ)"], sel["วิธี"].map(PALETTE)))
long = sel.melt(id_vars="วิธี (จำนวนคำ)", value_vars=METRICS, var_name="ค่าวัดผล", value_name="ค่า")

plt.rcParams["font.family"] = "Leelawadee UI"
fig, ax = plt.subplots(figsize=(13, 6.5), dpi=150)
sns.barplot(data=long, x="ค่าวัดผล", y="ค่า", hue="วิธี (จำนวนคำ)", palette=pal, ax=ax,
            edgecolor="white", linewidth=1.5, saturation=1)
for bars in ax.containers:
    ax.bar_label(bars, fmt="%.3f", padding=3, fontsize=9)
ax.set_ylim(0, 1.1); ax.set_xlabel(""); ax.set_ylabel("ค่า")
ax.set_title("ผลของแต่ละวิธีที่จำนวนคำเหมาะสม (จุด elbow ของ F1@10) · K = 10 · วิธีละ 1,000 คำค้น", fontsize=13, pad=12)
ax.grid(axis="y", color="#e6e8ee"); ax.set_axisbelow(True); sns.despine(left=True)
ax.legend(title="", ncol=4, loc="upper center", bbox_to_anchor=(0.5, -0.08), frameon=False)
fig.text(0.01, 0.01, "Precision@10 สูงสุดได้ 0.10 และ F1@10 สูงสุดได้ 0.182 เพราะแต่ละคำค้นมีเพลงที่ถูกเพียง 1 เพลง · "
         "แต่ละวิธีใช้ความยาวคำค้นต่างกัน", fontsize=9, color="#5b6475")
fig.tight_layout(rect=(0, 0.03, 1, 1))
fig.savefig(HERE / "9_bar_at_F1_elbow.png")
print(sel[["วิธี", words_col] + METRICS + ["MRR"]].round(4).to_string(index=False))
