import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import 'expo-sqlite/localStorage/install'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

// ยังไม่มีไฟล์ .env (ต้องขอ URL/anon key ของจริงจากเจ้าของโปรเจกต์ Supabase) — createClient()
// ของ supabase-js จะ throw error ทันทีถ้าได้ค่า undefined เข้ามา ซึ่งพังตั้งแต่ตอน import ไฟล์นี้
// เลย (ก่อนหน้าจอไหนจะ render ด้วยซ้ำ) เลยใส่ placeholder ปลอมไว้กันพัง แค่ให้แอปเปิดได้ก่อน
// ฟีเจอร์ที่ต้องใช้ supabase จริง (login, register, otp) จะยัง "กดได้" แต่ขึ้น error แจ้งว่าทำไม่สำเร็จ
// (ไม่ crash ทั้งแอป) จนกว่าจะใส่ค่าในไฟล์ .env จริงแล้วรันใหม่
if (!supabaseUrl || !supabaseKey) {
    console.warn(
        '[supabase] ยังไม่ได้ตั้งค่า EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY ใน .env — ' +
        'ฟีเจอร์ login/register/otp จะใช้งานไม่ได้จนกว่าจะใส่ค่าจริง'
    )
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-anon-key',
    {
        auth: {
            storage: localStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    }
)