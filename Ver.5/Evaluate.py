"""
Evaluate.py (Ver.5)
วัดว่า dataset ที่ใหญ่ขึ้นมาก (Ver.4: 80 เพลง -> Ver.5: ~7,900 เพลง) มีผลกับความแม่นยำของการค้นหา
ด้วยคำค้นแบบเดียวกับ Ver.4/Evaluate.py (จำท่อนเนื้อเพลงมาพิมพ์ ทั้งแบบตรงเป๊ะ/ทิ้งคำ/จำผิด)

แบ่งเป็น 2 ชุดคำถามที่ตอบคนละคำถาม:
  ชุด A "เพลงเดิม 80 เพลง"  — รันกับทั้ง Ver.4 และ Ver.5 เทียบกันตรงๆ
      ถ้า Top-1/Top-5 ของ Ver.5 ต่ำกว่า Ver.4 ชัดเจน แปลว่าพอมีเพลงมากขึ้น มี chunk อื่น
      มาแย่งอันดับ ทำให้ความแม่นยำต่อ "เพลงเดิม" แย่ลง
  ชุด B "เพลงใหม่ ~7,900 เพลง" — รันกับ Ver.5 อย่างเดียว (Ver.4 ไม่มีเพลงพวกนี้ในคลังเลย
      จึงหาไม่เจอ 100% อยู่แล้ว ไม่มีประโยชน์จะรันเทียบ) ไว้ดูว่า Ver.5 หาเพลงใหม่เจอแม่นแค่ไหน
"""
import csv
import importlib.util
import random
import sys
from pathlib import Path

BASE_PATH = Path(__file__).parent


def _load_module(name, file_path, extra_syspath):
    """โหลด Search.py ของ Ver.4 กับ Ver.5 แยกกันแบบไม่ชนกัน — ถ้าใช้ import Search ตรงๆ
    ทั้งคู่จะชื่อโมดูล 'Search' เหมือนกัน ตัวที่ import ทีหลังจะได้โมดูลตัวแรกที่ cache ไว้แทน
    (ไม่ใช่โมดูลใหม่) จึงต้องโหลดจาก path ตรงๆ ด้วย importlib แทน"""
    old_syspath = list(sys.path)   # เก็บ sys.path เดิมไว้ก่อน จะคืนกลับทีหลังไม่ว่าจะสำเร็จหรือพัง (finally)
    sys.path.insert(0, str(extra_syspath))   # ให้ Search.py หา textproc.py ของตัวเองเจอ
    try:
        # ขั้นตอนโหลดโมดูลจาก path ไฟล์ตรงๆ (ไม่ผ่าน import ปกติ) มี 4 ก้าว:
        spec = importlib.util.spec_from_file_location(name, file_path)  # 1) สร้าง "สเปค" อธิบายว่าโมดูลนี้ชื่ออะไร อยู่ไฟล์ไหน (ยังไม่ได้รันโค้ดในไฟล์)
        module = importlib.util.module_from_spec(spec)  # 2) สร้าง module object เปล่าๆ ตามสเปคนั้น (ยังไม่มีตัวแปร/ฟังก์ชันข้างในเลย)
        sys.modules[name] = module  # 3) ลงทะเบียนโมดูลนี้ใน sys.modules ด้วยชื่อ "name" ที่เราตั้งเอง (เช่น "search_v4"/"search_v5") แยกจากชื่อไฟล์จริง "Search" กันชนกัน
        spec.loader.exec_module(module)  # 4) รันโค้ดทั้งไฟล์จริงๆ ตอนนี้ ใส่ตัวแปร/ฟังก์ชันทุกตัวที่ไฟล์สร้างเข้าไปใน module object นี้
        return module
    finally:
        sys.path[:] = old_syspath


V5 = _load_module("search_v5", BASE_PATH / "Search.py", BASE_PATH)
V4 = _load_module("search_v4", BASE_PATH.parent / "Ver.4" / "Search.py", BASE_PATH.parent / "Ver.4")

N_QUERIES = 150
SEED      = 42

BASE_PATH     = Path(__file__).parent
VER4_CLEANED  = BASE_PATH.parent / "Ver.4" / "CleanedData"
DATASET_INPUT = BASE_PATH.parent / "DatasetInput"


