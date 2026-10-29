
import pickle
import sys
from pathlib import Path

import pandas as pd
import torch
from sentence_transformers import SentenceTransformer

import re
from pythainlp.tokenize import word_tokenize
from pythainlp.util import normalize

# เครื่อง Windows locale ไทย terminal บางตัวเป็น cp874 พิมพ์ภาษาไทย/ตัวเลขพิเศษไม่ได้ ตั้งเป็น utf-8 กันพลาด
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

songs  = []   # [{song_name, artist}]
chunks = []   # [{song_idx, text}]

WINDOW_TOK, STRIDE_TOK = 32, 16

model = SentenceTransformer("intfloat/multilingual-e5-base")

SAMPLE_CSV = Path(__file__).parent / "sample_10_songs.csv" #กำหนดชื่อตัวแปรเป็น String แล้วก็เก็บเป็น ตำแหน่งของ sample ของ10เพลงตัวอย่าง
#Output : c:\Users\usEr\Documents\Wokr\Thesis\Test\sample_10_songs.csv

df_sample = pd.read_csv(SAMPLE_CSV, encoding="utf-8-sig")
#คำสั่งอ่าน ปกติ

#กำจัดตัวอักษรพิฌสษและจัดการช่องว่าง
def clean_text(text):
    # แก้วรรณยุกต์ซ้อน เช่น " ่่ หรือ  ้้ " / สระผิดตำแหน่ง เช่น " มแว หรือ กได์ "
    text = normalize(text)
    # เอาทุกตัวที่เป็นภาษาไทย ก-ฮ รวมถึงสระ วรรณยุก,ภาษาอังกฤษ,ตัวเลข0-9 นอกนั้นแทนที่ด้วย"" ก็คือตัดออกนั่นแหละ ไม่ใช่พวกนี้ตีเก๊ว่าง่ายๆ
    text = re.sub(r"[^฀-๿a-zA-Z0-9\s]", "", text)
    # ตัดบางข้อความที่มีการเว้นว่าง "   " ออกเป็น " " แค่ช่องเดียว
    text = re.sub(r" +", " ", text).strip()
    return text

# แบ่งคำ
def tokenize_text(text):
    # ตัดคำโดยใช้ newmm ของ pythainlp โดยไม่เอาช่องว่าเป็น Token
    tokens = word_tokenize(text, engine="newmm", keep_whitespace=False)
    
    non_empty_tokens = []
    for t in tokens:          # วนดูทีละคำใน tokens
        if t.strip():         # ถ้าคำนี้ไม่ใช่ช่องว่างเปล่าๆ
            non_empty_tokens.append(t)   # เก็บคำนี้ไว้ในลิสต์ใหม่

    return " ".join(non_empty_tokens)  # ต่อคำที่เหลือด้วยช่องว่าง

#เรียกใช้ทั้ง 2 Function
def preprocess(text):
    """clean + tokenize ในขั้นเดียว ใช้ทั้งตอนสร้าง index และตอนแปลง query ให้ผ่านทางเดียวกัน"""
    return tokenize_text(clean_text(text))

def make_token_chunks(tokens):
    if len(tokens) <= WINDOW_TOK:
        return [" ".join(tokens)]

    result = []                                                         # ตั้ง list ว่างไว้เก็บ chunk
    start_points = range(0, len(tokens) - WINDOW_TOK + 1, STRIDE_TOK)    # คำนวณจุดเริ่มของแต่ละ chunk

    for i in start_points:                   # วนทีละจุดเริ่ม
        piece = tokens[i : i + WINDOW_TOK]      # หยิบคำ 32 คำ เริ่มจากตำแหน่ง i
        text  = " ".join(piece)                 # รวม 32 คำนั้นกลับเป็น string เดียว
        result.append(text)                     # เก็บเข้า list

    return result

all_process = []
all_results = []
for i in df_sample.itertuples():

    token = preprocess(i.lyric).split()
    
    word_chunk = make_token_chunks(token) #แบ่งคำเป็นchunk โดยแต่ละchunk จะมี 32 คำ

     


    texts_to_encode = []
    for c in word_chunk:
        texts_to_encode.append("passage: " + c) #ก็แค่เพิ่มคำว่า passge: ไปไว้ข้างหน้าแต่ละ chunk

    vector = model.encode(texts_to_encode,convert_to_tensor=True)

    

    vector_norm = torch.nn.functional.normalize(vector, p=2, dim=1)
    all_results.append({"name": i.name, "artist": i.artist, "chunks": word_chunk, "vectors": vector_norm,"nonvector":vector})

    all_process.append({"name": i.name,"artist": i.artist,"lyric":i.lyric,"lyricAfterSplit":token,"LyricsAfterChunk":word_chunk,"LyricsAfterEncode":vector,"LyricAfterTorchNorm":vector_norm})

all_results = pd.DataFrame(all_results)
all_process = pd.DataFrame(all_process)

songs = []
chunks = []
all_vectors = []

for row in all_results.itertuples():
    song_idx = len(songs) #ตัวแปรที่สร้างมาเพื่อบอกว่านี้คือเพลงลำดับที่เท่าใหร่
    songs.append({"song_name": row.name, "artist": row.artist}) #ตัวแปรที่เก็บว่าเพลงนี้เพลงอะไร ศิลปินอะไร
    for chunk_text in row.chunks:
        chunks.append({"song_idx": song_idx, "text": chunk_text}) #เพลงลำดับนี้มี Chunk อะไรบ้าง
    all_vectors.append(row.vectors) #เก็บ vector ล้วนๆ


#print("_____________________________________________________________________________")
#print(chunks)
#print("_____________________________________________________________________________")

embeddings_norm = torch.cat(all_vectors)

torch.save(embeddings_norm, Path(__file__).parent / "sample_embeddings.pt")
with open(Path(__file__).parent / "sample_metadata.pkl", "wb") as f:
    pickle.dump({"songs": songs, "chunks": chunks}, f)