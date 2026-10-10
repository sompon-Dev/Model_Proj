import importlib.util, sys, time, csv, random
from pathlib import Path
import numpy as np
import torch

BASE_PATH = Path(".").resolve()

def load_search_module(mod_name, search_py_path):
    folder = search_py_path.parent
    old_syspath = list(sys.path)
    sys.path.insert(0, str(folder))
    try:
        spec = importlib.util.spec_from_file_location(mod_name, search_py_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[mod_name] = module
        spec.loader.exec_module(module)
        return module
    finally:
        sys.path[:] = old_syspath

t0 = time.time()
sm = load_search_module("search_v5_cal", BASE_PATH.parent / "Ver.5" / "Search.py")
t_load = time.time() - t0
print(f"load_time_sec={t_load:.2f}")

sys.path.insert(0, str(BASE_PATH.parent / "Ver.5"))
from textproc import preprocess

with open("smallTest/TestCase_2.csv", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))

rng = random.Random(1)
sample = rng.sample(rows, 300)
queries = [r["เนื้อเพลง10คำ"] for r in sample]

for trial in range(2):
    t1 = time.time()
    prepped = [preprocess(q) for q in queries]
    q_vecs = sm.model.encode(["query: " + p for p in prepped], convert_to_tensor=True,
                              normalize_embeddings=True, batch_size=64, show_progress_bar=False)
    dense = ((sm.embeddings @ q_vecs.T - 0.70) / 0.25).clamp(0, 1)
    q_tfidf = sm.tfidf.transform(prepped)
    lexical = torch.tensor((sm.chunk_tfidf @ q_tfidf.T).toarray(), dtype=torch.float32)
    scores = sm.W_DENSE * dense + (1 - sm.W_DENSE) * lexical
    order = scores.argsort(dim=0, descending=True).numpy()
    t_batch = time.time() - t1
    print(f"trial={trial} batch300_time_sec={t_batch:.2f}")
