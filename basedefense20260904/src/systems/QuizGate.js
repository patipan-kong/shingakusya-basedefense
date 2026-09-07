// จุดเดียวที่ Scene อื่น (UpgradeScene / MapScene) เรียกใช้เพื่อ "กั้น" การกระทำไว้หลังคำถาม
// ปิดระบบ (SaveManager.getQuizEnabled()===false) ให้ผ่านไปเลยตามที่ขอ (สะดวกตอนเทส)
//
// เปิดระบบ: pause scene ผู้เรียก (Phaser scene.pause() หยุดทั้ง step ของ scene นั้น — physics/timer/tween
// ของ scene ที่ถูก pause จะหยุดตามไปด้วยเพราะขับเคลื่อนจาก step เดียวกัน) แล้ว launch QuizScene ทับขึ้นมา
// ไม่ใช้ MapScene.pauseGame() เดิม เพราะอันนั้นโชว์ popup เมนู Pause ด้วย ซึ่งไม่ใช่สิ่งที่ต้องการตรงนี้
import { SaveManager } from './SaveManager.js';

// bankName: ชื่อคลังคำถามใน QuizBank (ดู QuizBank.js) — 'base' ตอนอัปเกรดฐาน/ป้อม (UpgradeScene),
// 'play' ตอนใช้สกิลระหว่างรบ (MapScene) ต้องระบุทุกครั้งที่เรียก ไม่มีค่า default เพื่อกันเรียกผิดคลังเงียบๆ
// onResult(correct) เสริม (ถ้ามี) — เรียกทุกครั้งที่ตอบจริง (ทั้งถูก/ผิด) ไม่เรียกตอน quiz ปิดอยู่ (เพราะไม่มีการตอบจริงเกิดขึ้น)
// ใช้เก็บสถิติ (เช่น TestLogger นับจำนวนตอบถูก/ผิด) แยกจาก onPassed ที่เป็น gate หลักของฟีเจอร์
export function requestQuizGate(scene, bankName, onPassed, onResult) {
    if (!SaveManager.getQuizEnabled()) {
        onPassed();
        return;
    }

    const callerKey = scene.scene.key;
    scene.scene.pause();
    scene.scene.launch('QuizScene', {
        callerKey,
        bankName,
        onResult: (correct) => {
            if (onResult) onResult(correct);
            if (correct) onPassed(); // ตอบผิด = ไม่เรียก onPassed เฉยๆ ผู้เล่นกดปุ่มเดิมเพื่อลองใหม่ได้
        }
    });
}
