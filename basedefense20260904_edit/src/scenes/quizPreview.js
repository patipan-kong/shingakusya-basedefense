import { QuizBank } from '../systems/QuizBank.js';
import { FONT_FAMILY } from '../config/constants.js';
import { renderQuizQuestion, recolorChoiceButton } from './quizRender.js';

// หน้าพรีวิว Quiz สำหรับ QA ตรวจว่าโจทย์/ตัวเลือก/เฉลยของทุกข้อในคลังแสดงถูกต้องหรือไม่
// มี 2 คลังแยกกัน (ดู QuizBank.js): 'base' = assets/quiz_base/*.json (ตอนอัปเกรดฐาน/ป้อม, มี kaisetu_text/kaisetu_imagefile ด้วย)
// และ 'play' = assets/quiz_play/*.json (ตอนใช้สกิลระหว่างรบ) — สลับดูได้ด้วยปุ่ม BASE/PLAY บนแถบเมนู
// ต่างจาก QuizScene จริง (ดู quiz.js ที่ใช้ตอนเล่นเกมส์จริงผ่าน QuizGate.js) ตรงที่:
// - ไล่ตามลำดับในคลังตรงๆ (QuizBank.getPool()) ไม่สุ่มแบบ QuizBank.draw()
// - มีปุ่ม PREV/NEXT เดินหน้า-ถอยหลังได้อิสระ วนซ้ำได้ไม่จำกัด ไม่ล็อกเมื่อตอบ
// - กดตัวเลือกได้เพื่อดูว่าเฉลยไหนถูก (ไฮไลต์เขียว) แต่ไม่ปิดหน้า/ไม่มีผลต่อ SaveManager หรือ gameplay จริงใดๆ ทั้งสิ้น
// การวาดโจทย์/ตัวเลือกใช้ renderQuizQuestion() ร่วมกับ QuizScene จริง (ดู quizRender.js) เพื่อให้ตำแหน่ง/ขนาดตรงกันเป๊ะเสมอ
// ห้ามแยกไปเขียนโค้ดวาดโจทย์/ตัวเลือกซ้ำที่นี่ — แถบปุ่มปิด/สลับคลัง/PREV/NEXT ด้านล่างนี้รวบเป็นแถวเดียวสั้นๆ ที่มุมบนโดยเจตนา
// เพื่อไม่ให้ล้ำพื้นที่โจทย์ที่เริ่มที่ y=20 (ตำแหน่งเดียวกับ QuizScene จริง)
export class QuizPreviewScene extends Phaser.Scene {
    constructor() {
        super({ key: 'QuizPreviewScene' });
    }

    create() {
        this.scene.bringToTop();
        this.cameras.main.setBackgroundColor('#2c3e50');
        this.bankName = 'play';
        this.index = 0;
        this.quizObjects = []; // ของที่ต้องทำลายทิ้งทุกครั้งที่เปลี่ยนข้อ (ต่างจาก chrome ด้านบนที่คงอยู่ตลอด)
        this.choiceButtons = [];

        this.createChrome();
        this.renderQuiz();
    }

