"""ทดสอบ 4 วิธีค้นหาที่ K = 10 และหาค่า K ที่เหมาะสม

ชุดทดสอบ : Evaluation/ModelEval/TestModel.csv (1,000 เพลง x คำค้นยาว 1-20 คำ = 20,000 คำค้น)
วิธีที่เทียบ:
  Matching word    นับจำนวนคำในคำค้นที่มีอยู่ในเนื้อเพลง (ทั้งเพลง)
  Dense 100%       E5 embedding อย่างเดียว
  Lexical 100%     TF-IDF อย่างเดียว
  Hybrid (ระบบเรา) 0.2 x Dense + 0.8 x TF-IDF (ค่าเดียวกับ Ver.5/Search.py)
นิยามค่าวัดผล (แต่ละคำค้นมีเพลงที่ถูกต้อง 1 เพลง):
  Precision@10 = (เพลงถูกอยู่ใน Top 10 ? 1 : 0) / 10
  Recall@10    = เพลงถูกอยู่ใน Top 10 หรือไม่
  F1@10        = 2PR / (P + R)
  MRR          = เฉลี่ยของ 1 / อันดับของเพลงถูก
  Accuracy     = P@1 = เพลงถูกอยู่อันดับ 1 หรือไม่
คะแนนเสมอกัน: สุ่มลำดับภายในกลุ่มที่เสมอ (seed 2026) ใช้วิธีเดียวกันทุกวิธี

รัน: python Evaluation/K-Test/run_k_test.py   (ใช้เวลาประมาณ 5 นาทีบน CPU)
"""
import csv, sys
from pathlib import Path
import numpy as np
import pandas as pd
import torch
import seaborn as sns
import matplotlib.pyplot as plt
from sklearn.feature_extraction.text import CountVectorizer

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = Path(__file__).parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "Ver.5"))
import Search as S
from textproc import preprocess

K = 10
LENGTHS = list(range(1, 21))
BATCH = 250
METHODS = ["Matching word", "Dense 100%", "Lexical 100%", "Hybrid (ระบบเรา)"]
PALETTE = {"Matching word": "#eda100", "Dense 100%": "#1baf7a", "Lexical 100%": "#eb6834", "Hybrid (ระบบเรา)": "#2a78d6"}
rng = np.random.default_rng(2026)

# ---------- 1) ชุดทดสอบ ----------
rows = list(csv.DictReader(open(ROOT / "Evaluation/ModelEval/TestModel.csv", encoding="utf-8-sig")))
testset = pd.DataFrame([{"ชื่อเพลง": r["ชื่อเพลง"], "ชื่อศิลปิน": r["ชื่อศิลปิน"],
                         **{f"คำค้น{n}คำ": r[f"ตัวอย่างเพลง{n}คำ"] for n in LENGTHS}} for r in rows])
testset.to_csv(HERE / "1_testset.csv", index=False, encoding="utf-8-sig")

key_to_idx = {(s["song_name"], s["artist"]): i for i, s in enumerate(S.songs)}
targets = np.array([key_to_idx[(r["ชื่อเพลง"], r["ชื่อศิลปิน"])] for r in rows])
n_songs = len(S.songs)
chunk_song = torch.tensor([c["song_idx"] for c in S.chunks]).long()

song_words = [[] for _ in range(n_songs)]
for c in S.chunks:
    song_words[c["song_idx"]].append(c["text"])
cv = CountVectorizer(token_pattern=r"\S+", binary=True)
song_bin = cv.fit_transform([" ".join(t) for t in song_words])


def rank_of(song_scores, tgt):
    t = song_scores[tgt, torch.arange(len(tgt))]
    greater = (song_scores > t).sum(0).numpy()
    equal_others = (song_scores == t).sum(0).numpy() - 1
    return greater + 1 + rng.integers(0, equal_others + 1)


def chunk_to_song(scores):
    idx = chunk_song.unsqueeze(1).expand_as(scores)
    return torch.full((n_songs, scores.shape[1]), float("-inf")).scatter_reduce(0, idx, scores, reduce="amax")


