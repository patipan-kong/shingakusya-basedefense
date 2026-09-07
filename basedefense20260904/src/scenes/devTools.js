import { SaveManager } from '../systems/SaveManager.js';
import { TestLogger } from '../systems/TestLogger.js';
import { AutoPlayBot } from '../systems/AutoPlayBot.js';
import { FONT_FAMILY, SHOW_BOT_BUTTON, SHOW_TEST_MODE_BUTTON, SHOW_QUIZ_PREVIEW_BUTTON } from '../config/constants.js';

// แผงเครื่องมือ dev/QA — เดิมปุ่มพวกนี้วางกลางหน้า Base ตรงๆ ย้ายมาซ่อนหลังไอคอน gear แทน (ดู BaseScene.createTopBar())
// เพราะพื้นที่กลางจอตอนนี้ใช้แสดงป้อมปืน/ฐานทัพตามดีไซน์ใหม่ของลูกค้าแล้ว ไม่เหลือที่ให้ปุ่มเทสเหล่านี้อีก
// เปิดผ่าน scene.pause()+scene.launch() แบบเดียวกับ QuizPreviewScene/BotSettingsScene ปิดแล้วกลับมาที่ BaseScene เดิมได้ทันที
// พฤติกรรมของแต่ละปุ่มเหมือนเดิมทุกประการ (ย้ายมาเฉยๆ ไม่ได้แก้ logic) — ดูคอมเมนต์เดิมที่ base.js เก็บไว้ก่อน commit นี้เทียบได้
export class DevToolsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DevToolsScene' });
    }

    create() {
        const screenW = this.cameras.main.width;
        const cx = screenW / 2;

        this.add.rectangle(0, 0, screenW, this.cameras.main.height, 0x1a1a2e, 0.97).setOrigin(0, 0).setInteractive();

        this.add.text(cx, 40, 'Dev Tools', { fontFamily: FONT_FAMILY, fontSize: '26px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        const closeBtn = this.add.graphics();
        closeBtn.fillStyle(0x7f8c8d, 1);
        closeBtn.fillRoundedRect(20, 20, 70, 44, 10);
        closeBtn.setInteractive(new Phaser.Geom.Rectangle(20, 20, 70, 44), Phaser.Geom.Rectangle.Contains);
        this.add.text(55, 42, '✕ Close', { fontFamily: FONT_FAMILY, fontSize: '13px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        closeBtn.on('pointerdown', () => {
            this.scene.stop();
            this.scene.resume('BaseScene');
        });

        let y = 90;
        if (SHOW_TEST_MODE_BUTTON) { this.createRowButton(cx, y, 0x16a085, 'TEST MODE', () => this.scene.start('TestModeScene')); y += 58; }
        if (SHOW_QUIZ_PREVIEW_BUTTON) {
            this.createRowButton(cx, y, 0xe67e22, 'QUIZ PREVIEW', () => { this.scene.stop(); this.scene.launch('QuizPreviewScene'); });
            y += 58;
        }
        this.createQuizToggleButton(cx, y); y += 58;
        if (SHOW_BOT_BUTTON) { this.createBotButton(cx, y); y += 100; }
        this.createTestLogButtons(cx, y);
    }

    createRowButton(cx, y, color, label, onClick) {
        const btnW = 300;
        const btnH = 46;
        const x = cx - btnW / 2;
        const gfx = this.add.graphics();
        gfx.fillStyle(color, 1);
        gfx.fillRoundedRect(x, y, btnW, btnH, 10);
        gfx.setInteractive(new Phaser.Geom.Rectangle(x, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        this.add.text(cx, y + btnH / 2, label, { fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        gfx.on('pointerdown', onClick);
        return gfx;
    }

    // ปุ่มเปิด/ปิด Quiz Gate (ดู src/systems/QuizGate.js) — ปิดไว้เพื่อเทสเร็วๆ ได้ ไม่ต้องตอบคำถามทุกครั้ง
    createQuizToggleButton(cx, y) {
        const btnW = 300;
        const btnH = 46;
        const x = cx - btnW / 2;

        const gfx = this.add.graphics();
        const text = this.add.text(cx, y + btnH / 2, '', { fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        gfx.setInteractive(new Phaser.Geom.Rectangle(x, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);

        const refresh = () => {
            const enabled = SaveManager.getQuizEnabled();
            gfx.clear();
            gfx.fillStyle(enabled ? 0x2ecc71 : 0x7f8c8d, 1);
            gfx.fillRoundedRect(x, y, btnW, btnH, 10);
            text.setText(`Quiz: ${enabled ? 'ON' : 'OFF'}`);
        };

        gfx.on('pointerdown', () => {
            SaveManager.setQuizEnabled(!SaveManager.getQuizEnabled());
            refresh();
        });

        refresh();
    }

    // ปุ่มปล่อยบอท — ถ้ายังไม่ทำงาน กดแล้วเปิด popup ตั้งค่า (BotSettingsScene), ถ้ากำลังทำงานอยู่ กดซ้ำ = สั่งหยุด
    createBotButton(cx, y) {
        const btnW = 300;
        const btnH = 46;
        const x = cx - btnW / 2;
        const isRunning = AutoPlayBot.isActive;

        const gfx = this.add.graphics();
        gfx.fillStyle(isRunning ? 0xc0392b : 0x8e44ad, 1);
        gfx.fillRoundedRect(x, y, btnW, btnH, 10);
        gfx.setInteractive(new Phaser.Geom.Rectangle(x, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        this.add.text(cx, y + btnH / 2, isRunning ? '■ STOP BOT' : '🤖 Release Bot', {
            fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        gfx.on('pointerdown', () => {
            if (AutoPlayBot.isActive) {
                AutoPlayBot.stop();
                this.scene.restart();
            } else {
                this.scene.stop();
                this.scene.launch('BotSettingsScene');
            }
        });

        this.botStatusText = this.add.text(cx, y + btnH + 18, isRunning ? AutoPlayBot.statusText() : '', {
            fontFamily: FONT_FAMILY, fontSize: '13px',
            fill: '#f39c12',
            align: 'center',
            wordWrap: { width: this.cameras.main.width - 40 }
        }).setOrigin(0.5);
    }

    updateBotStatusText(text) {
        if (this.botStatusText) this.botStatusText.setText(text);
    }

    createTestLogButtons(cx, y) {
        const btnW = 145;
        const btnH = 50;
        const gap = 10;
        const copyX = cx - btnW - gap / 2;
        const clearX = cx + gap / 2;

        this.logStatusText = this.add.text(cx, y + btnH + 22, `Test Log: ${TestLogger.getBattleCount()} runs`, {
            fontFamily: FONT_FAMILY, fontSize: '15px',
            fill: '#ff6b6b',
            align: 'center'
        }).setOrigin(0.5);

        const copyBtn = this.add.graphics();
        copyBtn.fillStyle(0x27ae60, 1);
        copyBtn.fillRoundedRect(copyX, y, btnW, btnH, 10);
        copyBtn.setInteractive(new Phaser.Geom.Rectangle(copyX, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        this.add.text(copyX + btnW / 2, y + btnH / 2, 'EXPORT LOG', { fontFamily: FONT_FAMILY, fontSize: '15px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        copyBtn.on('pointerdown', () => this.exportTestLog());

        const clearBtn = this.add.graphics();
        clearBtn.fillStyle(0x7f8c8d, 1);
        clearBtn.fillRoundedRect(clearX, y, btnW, btnH, 10);
        clearBtn.setInteractive(new Phaser.Geom.Rectangle(clearX, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        this.add.text(clearX + btnW / 2, y + btnH / 2, 'CLEAR LOG', { fontFamily: FONT_FAMILY, fontSize: '15px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        clearBtn.on('pointerdown', () => {
            // เคลียร์ทั้ง Test Log และ Save จริง (เหรียญ/เลเวลป้อม/เลเวลฐาน/Stage/Quiz toggle) กลับเป็นค่าเริ่มต้นเหมือนเริ่มเกมส์ใหม่
            TestLogger.reset();
            SaveManager.reset();
            this.scene.stop();
            this.scene.stop('BaseScene');
            this.scene.start('BaseScene'); // รีสตาร์ท BaseScene ให้ยอดเหรียญ/Stage ที่แสดงอยู่รีเฟรชตามค่าใหม่ทั้งหมด
        });
    }

    // ดาวน์โหลด Log ทั้งหมดเป็นไฟล์ .csv จริงๆ (Blob + object URL + คลิก <a download> ชั่วคราว)
    // ถ้าสร้างไฟล์ไม่สำเร็จ (เช่นบล็อกจาก browser) fallback ไปพิมพ์ลง console แทน (เรียก dumpTestLog() เองได้)
    exportTestLog() {
        const text = TestLogger.export();
        const count = TestLogger.getBattleCount();

        if (count === 0) {
            this.logStatusText.setText('No data yet — play at least 1 round first');
            return;
        }

        try {
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
            const filename = `basedefense_testlog_${timestamp}.csv`;
            const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.logStatusText.setText(`Downloaded! (${count} runs)\n -> ${filename}`);
        } catch (e) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => this.logStatusText.setText(`Download failed — copied to clipboard instead! (${count} runs) Paste to send`))
                    .catch(() => {
                        console.log(text);
                        this.logStatusText.setText('Download/copy failed — printed to console instead (F12)');
                    });
            } else {
                console.log(text);
                this.logStatusText.setText('Download/copy failed — printed to console instead (F12)');
            }
        }
    }
}
