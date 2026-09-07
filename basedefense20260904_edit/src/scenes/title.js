import { FONT_FAMILY } from '../config/constants.js';
import { SaveSync } from '../systems/SaveSync.js';

export class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        // ใช้ this.cameras.main.centerX/Y สำหรับหาจุดกึ่งกลางของจอ 2400x1080
        const text = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            "TITLE\nまもれ!ポピー宇宙基地\n(Click to Start)",
            { fontFamily: FONT_FAMILY, fontSize: '48px', fill: '#000000', align: 'center' }
        ).setOrigin(0.5);

        // ผลของ SaveSync.ready (server load เสร็จ/ล้มเหลว) — null จนกว่าจะรู้ผล คลิกก่อนหน้านั้นถูกเมิน (รอเฉยๆ)
        // ปกติ resolve เร็วมากอยู่แล้วเพราะมีเวลาช่วง Preload+หน้านี้ให้โหลดคู่ขนานไปก่อนแล้ว จะรอนานเฉพาะกรณี
        // network ช้าจริงๆ เท่านั้น (สูงสุดตาม timeout ใน SaveApi.js)
        let saveReadyResult = null;
        SaveSync.ready.then((result) => {
            saveReadyResult = result;
            if (!result.ok) {
                // โหลด save จาก server ไม่สำเร็จ — ต้องไม่ปล่อยให้เข้าเกม (เสี่ยง save ทับ progress จริงด้วย default
                // เพราะไม่มี localStorage cache ให้ fallback ไปแล้ว) แสดงข้อความไว้ ผู้เล่นต้องรีโหลดหน้าเพื่อลองใหม่
                console.error('[TitleScene] โหลด save จาก server ไม่สำเร็จ — บล็อกไม่ให้เริ่มเกม (reason=' + result.reason + ')');
                text.setText('Failed to load your save data.\nPlease check your connection and reload the page.');
            }
        });

        // ใช้ .on (ไม่ใช่ .once) เพราะอาจต้องรับคลิกซ้ำได้ระหว่างที่ยังรอผล SaveSync.ready อยู่ (คลิกก่อนรู้ผลจะถูกเมิน)
        this.input.on('pointerdown', () => {
            if (saveReadyResult === null) return; // ยังไม่รู้ผล (network ช้า) — รอก่อน ไม่ทำอะไร
            if (!saveReadyResult.ok) return; // โหลดล้มเหลว — บล็อกไว้ถาวร (ข้อความ error โชว์อยู่แล้ว)
            this.scene.start('BaseScene');
        });
    }
}