# ---------- 2) หาอันดับของเพลงที่ถูกในทุกคำค้น ----------
res = []
for n in LENGTHS:
    prepped = [preprocess(r[f"ตัวอย่างเพลง{n}คำ"]) for r in rows]
    for s in range(0, len(rows), BATCH):
        qp = prepped[s:s + BATCH]
        tgt = torch.tensor(targets[s:s + BATCH])
        qv = S.model.encode(qp, convert_to_tensor=True, batch_size=64, show_progress_bar=False)
        dense = (S.embeddings @ qv.T - S.DENSE_LO) / (S.DENSE_HI - S.DENSE_LO)
        lex = torch.tensor((S.chunk_tfidf @ S.tfidf.transform(qp).T).toarray(), dtype=torch.float32)
        match = torch.tensor((song_bin @ cv.transform(qp).T).toarray(), dtype=torch.float32)
        rk = {"Matching word": rank_of(match, tgt),
              "Dense 100%": rank_of(chunk_to_song(dense), tgt),
              "Lexical 100%": rank_of(chunk_to_song(lex), tgt),
              "Hybrid (ระบบเรา)": rank_of(chunk_to_song(S.W_DENSE * dense + (1 - S.W_DENSE) * lex), tgt)}
        for j in range(len(qp)):
            r = rows[s + j]
            res.append({"ชื่อเพลง": r["ชื่อเพลง"], "ชื่อศิลปิน": r["ชื่อศิลปิน"], "จำนวนคำ": n,
                        "คำค้น": r[f"ตัวอย่างเพลง{n}คำ"], **{f"อันดับ_{m}": int(rk[m][j]) for m in METHODS}})
    print(f"เสร็จ {n} คำ", flush=True)
res = pd.DataFrame(res)
res.to_csv(HERE / "2_rank_per_query.csv", index=False, encoding="utf-8-sig")


# ---------- 3) คำนวณค่าวัดผล ----------
def metrics(r):
    r = np.asarray(r)
    hit = (r <= K).astype(float)
    P, R = hit / K, hit
    return {f"Precision@{K}": P.mean(), f"Recall@{K}": R.mean(), f"F1@{K}": (2 * P * R / (P + R + 1e-12)).mean(),
            "MRR": (1 / r).mean(), "Accuracy (P@1)": (r == 1).mean()}


overall = pd.DataFrame([{"วิธี": m, **metrics(res[f"อันดับ_{m}"])} for m in METHODS])
overall.round(4).to_csv(HERE / "3_metrics_K10_overall.csv", index=False, encoding="utf-8-sig")
by_len = pd.DataFrame([{"วิธี": m, "จำนวนคำ": n, **metrics(g[f"อันดับ_{m}"])}
                       for n, g in res.groupby("จำนวนคำ") for m in METHODS])
by_len.round(4).to_csv(HERE / "4_metrics_K10_by_length.csv", index=False, encoding="utf-8-sig")
rk = pd.DataFrame([{"K": k, **{m: (res[f"อันดับ_{m}"] <= k).mean() for m in METHODS}} for k in range(1, 51)])
rk.round(4).to_csv(HERE / "5_recall_at_K_1-50.csv", index=False, encoding="utf-8-sig")

# ---------- 4) กราฟ ----------
def elbow(x, y):
    """หาจุด elbow แบบ kneedle (เส้นเพิ่มขึ้นแล้วค่อยๆ แบน)
    ปรับ x, y ให้อยู่ช่วง 0-1 แล้วเลือกจุดที่ y_norm - x_norm มากที่สุด
    = จุดที่ห่างจากเส้นตรงจากจุดแรกถึงจุดสุดท้ายมากที่สุด"""
    x, y = np.asarray(x, float), np.asarray(y, float)
    xn = (x - x.min()) / (x.max() - x.min())
    yn = (y - y.min()) / (y.max() - y.min())
    return int(x[np.argmax(yn - xn)])



plt.rcParams["font.family"] = "Leelawadee UI"
NOTE = f"Precision@{K} สูงสุดได้ 1/{K} = {1 / K:.2f} และ F1@{K} สูงสุดได้ {2 / (K + 1):.3f} เพราะแต่ละคำค้นมีเพลงที่ถูกเพียง 1 เพลง"

# 4.1 กราฟแท่ง 5 ค่า
long = overall.melt(id_vars="วิธี", var_name="ค่าวัดผล", value_name="ค่า")
fig, ax = plt.subplots(figsize=(13, 6.5), dpi=150)
sns.barplot(data=long, x="ค่าวัดผล", y="ค่า", hue="วิธี", palette=PALETTE, ax=ax, edgecolor="white", linewidth=1.5, saturation=1)
for bars in ax.containers:
    ax.bar_label(bars, fmt="%.3f", padding=3, fontsize=8.5, rotation=90)
ax.set_ylim(0, 1.1); ax.set_xlabel(""); ax.set_ylabel("ค่า")
ax.set_title(f"เปรียบเทียบ 4 วิธีค้นหาที่ K = {K} (TestModel 1,000 เพลง × คำค้น 1–20 คำ = 20,000 คำค้น)", fontsize=13, pad=12)
ax.grid(axis="y", color="#e6e8ee"); ax.set_axisbelow(True); sns.despine(left=True)
ax.legend(title="", ncol=4, loc="upper center", bbox_to_anchor=(0.5, -0.08), frameon=False)
fig.text(0.01, 0.01, NOTE, fontsize=9, color="#5b6475")
fig.tight_layout(rect=(0, 0.03, 1, 1)); fig.savefig(HERE / "6_bar_K10.png"); plt.close(fig)

