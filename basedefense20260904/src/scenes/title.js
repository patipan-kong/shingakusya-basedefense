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

        // รอรับคำสั่งคลิกเพื่อไปหน้า Base — await SaveSync.ready ก่อนเสมอ กัน BaseScene อ่าน SaveManager.data
        // ไปแสดงผล (เหรียญ/เลเวล/Stage) ก่อนที่ผลโหลดจาก server (ถ้ามี member_id) จะกลับมาถึง ปกติ resolve เร็วมาก
        // อยู่แล้วเพราะมีเวลาช่วง Preload+หน้านี้ให้โหลดคู่ขนานไปแล้ว จะรอเพิ่มเฉพาะกรณี network ช้าจริงๆ เท่านั้น
        this.input.once('pointerdown', async () => {
            await SaveSync.ready;
            this.scene.start('BaseScene');
        });
    }
}