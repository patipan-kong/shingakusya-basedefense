import { SaveManager } from '../systems/SaveManager.js';
import { STAGE_CONFIG } from '../data/stages.js';
import { TURRET_TYPES } from '../data/turretTypes.js';
import { TURRET_MAX_LEVEL, BASE_UPGRADE_MAX_LEVEL, COLOR_BASE, FONT_FAMILY } from '../config/constants.js';

// หน้าโหมดทดสอบ: ตั้ง Stage + เลเวลป้อมปืนทั้ง 5 + เลเวลฐานทัพเองได้อิสระ แล้วกระโดดเข้าสู้ทันที
// ไม่เกี่ยวกับ gameplay จริง (เหมือน TestLogger/AutoPlayBot) ใช้เช็คบาลานซ์จุดใดจุดหนึ่งได้เร็วๆ โดยไม่ต้องไล่เล่น/อัปเกรดจากเลเวล 1 ทีละสเตจ
// ไม่แตะ SaveManager ค่าจริงของผู้เล่น (เหรียญ/Stage ปัจจุบัน) เลย นอกจากเลเวลป้อม/ฐานที่ตั้งไว้ตอนกด START (ผู้เล่นต้องกลับมาอัปเกรดเองใหม่ถ้าจะเล่นเกมจริงต่อ)
export class TestModeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TestModeScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1c2833');
        const screenW = this.cameras.main.width;
        const cx = screenW / 2;

        // ปุ่มย้อนกลับ (ซ้ายบนเสมอ ตามสเปค UI ในเอกสารดีไซน์)
        const backBtn = this.add.graphics();
        backBtn.fillStyle(0x7f8c8d, 1);
        backBtn.fillRoundedRect(20, 20, 90, 50, 10);
        backBtn.setInteractive(new Phaser.Geom.Rectangle(20, 20, 90, 50), Phaser.Geom.Rectangle.Contains);
        this.add.text(65, 45, '← Back', { fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        backBtn.on('pointerdown', () => this.scene.start('BaseScene'));

        this.add.text(cx, 45, 'Test Mode', {
            fontFamily: FONT_FAMILY, fontSize: '30px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // เริ่มต้นจากค่าปัจจุบันของผู้เล่นจริง (ดูสถานะปัจจุบันก่อนแล้วค่อยปรับ ไม่ใช่เริ่มจาก 1 เสมอ)
        this.selectedStage = SaveManager.getCurrentStage();
        this.selectedTurretLevels = [0, 1, 2, 3, 4].map((i) => SaveManager.getTurretLevel(i));
        this.selectedBaseLevel = SaveManager.getBaseLevel();

        this.createStageSelector(100);

        const rowStartY = 190;
        const rowGap = 75;
        this.turretRefreshers = TURRET_TYPES.map((type, i) => this.createLevelSelector({
            y: rowStartY + i * rowGap,
            label: type.nameTh,
            color: type.color,
            maxLevel: TURRET_MAX_LEVEL,
            getLevel: () => this.selectedTurretLevels[i],
            onSelect: (level) => { this.selectedTurretLevels[i] = level; }
        }));

        this.createLevelSelector({
            y: rowStartY + TURRET_TYPES.length * rowGap,
            label: 'Base',
            color: COLOR_BASE,
            maxLevel: BASE_UPGRADE_MAX_LEVEL,
            getLevel: () => this.selectedBaseLevel,
            onSelect: (level) => { this.selectedBaseLevel = level; }
        });

        this.createBottomButtons(cx);
    }

    // ตัวเลือก Stage: ปุ่มขยับ -10/-1/+1/+10 รอบตัวเลขปัจจุบัน คลิกยังไงก็ไม่หลุดขอบ 1..จำนวน Stage ทั้งหมด
    createStageSelector(y) {
        const screenW = this.cameras.main.width;
        const cx = screenW / 2;
        const maxStage = STAGE_CONFIG.length;

        this.add.text(30, y - 30, 'Stage to Play', { fontFamily: FONT_FAMILY, fontSize: '16px', fill: '#f39c12', fontStyle: 'bold' });

        this.stageValueText = this.add.text(cx, y, '', {
            fontFamily: FONT_FAMILY, fontSize: '28px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const steps = [
            { delta: -10, x: 30 },
            { delta: -1, x: 110 },
            { delta: 1, x: screenW - 110 - 60 },
            { delta: 10, x: screenW - 30 - 60 }
        ];
        const btnW = 60;
        const btnH = 44;

        steps.forEach(({ delta, x }) => {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x555555, 1);
            gfx.fillRoundedRect(x, y - btnH / 2, btnW, btnH, 8);
            gfx.setInteractive(new Phaser.Geom.Rectangle(x, y - btnH / 2, btnW, btnH), Phaser.Geom.Rectangle.Contains);
            this.add.text(x + btnW / 2, y, delta > 0 ? `+${delta}` : `${delta}`, {
                fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);
            gfx.on('pointerdown', () => {
                this.selectedStage = Phaser.Math.Clamp(this.selectedStage + delta, 1, maxStage);
                this.refreshStageText();
            });
        });

        this.refreshStageText();
    }

    refreshStageText() {
        this.stageValueText.setText(`${this.selectedStage}`);
    }

    // แถวเลือกเลเวล 1..maxLevel — แตะตัวเลขไหนคือเลือกเลเวลนั้นทันที (เขียวเข้ม = เลเวลที่เลือกอยู่) คืนฟังก์ชัน refresh ไว้เรียกซ้ำได้ถ้าต้องอัปเดตจากภายนอก
    createLevelSelector({ y, label, color, maxLevel, getLevel, onSelect }) {
        const swatchSize = 14;
        this.add.circle(35, y, swatchSize / 2, color).setStrokeStyle(1, 0xffffff);
        this.add.text(52, y, label, {
            fontFamily: FONT_FAMILY, fontSize: '16px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        const btnSize = 46;
        const gap = 10;
        const startX = 260;

        const buttons = [];
        for (let level = 1; level <= maxLevel; level++) {
            const bx = startX + (level - 1) * (btnSize + gap);
            const gfx = this.add.graphics();
            gfx.setInteractive(new Phaser.Geom.Rectangle(bx, y - btnSize / 2, btnSize, btnSize), Phaser.Geom.Rectangle.Contains);
            this.add.text(bx + btnSize / 2, y, `${level}`, {
                fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);

            const entry = { level, gfx, x: bx };
            gfx.on('pointerdown', () => {
                onSelect(level);
                refresh();
            });
            buttons.push(entry);
        }

        const refresh = () => {
            const current = getLevel();
            buttons.forEach((b) => {
                b.gfx.clear();
                b.gfx.fillStyle(b.level === current ? 0x27ae60 : 0x555555, 1);
                b.gfx.fillRoundedRect(b.x, y - btnSize / 2, btnSize, btnSize, 8);
            });
        };
        refresh();
        return refresh;
    }

    createBottomButtons(cx) {
        const y = 760;
        const btnW = 260;
        const btnH = 70;
        const gap = 20;

        const startX = cx - btnW - gap / 2;
        const cancelX = cx + gap / 2;

        const startBtn = this.add.graphics();
        startBtn.fillStyle(0xe74c3c, 1);
        startBtn.fillRoundedRect(startX, y, btnW, btnH, 15);
        startBtn.setInteractive(new Phaser.Geom.Rectangle(startX, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        this.add.text(startX + btnW / 2, y + btnH / 2, 'START TEST', { fontFamily: FONT_FAMILY, fontSize: '22px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        startBtn.on('pointerdown', () => this.handleStart());

        const cancelBtn = this.add.graphics();
        cancelBtn.fillStyle(0x7f8c8d, 1);
        cancelBtn.fillRoundedRect(cancelX, y, btnW, btnH, 15);
        cancelBtn.setInteractive(new Phaser.Geom.Rectangle(cancelX, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        this.add.text(cancelX + btnW / 2, y + btnH / 2, 'CANCEL', { fontFamily: FONT_FAMILY, fontSize: '22px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        cancelBtn.on('pointerdown', () => this.scene.start('BaseScene'));
    }

    // ตั้งเลเวลป้อม/ฐานตามที่เลือกไว้จริงลง SaveManager แล้วกระโดดเข้าสู้ Stage ที่เลือกทันที (ข้ามหน้าอัปเกรด)
    handleStart() {
        this.selectedTurretLevels.forEach((level, i) => SaveManager.setTurretLevel(i, level));
        SaveManager.setBaseLevel(this.selectedBaseLevel);

        this.scene.start('MapScene', { stage: this.selectedStage, channel: 'testMode' });
    }
}
