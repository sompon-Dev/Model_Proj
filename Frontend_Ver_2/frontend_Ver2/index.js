import { registerRootComponent } from 'expo';

import App from './App';

// จุดเริ่มต้นของแอป: บอก Expo ว่าให้เปิด App (ใน App.js) เป็นหน้าแรกสุด
// ไม่ว่าจะเปิดในมือถือจริง, Expo Go หรือบนเว็บ ก็เริ่มจากบรรทัดนี้เสมอ
registerRootComponent(App);
