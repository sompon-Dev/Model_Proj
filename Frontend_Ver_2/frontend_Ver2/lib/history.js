import { supabase } from './supabase';

export const HISTORY_URL = 'https://lyriseek-api-database.onrender.com/history'; // ⚠️ ตัวเดียวกับ backend ใน Homeuser.js (Backend_Database/main.py)

// users_id ของผู้ใช้ที่ login อยู่ อ่านจาก session ที่เก็บไว้ในเครื่อง (ไม่ต้องยิงเน็ต) ไม่ได้ login คืน null
export const getCurrentUserId = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
};

// บันทึกว่าผู้ใช้กดฟังเพลงนี้ ไม่สำเร็จก็ไม่เป็นไร ไม่ให้มาบล็อกการเปิดเพลง
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
