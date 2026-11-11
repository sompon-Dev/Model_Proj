import pickle
from pathlib import Path

import torch
import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer

import re
from pythainlp.tokenize import word_tokenize
from pythainlp.util import normalize

BASE_PATH = Path(__file__).parent

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




#_____________________________________________________________________________________________________________________________________________________________________#
text_input = "จะเร็ว////จะช้า ไม่เคยลบเลือน   ไปภาพวันที่\nเคยสุข"
print("your text is : ",text_input)
#_____________________________________________________________________________________________________________________________________________________________________#
cleaned_text = preprocess(text_input)
print("your Clean text is : ",cleaned_text)
#_____________________________________________________________________________________________________________________________________________________________________#
word_tokenized = word_tokenize(cleaned_text, engine="newmm", keep_whitespace=False)
print("word_tokenize :", word_tokenized)



#_____________________________________________________________________________________________________________________________________________________________________#
embeddings = torch.load(BASE_PATH / "sample_embeddings.pt", weights_only=True) #Load model
with open(BASE_PATH / "sample_metadata.pkl", "rb") as f: #load meta data
    meta = pickle.load(f) #เก็บข้อมูล meta data ในตัวแปร meta
songs, chunks = meta["songs"], meta["chunks"] #เก็บชื่อเพลง ชื่อศิลปินในตัวแปร song และเก็บพวกchunkของเพลง ใน chunk
#_____________________________________________________________________________________________________________________________________________________________________#

model = SentenceTransformer("intfloat/multilingual-e5-base")
q_vec = model.encode(cleaned_text, convert_to_tensor=True)


#print("_____________________________q_vec.shape()_________________________________")
#print("q_vec shape :",q_vec.shape)
#print("___________________________________________________________________")
#____________________ DENSE ____________________#
cosine = []

#print("_________________________q_vec_____________________________________")
#print("Vector Input :",q_vec)
#print("___________________________________________________________________")
#_____________________________________________________________________________________________________________________________________________________________________#
cosine = embeddings @ q_vec
#print("cosine :", cosine.shape, cosine.min().item(), cosine.max().item())

dense = ((cosine - 0.60) / 0.30).clamp(0, 1)   # LO=0.60, HI=0.90 (ค่าที่ tune แล้ว เหมือน Ver.5/Search.py)
#print("dense :", dense.shape, dense.min().item(), dense.max().item())


#print("___________________________Cosine__________________________________")
#print("Cosine Input :",cosine)
#print("____________________________dense__________________________________")
#print("Dense Input :",dense)
#print("____________________________best___________________________________")
#print("Dense Input :",dense)
#print("___________________________________________________________________")


#best = dense.argmax().item()
#print("________________________dense.argmax().item()______________________")
#print("Dense best :",best)
#print("___________________________________________________________________")
#print("chunk ที่ใกล้สุด :", best, chunks[best])
#print("เพลง :", songs[chunks[best]["song_idx"]])

#_____________________________________________________________________________________________________________________________________________________________________#

print("___________________________Lexical________________________________")
tfidf = TfidfVectorizer(token_pattern=r"\S+", ngram_range=(1, 2), sublinear_tf=True)
#TfidfVectorizer คือเครื่องมือของ sklearn เอาไว้เปลี่ยนคำเป็นตัวเลขเหมือน E5 แต่ E5 เอาไว้สำหรับความหมาย
    #token_pattern=r"\S+" | แบ่งคำตามนี้ "จะ เร็ว จะ ช้า" จะได้ ["จะ", "เร็ว", "จะ", "ช้า"]
    #ngram_range=(1, 2) | จับคู่คำ
#chunk_tfidf = tfidf.fit_transform(c["text"] for c in chunks)

texts = []
for c in chunks:
    print(c['song_idx']," ",c['text'])
    texts.append(c["text"])
chunk_tfidf = tfidf.fit_transform(texts)
print("__________________________________________________________________________________________________________________________________________________")
print("chnk_tfidf : ",chunk_tfidf)


q_tfidf = tfidf.transform([cleaned_text])     # แปลง query (ใช้ transform ไม่ใช่ fit)
lexical_sparse = chunk_tfidf @ q_tfidf.T       # คูณกับทุก chunk ได้ (n_chunks, 1)
lexical = torch.tensor(lexical_sparse.toarray().ravel(), dtype=torch.float32)  # แปลงเป็น tensor 1 มิติ
print("lexical :", lexical_sparse)












#print("chunk_tfidf :", chunk_tfidf.shape)          # (154, จำนวนคำทั้งหมด)
#print("__________________________________________________________________")
#print("การจับคู่คำ:", tfidf.get_feature_names_out())
#print("__________________________________________________________________")
#print("___________________________________________________________________")
#print(tfidf.get_feature_names_out())
#print("___________________________________________________________________")
#print(chunks)
#print("___________________________________________________________________")
#q_tfidf = tfidf.transform([cleaned_text])          # ต้องเป็น list และต้องใช้ transform ไม่ใช่ fit
#print("q_tfidf :", q_tfidf.shape)                   # (1, จำนวนคำทั้งหมด)
#print("คำใน query ที่เจอในพจนานุกรม:", tfidf.inverse_transform(q_tfidf))

#lexical_sparse = chunk_tfidf @ q_tfidf.T            # (154, 1) ยังเป็น sparse
#lexical = torch.tensor(lexical_sparse.toarray().ravel(), dtype=torch.float32)  # (154,)
#print("lexical :", lexical.shape, lexical.min().item(), lexical.max().item())
#best_lex = lexical.argmax().item()
#print("chunk ที่คำตรงสุด :", best_lex, chunks[best_lex])
#print("เพลง :", songs[chunks[best_lex]["song_idx"]])

#W_DENSE = 0.2
#scores = W_DENSE * dense + (1 - W_DENSE) * lexical
#best_all = scores.argmax().item()
#print("hybrid best :", best_all, songs[chunks[best_all]["song_idx"]])