import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import 'expo-sqlite/localStorage/install'

// ไฟล์นี้สร้าง "ตัวเชื่อมต่อ Supabase" ไว้ตัวเดียว แล้วให้ทุกหน้าใช้ร่วมกัน
// Supabase ทำหน้าที่ 2 อย่างในระบบเรา:
//   1) ระบบบัญชีผู้ใช้ (สมัคร, ยืนยัน OTP ทางอีเมล, เข้าสู่ระบบด้วยอีเมล/Google/Facebook)
//   2) ตาราง users (เก็บ username, email, role ว่าเป็น user หรือ admin, และสถานะ ban)
//
// บรรทัด import ด้านบน 2 บรรทัดเป็นตัวเสริมให้ Supabase ทำงานบนมือถือได้:
//   - url-polyfill: มือถือไม่มีเครื่องมืออ่าน URL แบบเว็บ ตัวนี้เติมให้
//   - expo-sqlite/localStorage: สร้างที่เก็บข้อมูลถาวรในเครื่อง ไว้จำการล็อกอิน

// อ่าน URL และ anon key ของโปรเจกต์ Supabase จากไฟล์ .env
// (anon key เป็นกุญแจสาธารณะที่ออกแบบมาให้อยู่ในแอปได้ สิทธิ์จริงถูกคุมด้วย RLS ฝั่ง Supabase)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

// ถ้าลืมใส่ค่าใน .env ให้เตือนใน terminal แทนการทำให้แอปพัง
// แอปยังเปิดได้ แต่หน้าที่ต้องใช้บัญชีผู้ใช้จะขึ้น error แทน
if (!supabaseUrl || !supabaseKey) {
    console.warn(
        '[supabase] ยังไม่ได้ตั้งค่า EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY ใน .env — ' +
        'ฟีเจอร์ login/register/otp จะใช้งานไม่ได้จนกว่าจะใส่ค่าจริง'
    )
}

// สร้างตัวเชื่อมต่อ (ถ้าไม่มีค่าจริงจะใช้ค่าหลอกแทน เพื่อไม่ให้แอปพังตอนเปิด)
// ตั้งค่าการจำล็อกอิน:
//   - storage: localStorage        เก็บ session ไว้ในเครื่อง ปิดแอปแล้วเปิดใหม่ยังล็อกอินอยู่
//   - autoRefreshToken: true       ต่ออายุ token ให้เองก่อนหมดอายุ ผู้ใช้ไม่หลุดออกจากระบบ
//   - persistSession: true         ให้จำ session ข้ามการปิด-เปิดแอป
//   - detectSessionInUrl: false    ไม่ต้องอ่าน session จาก URL (ใช้กับเว็บเท่านั้น ไม่ใช่มือถือ)
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
