import { QuizBank } from '../systems/QuizBank.js';
import { stripImageExt } from './quizRender.js';
import { FONT_FAMILY } from '../config/constants.js';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // ดึงขนาดหน้าจอจากระบบ (อิงตาม 2400x1080 ที่ตั้งไว้ใน config)
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // สร้างข้อความ Loading
        const loadingText = this.add.text(width / 2, height / 2 - 80, 'Loading...', {
            fontFamily: FONT_FAMILY, fontSize: '48px',
            fill: '#333333'
        }).setOrigin(0.5);

        // สร้างกรอบและแถบโหลดดิง (Progress Bar) — เก็บเป็น this. ไว้ใช้ทำลายทิ้งตอนจบจริงใน create() แทน
        // (ตอนนี้มีการโหลดรอบสองสำหรับรูปภาพ Quiz ต่อจากรอบนี้ — ดู create() — เลยยังทำลายทิ้งตรงนี้เลยไม่ได้)
        this.progressBar = this.add.graphics();
        this.progressBox = this.add.graphics();
        this.loadingText = loadingText;
        this.progressBox.fillStyle(0x222222, 0.2); // สีพื้นหลังของกรอบโหลด
        this.progressBox.fillRect(width / 2 - 260, height / 2, 520, 60);

        // อัปเดตแถบและตัวเลขเปอร์เซ็นต์ตามสถานะการโหลดจริง
        // การโหลดจริงมี 2 รอบ (รอบสอง = รูปภาพ Quiz หลังรู้ชื่อไฟล์จาก JSON ดู create()) — Phaser รีเซ็ต value กลับ 0 ทุกครั้งที่ this.load.start()
        // ถูกเรียกใหม่ ถ้าโชว์ value ตรงๆ แถบจะวิ่งครบ 100% แล้ววืดกลับ 0% ใหม่ให้เห็น 2 รอบ (ของเดิมที่ผู้ใช้ทักมา) จึงคูณถ่วงน้ำหนักตาม
        // this.loadPhase ให้เห็นเป็นแถบเดียวไหลต่อเนื่อง 0->100% ตลอด (สัดส่วน 85/15 เป็นค่าประมาณคร่าวๆ ตามจำนวนไฟล์แต่ละรอบ ไม่ต้องเป๊ะ)
        this.loadPhase = 1;
        const PHASE1_WEIGHT = 0.85;
        this.load.on('progress', (value) => {
            const displayed = this.loadPhase === 1 ? value * PHASE1_WEIGHT : PHASE1_WEIGHT + value * (1 - PHASE1_WEIGHT);
            this.progressBar.clear();
            this.progressBar.fillStyle(0x27ae60, 1); // สีเขียวของแถบที่กำลังวิ่ง
            this.progressBar.fillRect(width / 2 - 250, height / 2 + 10, 500 * displayed, 40);
            loadingText.setText(`Loading... ${Math.floor(displayed * 100)}%`);
        });

        // ==========================================
        // TODO: ใส่คำสั่งโหลด Assets ทั้งหมดของเกมที่นี่
        // ==========================================
        // ตัวอย่าง: this.load.image('base_core', 'assets/images/base_core.png');
        // ตัวอย่าง: this.load.audio('bgm_battle', 'assets/audio/bgm_battle.mp3');

        // ภาพพื้นหลังหน้าต่อสู้ (MapScene) — ขนาดเท่าจอพอดี 640x840 ไม่ต้อง scale
        this.load.image('gameplay_bg', 'assets/gameplay_bg.png');

        // ภาพป้อมปืนจริง 5 กระบอก (แทน placeholder Graphics เดิม) — key ต้องตรงกับ TURRET_TYPES[].sprite ใน turretTypes.js
        this.load.image('gun_black', 'assets/gun_black.png');
        this.load.image('gun_yellow', 'assets/gun_yellow.png');
        this.load.image('gun_red', 'assets/gun_red.png');
        this.load.image('gun_blue', 'assets/gun_blue.png');
        this.load.image('gun_colorful', 'assets/gun_colorful.png');

        // ศูนย์วิจัย (มุมซ้ายล่างของจอ) — spritesheet 5 เฟรม เฟรมแสดงตามเลเวลฐานทัพ (SaveManager.getBaseLevel())
        this.load.spritesheet('research_center', 'assets/research-center.png', { frameWidth: 512, frameHeight: 220 });

        // แถบ HP ฐานทัพ — ชื่อไฟล์มีช่องว่าง จึงต้อง encode เป็น %20 ใน path ที่โหลด
        this.load.image('base_hp_frame', 'assets/base%20HP_frame.png');
        this.load.image('base_hp_minus', 'assets/base%20HP%20minus.png');
        this.load.image('base_hp_fill', 'assets/base%20HP%20fill.png');

        // แถบ Enemies Left (มุมบนซ้าย) — ใช้ภาพชุดเดียวกับ HP bar (frame+minus+fill) แต่แทน % ศัตรูที่เหลือใน Wave นี้แทน % HP
        this.load.image('enemy_hp_frame', 'assets/enemy_HP_frame.png');
        this.load.image('enemy_hp_minus', 'assets/enemy_HP_minus.png');
        this.load.image('enemy_hp_fill', 'assets/enemy_HP_fill.png');

        // ปุ่ม Pause มุมบนขวา
        this.load.image('btn_pause', 'assets/btn_pause.png');

        // แถบเกจสกิล (แนวตั้ง แทน segmented bar เดิม) + ปุ่มกดใช้สกิล (แทนปุ่มวงกลมเดิม)
        this.load.image('skill_frame', 'assets/skill_frame.png');
        this.load.image('skill_minus', 'assets/skill_minus.png');
        this.load.image('skill_fill', 'assets/skill_fill.png');
        this.load.image('skill_monitor', 'assets/skill_monitor.png');

        // สัญลักษณ์ตอบถูก/ผิดของ Quiz (แทนวงกลม/กากบาทที่วาดด้วย Graphics เดิม) — ดู QuizScene.showFeedback()
        this.load.image('symbol_correct', 'assets/symbol_correct.png');
        this.load.image('symbol_wrong', 'assets/symbol_wrong.png');

        // คลังคำถาม Quiz Gate — แยก 2 bank ตามจุดที่ใช้งาน (base=ตอนอัปเกรดฐาน/ป้อม, play=ตอนใช้สกิลระหว่างรบ)
        // แต่ละ bank แยกไฟล์ย่อยตามรายวิชาเพื่อง่ายต่อการจัดการฝั่งลูกค้า (2026-09-03) — ไฟล์+รูปอยู่รวมกันที่ assets/quiz_base/, assets/quiz_play/
        // ถ้าลูกค้าเพิ่ม/ลดไฟล์รายวิชา ต้องมาแก้ 2 รายการ (BASE_QUIZ_FILES/PLAY_QUIZ_FILES) นี้ให้ตรงด้วย เพราะ Phaser loader ในเบราว์เซอร์
        // ไม่มีทาง list ไฟล์ในโฟลเดอร์เองแบบ dynamic ต้องระบุชื่อไฟล์ตรงๆ ล่วงหน้าเท่านั้น
        const BASE_QUIZ_FILES = ['quiz_list_base_english', 'quiz_list_base_japanese', 'quiz_list_base_society'];
        const PLAY_QUIZ_FILES = ['quiz_list_english', 'quiz_list_japanese', 'quiz_list_math', 'quiz_list_science', 'quiz_list_society'];
        BASE_QUIZ_FILES.forEach((name) => this.load.json('quizfile_base_' + name, `assets/quiz_base/${name}.json`));
        PLAY_QUIZ_FILES.forEach((name) => this.load.json('quizfile_play_' + name, `assets/quiz_play/${name}.json`));
        this.baseQuizFiles = BASE_QUIZ_FILES;
        this.playQuizFiles = PLAY_QUIZ_FILES;

        // (โค้ดจำลองการโหลดไฟล์เพื่อให้เห็นแถบ Loading Bar ทำงาน สามารถลบทิ้งได้เมื่อมีการโหลดไฟล์จริง)
        for (let i = 0; i < 150; i++) {
            this.load.image('mock_img_' + i, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
        }
    }

    create() {
        console.log('Preload Complete');

        // รวมไฟล์รายวิชาย่อยของแต่ละ bank เป็น array เดียว แล้วแปะ _bank ('base'/'play') ไว้ในแต่ละข้อ
        // ให้ quizRender.js รู้ว่าต้องโหลดรูปจากโฟลเดอร์ไหน (assets/quiz_base/ หรือ assets/quiz_play/) โดยไม่ต้องส่ง bankName
        // ผ่านทุกฟังก์ชันย่อยเพิ่ม (quiz.js/quizPreview.js ก็ใช้ pool เดียวกันนี้ ได้ _bank ติดมาด้วยอัตโนมัติ)
        const baseQuizzes = this.baseQuizFiles.flatMap((name) => this.cache.json.get('quizfile_base_' + name).map((q) => ({ ...q, _bank: 'base' })));
        const playQuizzes = this.playQuizFiles.flatMap((name) => this.cache.json.get('quizfile_play_' + name).map((q) => ({ ...q, _bank: 'play' })));
        QuizBank.setPool('base', baseQuizzes);
        QuizBank.setPool('play', playQuizzes);

        const finishLoading = () => {
            this.progressBar.destroy();
            this.progressBox.destroy();
            this.loadingText.destroy();
            this.scene.start('TitleScene');
        };

        // โหลดรูปภาพ Quiz ทั้งหมดล่วงหน้าเป็นรอบที่สอง (ต้องรู้ข้อมูล JSON ก่อนถึงจะรู้ว่ามีไฟล์ไหนบ้าง โหลดพร้อม assets อื่นในรอบแรกไม่ได้)
        // กันภาพกระพริบ/โผล่ทีหลังตอนเจอคำถามครั้งแรก และสำคัญกว่านั้นคือให้ renderQuizQuestion() รู้ขนาดภาพจริงได้ทันทีแบบ synchronous
        // เพื่อเลือก UI ตัวเลือกให้ถูกแบบตั้งแต่ต้น (สี่เหลี่ยมมีข้อความ VS วงกลม ア/イ/ウ/エ สำหรับภาพยาว — ดู checkIsLongImage ใน quizRender.js)
        // key: ชื่อไฟล์ (นามสกุลถูกตัดออกแล้ว, ดู stripImageExt) -> bank ('base'/'play') ไว้เลือกโฟลเดอร์โหลดให้ถูก
        // ต้องแยก Map ต่อ bank เพราะรูปตอนนี้ย้ายไปอยู่คนละโฟลเดอร์กันแล้ว (assets/quiz_base/ vs assets/quiz_play/)
        // ไม่ใช่โฟลเดอร์ assets/quiz/ รวมเดียวเหมือนเดิม — ดู stripImageExt เรื่อง .png ที่ปนมากับชื่อไฟล์ในบางไฟล์ (english) ด้วย
        const imageNameToBank = new Map();
        [...baseQuizzes, ...playQuizzes].forEach((q) => {
            const addImg = (fileName) => { if (fileName) imageNameToBank.set(stripImageExt(fileName), q._bank); };
            addImg(q.quiz_imagefile);
            addImg(q.kaisetu_imagefile); // เฉพาะ quiz_base เท่านั้นที่มีฟิลด์นี้ (ป๊อปอัปคำอธิบายหลังตอบ)
            for (let i = 1; i <= 4; i++) addImg(q['choice_imagefile' + i]);
        });

        if (imageNameToBank.size === 0) {
            // ไม่มีรอบสองจริงๆ — วาดแถบให้เต็ม 100% ก่อนตัดเข้าเกม กันค้างที่ 85% (ค่า PHASE1_WEIGHT) เฉยๆ
            this.loadingText.setText('Loading... 100%');
            finishLoading();
            return;
        }

        this.loadPhase = 2; // ให้ 'progress' handler ด้านบนคำนวณเปอร์เซ็นต์ต่อจาก PHASE1_WEIGHT แทนที่จะรีเซ็ตกลับ 0%
        imageNameToBank.forEach((bank, name) => this.load.image('quizimg_' + name, `assets/quiz_${bank}/${name}.png`));
        this.load.once('complete', finishLoading);
        this.load.start();
    }
}