def build_old_queries():
    """สุ่มท่อนจากเพลงเดิม 80 เพลง (มีโครงสร้างบรรทัด) แบบเดียวกับ Ver.4/Evaluate.py"""
    rng = random.Random(SEED)
    songs, vocab = [], set()
    for artist_folder in sorted(VER4_CLEANED.iterdir()):
        for txt in sorted(artist_folder.glob("*.txt")):
            lines = [l for l in txt.read_text(encoding="utf-8").splitlines() if l.strip()]
            vocab.update(w for l in lines for w in l.split())
            if lines:
                songs.append((txt.stem, artist_folder.name, lines))
    vocab = sorted(vocab)

    def sample(n_lines, drop=0.0, swap=0.0):
        out = []
        for _ in range(N_QUERIES):
            name, artist, lines = rng.choice([s for s in songs if len(s[2]) >= n_lines])
            start = rng.randrange(len(lines) - n_lines + 1)
            toks = " ".join(lines[start:start + n_lines]).split()
            # "or toks[:1]" กันเหลือ list คำค้นเปล่าถ้าทิ้งคำออกหมด (ใช้คำแรกแทน)
            toks = [t for t in toks if rng.random() >= drop] or toks[:1]
            toks = [rng.choice(vocab) if rng.random() < swap else t for t in toks]  # จำลองจำผิดเป็นคำอื่นแบบสุ่ม ตามสัดส่วน swap
            out.append(("".join(toks), name, artist))
        return out

    return {
        "exact":          sample(1),
        "drop40%":        sample(1, drop=0.40),
        "swap30%":        sample(1, swap=0.30),
    }


def build_new_queries():
    """สุ่มช่วงคำ (token window) จากเพลงใหม่ใน DatasetInput แทน 'บรรทัด' เพราะเนื้อเพลงพวกนี้
    เป็นก้อนเดียว ไม่มีการตัดบรรทัด"""
    rng = random.Random(SEED)
    sys.path.insert(0, str(BASE_PATH))
    from textproc import preprocess

    songs, vocab = [], set()
    for fname in ("famous_with_genre.csv", "songs_enriched.csv"):
        with open(DATASET_INPUT / fname, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                tokens = preprocess(row["lyric"]).split()
                vocab.update(tokens)
                if len(tokens) >= 8:
                    songs.append((row["name"], row["artist"], tokens))

    def sample(n_tok, drop=0.0, swap=0.0):
        out = []
        for _ in range(N_QUERIES):
            name, artist, tokens = rng.choice(songs)
            start = rng.randrange(len(tokens) - n_tok + 1)
            toks = list(tokens[start:start + n_tok])
            toks = [t for t in toks if rng.random() >= drop] or toks[:1]
            toks = [rng.choice(vocab) if rng.random() < swap else t for t in toks]
            out.append(("".join(toks), name, artist))
        return out

    return {
        "exact":   sample(8),
        "drop40%": sample(8, drop=0.40),
        "swap30%": sample(8, swap=0.30),
    }


def rank_of(results, name, artist):
    for i, r in enumerate(results):
        if r["song_name"] == name and r["artist"] == artist:
            return i + 1
    return None


def run(label, engines, sets):
    print(f"\n### {label} ###")
    print(f"{'ชุด':<10} {'engine':<8} {'Top-1':>7} {'Top-3':>7} {'Top-5':>7} {'MRR':>7}")
    print("-" * 50)
    for set_name, queries in sets.items():
        for eng_name, fn in engines.items():
            ranks = [rank_of(fn(q), n, a) for q, n, a in queries]
            top = lambda k: sum(1 for r in ranks if r and r <= k) / len(ranks)  # สัดส่วน query ที่เจอเพลงถูกต้องในอันดับ <= k
            mrr = sum(1 / r for r in ranks if r) / len(ranks)  # Mean Reciprocal Rank: เฉลี่ย 1/อันดับ ของที่เจอ (ไม่เจอ/None ถูกกรองออก)
            print(f"{set_name:<10} {eng_name:<8} {top(1):>7.1%} {top(3):>7.1%} {top(5):>7.1%} {mrr:>7.3f}")
        print()


def main():
    print(f"Ver.4: {len(V4.songs)} เพลง / {len(V4.chunks)} chunks")
    print(f"Ver.5: {len(V5.songs)} เพลง / {len(V5.chunks)} chunks")

    old_sets = build_old_queries()
    run(
        "ชุด A — คำค้นจากเพลงเดิม 80 เพลง (เทียบ Ver.4 vs Ver.5)",
        {"Ver.4": lambda q: V4.search(q, top_k=11), "Ver.5": lambda q: V5.search(q, top_k=11)},
        old_sets,
    )

    new_sets = build_new_queries()
    run(
        "ชุด B — คำค้นจากเพลงใหม่ ~7,900 เพลง (Ver.5 เท่านั้น เพราะ Ver.4 ไม่มีเพลงพวกนี้)",
        {"Ver.5": lambda q: V5.search(q, top_k=11)},
        new_sets,
    )


if __name__ == "__main__":
    main()
