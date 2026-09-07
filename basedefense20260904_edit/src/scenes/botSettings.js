import { AutoPlayBot } from '../systems/AutoPlayBot.js';
import { FONT_FAMILY } from '../config/constants.js';

// ตัดเหลือเฉพาะโปรไฟล์ที่จำเป็นต้องทดสอบจริงๆ (เดิม 4 กลยุทธ์ x 6 นโยบาย = 24 combination ตามที่ปรับ 2026-08-27)
// อัพเกรด: ตัด 'random' ออก เพราะผลลัพธ์อยู่กึ่งกลางระหว่าง cheapest/specialize อยู่แล้ว ไม่ให้ข้อมูลใหม่
const UPGRADE_STRATEGIES = [
    { id: 'cheapest', label: 'Cheapest' },
    { id: 'specialize', label: 'Specialize' },
    { id: 'none', label: 'None' }
];

// สกิล: เหลือแค่ 2 ขอบเขต (never/asap) + lowHP ตัวแทนพฤติกรรมผู้เล่นจริงที่สุด
// ตัด swarmDefense/maxChargeOnly/lateGameOnly ออก เพราะผลลัพธ์ควรอยู่ระหว่างขอบเขต never/asap อยู่แล้ว
const SKILL_POLICIES = [
    { id: 'never', label: 'Never' },
    { id: 'asap', label: 'ASAP' },
    { id: 'lowHP', label: 'Low HP' }
];

// Popup ตั้งค่าก่อนปล่อยบอท — เลือกว่าจะรันกลยุทธ์อัพเกรด/นโยบายสกิลชุดไหนบ้าง (ค่าเริ่มต้น = เลือกครบทุกอัน = รันทุก combination)
// เปิดผ่าน scene.pause()+scene.launch() แบบเดียวกับ QuizScene เพื่อให้ BaseScene รออยู่ข้างใต้ ไม่ต้องสร้างใหม่
export class BotSettingsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BotSettingsScene' });
    }

    create() {
        this.scene.bringToTop(); // กันโดน Scene อื่นวาดทับ (ดูเหตุผลเดียวกับ QuizScene)

        this.cameras.main.setBackgroundColor('#1c2833');

        const screenW = this.cameras.main.width;
        const cx = screenW / 2;

        this.add.text(cx, 40, 'Bot Settings', {
            fontFamily: FONT_FAMILY, fontSize: '32px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.selectedUpgrades = new Set(UPGRADE_STRATEGIES.map((s) => s.id));
        this.selectedSkills = new Set(SKILL_POLICIES.map((s) => s.id));

        this.add.text(30, 90, 'Upgrade Strategy', { fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#f39c12', fontStyle: 'bold' });
        this.upgradeButtons = this.createToggleRow(UPGRADE_STRATEGIES, this.selectedUpgrades, 30, 120, UPGRADE_STRATEGIES.length, screenW - 60);

        this.add.text(30, 195, 'Skill Policy', { fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#f39c12', fontStyle: 'bold' });
        this.skillButtons = this.createToggleRow(SKILL_POLICIES, this.selectedSkills, 30, 225, SKILL_POLICIES.length, screenW - 60);

        this.comboCountText = this.add.text(cx, 340, '', {
            fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#ffffff'
        }).setOrigin(0.5);
        this.refreshComboCount();

        this.createBottomButtons(cx);
    }

    // สร้างปุ่ม toggle เรียงเป็นตาราง cols คอลัมน์ ความกว้างรวม totalWidth — คืนลิสต์ {id, gfx, text, selectedSet} ไว้ toggle สี
    createToggleRow(items, selectedSet, x, y, cols, totalWidth) {
        const gap = 10;
        const btnW = (totalWidth - gap * (cols - 1)) / cols;
        const btnH = 46;
        const rowGap = 10;

        const buttons = [];
        items.forEach((item, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const bx = x + col * (btnW + gap);
            const by = y + row * (btnH + rowGap);

            const gfx = this.add.graphics();
            gfx.setInteractive(new Phaser.Geom.Rectangle(bx, by, btnW, btnH), Phaser.Geom.Rectangle.Contains);
            const text = this.add.text(bx + btnW / 2, by + btnH / 2, item.label, {
                fontFamily: FONT_FAMILY, fontSize: '14px', fill: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);

            const entry = { id: item.id, gfx, text, selectedSet };
            gfx.on('pointerdown', () => {
                if (selectedSet.has(item.id)) selectedSet.delete(item.id);
                else selectedSet.add(item.id);
                this.refreshToggleButton(entry);
                this.refreshComboCount();
            });

            buttons.push(entry);
            this.refreshToggleButton(entry, bx, by, btnW, btnH);
        });

        return buttons;
    }

    refreshToggleButton(entry, x, y, w, h) {
        // เก็บพิกัดไว้ตอนสร้างครั้งแรก (x/y/w/h ส่งมาแค่รอบแรก) ใช้ hitArea เดิมซ้ำได้ทุกครั้งที่ toggle
        if (x !== undefined) {
            entry.x = x; entry.y = y; entry.w = w; entry.h = h;
        }
        const selected = entry.selectedSet.has(entry.id);
        entry.gfx.clear();
        entry.gfx.fillStyle(selected ? 0x27ae60 : 0x555555, 1);
        entry.gfx.fillRoundedRect(entry.x, entry.y, entry.w, entry.h, 8);
    }

    refreshComboCount() {
        const count = this.selectedUpgrades.size * this.selectedSkills.size;
        this.comboCountText.setText(`Total ${count} combination`);
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
        this.add.text(startX + btnW / 2, y + btnH / 2, 'START BOT', { fontFamily: FONT_FAMILY, fontSize: '22px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        startBtn.on('pointerdown', () => this.handleStart());

        const cancelBtn = this.add.graphics();
        cancelBtn.fillStyle(0x7f8c8d, 1);
        cancelBtn.fillRoundedRect(cancelX, y, btnW, btnH, 15);
        cancelBtn.setInteractive(new Phaser.Geom.Rectangle(cancelX, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        this.add.text(cancelX + btnW / 2, y + btnH / 2, 'CANCEL', { fontFamily: FONT_FAMILY, fontSize: '22px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        cancelBtn.on('pointerdown', () => {
            this.scene.stop();
            this.scene.resume('BaseScene');
        });
    }

    // สร้าง queue เป็น cross-product ของกลยุทธ์อัพเกรด x นโยบายสกิลที่เลือกไว้ แล้วปล่อยบอทเริ่มทำงานทันที
    handleStart() {
        if (this.selectedUpgrades.size === 0 || this.selectedSkills.size === 0) return; // ต้องเลือกอย่างน้อยฝั่งละ 1

        const queue = [];
        UPGRADE_STRATEGIES.forEach((u) => {
            if (!this.selectedUpgrades.has(u.id)) return;
            SKILL_POLICIES.forEach((s) => {
                if (!this.selectedSkills.has(s.id)) return;
                queue.push({ upgradeStrategy: u.id, skillPolicy: s.id });
            });
        });

        this.scene.stop();
        const baseScene = this.scene.get('BaseScene');
        this.scene.resume('BaseScene');

        AutoPlayBot.start(queue);
        AutoPlayBot.onBaseSceneReady(baseScene);
    }
}