    createChrome() {
        const screenW = this.cameras.main.width;
        const cx = screenW / 2;
        const y = 20;
        const h = 50;

        // ปุ่มปิด (ซ้ายสุด) — กลับไป Base เหมือนตอนตอบ Quiz จริงจบ (ดู QuizScene.finish())
        const closeW = 70;
        const closeBtn = this.add.graphics();
        closeBtn.fillStyle(0x7f8c8d, 1);
        closeBtn.fillRoundedRect(20, y, closeW, h, 10);
        closeBtn.setInteractive(new Phaser.Geom.Rectangle(20, y, closeW, h), Phaser.Geom.Rectangle.Contains);
        this.add.text(20 + closeW / 2, y + h / 2, '✕ Close', { fontFamily: FONT_FAMILY, fontSize: '16px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        closeBtn.on('pointerdown', () => {
            this.scene.stop();
            this.scene.resume('BaseScene');
        });

        // ปุ่มสลับคลัง (base/play) — ต่อจากปุ่มปิด ป้ายบอกชื่อคลังที่กำลังดูอยู่ กดแล้วสลับ + รีเซ็ตกลับข้อ 1
        const bankW = 80;
        const bankX = 20 + closeW + 10;
        const bankBtn = this.add.graphics();
        const bankText = this.add.text(bankX + bankW / 2, y + h / 2, '', {
            fontFamily: FONT_FAMILY, fontSize: '15px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        const refreshBankBtn = () => {
            bankBtn.clear();
            bankBtn.fillStyle(this.bankName === 'base' ? 0x8e44ad : 0x16a085, 1);
            bankBtn.fillRoundedRect(bankX, y, bankW, h, 10);
            bankText.setText(this.bankName === 'base' ? 'BASE' : 'PLAY');
        };
        bankBtn.setInteractive(new Phaser.Geom.Rectangle(bankX, y, bankW, h), Phaser.Geom.Rectangle.Contains);
        bankBtn.on('pointerdown', () => {
            this.bankName = this.bankName === 'base' ? 'play' : 'base';
            refreshBankBtn();
            this.index = 0;
            this.renderQuiz();
        });
        refreshBankBtn();

        // PREV/NEXT ชิดขอบซ้าย-ขวา แถวเดียวกับปุ่มปิด กันไม่ให้ไปทับพื้นที่โจทย์ (เริ่ม y=140) เหมือน QuizScene จริง
        const navW = 60;
        const prevBtn = this.add.graphics();
        prevBtn.fillStyle(0x3498db, 1);
        prevBtn.fillRoundedRect(bankX + bankW + 10, y, navW, h, 10);
        prevBtn.setInteractive(new Phaser.Geom.Rectangle(bankX + bankW + 10, y, navW, h), Phaser.Geom.Rectangle.Contains);
        this.add.text(bankX + bankW + 10 + navW / 2, y + h / 2, '◀', { fontFamily: FONT_FAMILY, fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        prevBtn.on('pointerdown', () => this.goTo(this.index - 1));

        const nextBtn = this.add.graphics();
        nextBtn.fillStyle(0x3498db, 1);
        nextBtn.fillRoundedRect(screenW - 20 - navW, y, navW, h, 10);
        nextBtn.setInteractive(new Phaser.Geom.Rectangle(screenW - 20 - navW, y, navW, h), Phaser.Geom.Rectangle.Contains);
        this.add.text(screenW - 20 - navW / 2, y + h / 2, '▶', { fontFamily: FONT_FAMILY, fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        nextBtn.on('pointerdown', () => this.goTo(this.index + 1));

        this.counterText = this.add.text(cx, y + h / 2, '', {
            fontFamily: FONT_FAMILY, fontSize: '20px', fill: '#f39c12', fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    goTo(newIndex) {
        const total = QuizBank.getPool(this.bankName).length;
        if (total === 0) return;
        this.index = ((newIndex % total) + total) % total; // วนลูป: ข้อสุดท้าย -> ข้อแรก และย้อนกลับจากข้อแรก -> ข้อสุดท้าย
        this.renderQuiz();
    }

    // วาดโจทย์/ตัวเลือกของข้อปัจจุบันผ่าน renderQuizQuestion() ที่ใช้ร่วมกับ QuizScene จริง (ดู quizRender.js)
    renderQuiz() {
        this.quizObjects.forEach((obj) => obj.destroy());
        this.quizObjects = [];
        this.choiceButtons = [];

        const pool = QuizBank.getPool(this.bankName);
        this.counterText.setText(pool.length ? `Question ${this.index + 1} / ${pool.length}` : 'No questions in bank');
        if (pool.length === 0) return;

        const quiz = pool[this.index];
        const { objects, choiceButtons } = renderQuizQuestion(this, quiz, () => this.revealAnswer(quiz.right_answer));
        this.quizObjects = objects;
        this.choiceButtons = choiceButtons;
    }

    // กดตัวเลือกข้อไหนก็ได้ -> ไฮไลต์ปุ่มที่เป็นเฉลยจริงเป็นสีเขียวทันที (เช็คว่า right_answer ในคลังตรงกับที่ตั้งใจไว้ไหม)
    // ต่างจาก QuizScene จริงตรงที่กดซ้ำได้ไม่จำกัด ไม่ล็อก ไม่ปิดหน้า เพราะจุดประสงค์คือดูเฉลย ไม่ใช่ทดสอบการตอบจริง
    // ใช้ recolorChoiceButton() ร่วมกับ QuizScene จริง (ดู quizRender.js) รองรับทั้ง 2 ทรง (rect/circle) ในที่เดียว
    revealAnswer(rightAnswer) {
        this.choiceButtons.forEach((btn) => {
            recolorChoiceButton(btn, btn.choiceNum === rightAnswer ? 0x27ae60 : 0x3498db);
        });
    }
}
