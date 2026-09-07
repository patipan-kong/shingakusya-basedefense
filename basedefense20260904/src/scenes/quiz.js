import { QuizBank } from '../systems/QuizBank.js';
import { renderQuizQuestion, recolorChoiceButton, showExplanationPopup } from './quizRender.js';

// Popup คำถามใช้ร่วมกันทุกจุดที่ต้องการ "กั้น" ด้วยคำถาม (อัปเกรด/ใช้สกิล) — ดู src/systems/QuizGate.js
// เรียกผ่าน this.scene.launch('QuizScene', { callerKey, bankName, onResult }) จาก Scene อื่น ไม่ได้เปิดตรงๆ
// callerKey: key ของ Scene ที่เรียก (ไว้ resume กลับตอนจบ) / bankName: คลังคำถามที่จะสุ่ม ('base'/'play' ดู QuizBank.js)
// onResult(correct): callback บอกผลตอบ
// การวาดโจทย์/ตัวเลือกใช้ renderQuizQuestion() ร่วมกับ QuizPreviewScene (ดู quizRender.js) ห้ามแยกไปแก้คนละที่
export class QuizScene extends Phaser.Scene {
    constructor() {
        super({ key: 'QuizScene' });
    }

    create(data) {
        // บังคับให้ตัวเองอยู่บนสุดของลำดับ render เสมอ — ลำพัง scene.launch() ไม่การันตีเรื่องนี้
        // (ลำดับ render จริงมาจากตำแหน่งใน scene: [...] ของ main.js ไม่ใช่ว่า launch() ทีหลังแล้วจะขึ้นบนอัตโนมัติ
        // UpgradeScene อยู่หลัง QuizScene ในไฟล์นั้น เลยวาดทับ QuizScene ได้ถ้าไม่สั่งตรงนี้)
        this.scene.bringToTop();

        this.callerKey = data.callerKey;
        this.onResult = data.onResult;
        this.answered = false;

        this.cameras.main.setBackgroundColor('#2c3e50');

        this.currentQuiz = QuizBank.draw(data.bankName);
        const { choiceButtons } = renderQuizQuestion(this, this.currentQuiz, (choiceNum) => this.answer(choiceNum));
        this.choiceButtons = choiceButtons;
    }

    // กดตัวเลือก: ล็อกไม่ให้กดซ้ำ, ระบายปุ่มที่กดเขียว/แดงตามผล, โชว์สัญลักษณ์ถูก/ผิด, หน่วงสั้นๆ แล้วปิดกลับไป Scene ผู้เรียก
    answer(choiceNum) {
        if (this.answered) return;
        this.answered = true;

        const correct = choiceNum === this.currentQuiz.right_answer;
        this.showFeedback(correct);

        const clickedBtn = this.choiceButtons.find((b) => b.choiceNum === choiceNum);
        if (clickedBtn) recolorChoiceButton(clickedBtn, correct ? 0x2ecc71 : 0xe74c3c);

        // ข้อจาก quiz_base มีคำอธิบาย (kaisetu_text) ต้องโชว์ป๊อปอัปอธิบายก่อนปิดหน้า Quiz เสมอไม่ว่าตอบถูกหรือผิด
        // (quiz_play ไม่มีฟิลด์นี้ — showExplanationPopup เช็ค kaisetu_text เองแล้วข้ามให้อัตโนมัติถ้าไม่มี)
        this.time.delayedCall(800, () => showExplanationPopup(this, this.currentQuiz, () => this.finish(correct)));
    }

    // สัญลักษณ์ตอบถูก/ผิดกลางจอ — ใช้ภาพจริง symbol_correct.png / symbol_wrong.png (พรีโหลดไว้ใน PreloadScene)
    showFeedback(correct) {
        const cx = this.cameras.main.centerX;
        const cy = this.cameras.main.centerY - 60;
        this.add.image(cx, cy, correct ? 'symbol_correct' : 'symbol_wrong');
    }

    finish(correct) {
        const callerKey = this.callerKey;
        const onResult = this.onResult;

        this.scene.stop();
        this.scene.resume(callerKey);
        onResult(correct);
    }
}
