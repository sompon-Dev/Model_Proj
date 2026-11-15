import { supabase } from './supabase';

// ไฟล์นี้รวมฟังก์ชันเกี่ยวกับ "ประวัติการฟังเพลง" ที่หลายหน้าใช้ร่วมกัน
// ประวัติเก็บในตาราง history ของฐานข้อมูล PostgreSQL บน Render (ไม่ได้เก็บใน Supabase)

// ที่อยู่ API สำหรับบันทึกและอ่านประวัติการฟัง
export const HISTORY_URL = 'https://lyriseek-api-database.onrender.com/history';

// หาว่าใครกำลังใช้แอปอยู่ (คืนค่า id ของผู้ใช้ที่ล็อกอินอยู่)
// ดึงจาก session ที่ Supabase จำไว้ในเครื่อง ถ้ายังไม่ล็อกอินจะได้ null
// ใช้ ?. และ ?? null เพื่อกันกรณีไม่มี session แล้วโค้ดพัง
export const getCurrentUserId = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
};

// บันทึกว่าผู้ใช้คนนี้เพิ่งกดฟังเพลง songId
// ขั้นตอน:
//   1) ถ้าไม่มี songId (เพลงไม่มีใน database) ไม่ต้องบันทึก
//   2) หา id ของผู้ใช้ ถ้าไม่ได้ล็อกอินก็ไม่บันทึก
//   3) ส่ง user_id กับ song_id ไปให้ server เพิ่มแถวใหม่ในตาราง history
// ถ้าบันทึกไม่สำเร็จ (เช่น เน็ตหลุด) แค่เขียน log ไว้ ไม่เด้งเตือนผู้ใช้
// เพราะการบันทึกประวัติไม่ควรขัดจังหวะการฟังเพลง
export const recordHistory = async (songId) => {
    if (!songId) return;
    try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        await fetch(HISTORY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, song_id: songId }),
        });
    } catch (err) {
        console.log('บันทึก history ไม่สำเร็จ:', err);
    }
};