# 4.2 กราฟเส้นแยกตามจำนวนคำ 2x2
markers = {"Matching word": "s", "Dense 100%": "^", "Lexical 100%": "D", "Hybrid (ระบบเรา)": "o"}
PANELS = [(f"Precision@{K}", f"Precision@{K}"), (f"Recall@{K}", f"Recall@{K}"),
          (f"F1@{K}", f"F1@{K}"), ("Accuracy (P@1)", "Accuracy (Top-1) = P@1")]
fig, axes = plt.subplots(2, 2, figsize=(15, 10.5), dpi=150)
for ax, (col, title) in zip(axes.flat, PANELS):
    sns.lineplot(data=by_len, x="จำนวนคำ", y=col, hue="วิธี", style="วิธี", palette=PALETTE, markers=markers,
                 dashes=False, linewidth=1.8, markersize=6, ax=ax)
    for i, m in enumerate(METHODS):
        s = by_len[by_len["วิธี"] == m].sort_values("จำนวนคำ")
        n_el = elbow(s["จำนวนคำ"].values, s[col].values)
        b = s[s["จำนวนคำ"] == n_el].iloc[0]
        ax.scatter(b["จำนวนคำ"], b[col], marker="*", s=260, color=PALETTE[m], edgecolor="#1d2433", linewidth=0.8, zorder=5)
        ax.text(0.99, 0.30 - i * 0.07, f"{m}: elbow ที่ {n_el} คำ ({b[col]:.4f})",
                transform=ax.transAxes, ha="right", fontsize=9, color=PALETTE[m], fontweight="bold")
    ax.set_title(title, fontsize=13); ax.set_xticks(LENGTHS); ax.set_ylim(0, by_len[col].max() * 1.12)
    ax.set_xlabel("จำนวนคำในคำค้น"); ax.set_ylabel("ค่า"); ax.grid(color="#e6e8ee")
    ax.get_legend().remove(); sns.despine(ax=ax)
h, l = axes[0, 0].get_legend_handles_labels()
fig.legend(h, l, loc="lower center", ncol=4, frameon=False, fontsize=11)
fig.suptitle(f"ผลการค้นหาแยกตามจำนวนคำในคำค้น (TestModel 1,000 เพลง, K = {K})", fontsize=15)
fig.text(0.5, 0.045, NOTE + " · ดาว = จุด elbow (kneedle): จุดที่เส้นอยู่ห่างจากเส้นตรงที่ลากจากจุดแรกถึงจุดสุดท้ายมากที่สุด หลังจุดนี้เพิ่มจำนวนคำแล้วค่าเพิ่มขึ้นน้อย",
         ha="center", fontsize=9.5, color="#5b6475")
fig.tight_layout(rect=(0, 0.07, 1, 0.96)); fig.savefig(HERE / "7_by_length_K10.png"); plt.close(fig)

# 4.3 กราฟ Recall@K เพื่อเลือก K
rkl = rk.melt(id_vars="K", var_name="วิธี", value_name="Recall@K")
fig, ax = plt.subplots(figsize=(12, 6.2), dpi=150)
ax.axvspan(5, 10, color="#2a78d6", alpha=0.07, lw=0)
sns.lineplot(data=rkl, x="K", y="Recall@K", hue="วิธี", palette=PALETTE, linewidth=2, ax=ax)
hy = rk.set_index("K")["Hybrid (ระบบเรา)"]
for k in [1, 5, 10, 20]:
    ax.scatter(k, hy[k], color="#2a78d6", s=40, zorder=5, edgecolor="white")
    ax.annotate(f"K={k}\n{hy[k]:.3f}", (k, hy[k]), textcoords="offset points", xytext=(0, 10), ha="center", fontsize=9)
ax.axvline(K, color="#2a78d6", ls="--", lw=1)
ax.text(7.5, rkl["Recall@K"].min() + 0.01, "ช่วงที่แนะนำ K = 5–10\n(หลัง K = 5 เพิ่ม 1 อันดับได้ไม่ถึง 0.5%)",
        ha="center", fontsize=9, color="#2a78d6")
ax.set_xlim(0, 50.5); ax.set_xticks([1, 5, 10, 15, 20, 25, 30, 40, 50])
ax.set_xlabel("K (จำนวนเพลงที่แสดงในผลค้นหา)"); ax.set_ylabel("Recall@K")
ax.set_title("Recall@K เมื่อเปลี่ยนจำนวนผลที่แสดง (20,000 คำค้น ยาว 1–20 คำ)", fontsize=13, pad=10)
ax.grid(color="#e6e8ee"); sns.despine(); ax.legend(title="", loc="lower right", frameon=False)
fig.tight_layout(); fig.savefig(HERE / "8_recall_at_K.png"); plt.close(fig)

print(overall.round(4).to_string(index=False))
