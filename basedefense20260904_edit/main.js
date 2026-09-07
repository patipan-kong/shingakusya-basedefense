// นำเข้า Scene ทั้งหมดแบบ ES Module
import { BootScene } from './src/scenes/boot.js';
import { PreloadScene } from './src/scenes/preload.js';
import { BaseScene } from './src/scenes/base.js';
import { TitleScene } from './src/scenes/title.js';
import { MapScene } from './src/scenes/map.js';
import { QuizScene } from './src/scenes/quiz.js';
import { UpgradeScene } from './src/scenes/upgrade.js';
import { BattleListScene } from './src/scenes/battleList.js';
import { BotSettingsScene } from './src/scenes/botSettings.js';
import { TestModeScene } from './src/scenes/testMode.js';
import { QuizPreviewScene } from './src/scenes/quizPreview.js';
import { DevToolsScene } from './src/scenes/devTools.js';

// ตั้งค่า Configuration ของเกม
const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 840,
    parent: 'game-container',
    backgroundColor: '#eaf5e9',
    dom: {
        createContainer: true
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    // กันเกมส์หยุด/ช้าลงเวลาสลับไปแท็บอื่น (ต้องปล่อย AutoPlayBot รันทิ้งไว้เบื้องหลังได้จริง) — ของเดิม Phaser จะ pause loop เองอัตโนมัติเมื่อแท็บไม่ active
    disableVisibilityChange: true, // ปิดพฤติกรรม pause อัตโนมัติตอนแท็บถูกซ่อน (document visibilitychange)
    fps: {
        forceSetTimeOut: true // ใช้ setTimeout แทน requestAnimationFrame เป็นตัวขับ game loop — RAF จะถูกเบราว์เซอร์ throttle/หยุดสนิทตอนแท็บไม่ active แต่ setTimeout ยังทำงานต่อได้ (แค่ช้าลงบ้าง)
    },
    plugins: {
        global: [{
            key: 'rexwebfontloaderplugin',
            plugin: rexwebfontloaderplugin,
            start: true
        }]
    },
    scene: [BootScene, PreloadScene, BaseScene, TitleScene, MapScene, QuizScene, UpgradeScene, BattleListScene, BotSettingsScene, TestModeScene, QuizPreviewScene, DevToolsScene]
};

// เริ่มต้นเกม
const game = new Phaser.Game(config);
window.game = game; // เปิดให้ตรวจสอบ/debug ผ่าน DevTools console ได้ (main.js เป็น ES Module จึงไม่ auto-global)

window.addEventListener('resize', () => {
    setTimeout(() => {
        if (game && game.scale) {
            console.log("delay resize");
            game.scale.refresh();
        }
    }, 300); 
});

window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (game && game.scale) {
            console.log("delay resize");
            game.scale.refresh();
        }
    }, 300);
});