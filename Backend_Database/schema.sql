-- สร้างตาราง User สำหรับเก็บข้อมูลผู้ใช้
CREATE TABLE IF NOT EXISTS "User" (
    user_id     SERIAL PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL   -- เก็บเป็น hash ไม่เก็บ plain text
);
