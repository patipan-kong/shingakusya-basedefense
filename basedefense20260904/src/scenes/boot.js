export class BootScene extends Phaser.Scene {
    constructor() {
        // กำหนด Key สำหรับเรียกใช้ Scene นี้
        super({ key: 'BootScene' });
    }

    preload() {
        // โหลดฟอนต์หลักของเกมผ่าน rexwebfontloaderplugin ก่อน Scene อื่นทุกตัว (แม้แต่ "Loading..." ของ PreloadScene เอง)
        // จะได้ใช้ฟอนต์นี้ตั้งแต่ข้อความแรกที่แสดงในเกม — ดู css/fonts.css (@font-face) + FONT_FAMILY ใน constants.js
        this.load.rexWebFont({
            custom: {
                families: ['YasashisaGothicBold'],
                urls: ['css/fonts.css']
            }
        });
    }

    create() {
        console.log('Booting System...');
        // เปลี่ยนหน้าไปที่ PreloadScene
        this.scene.start('PreloadScene');
    }
}