import { SaveManager } from '../systems/SaveManager.js';
import { AutoPlayBot } from '../systems/AutoPlayBot.js';
import { TURRET_TYPES } from '../data/turretTypes.js';
import { ELEMENTS } from '../data/elements.js';
import { getTurretDamage, getTurretShotsPerSecond } from '../systems/turretStats.js';
import { getBaseMaxHp, getBaseRegenPercent as getBaseRegenPercentAtLevel } from '../systems/baseStats.js';
import { FONT_FAMILY, TURRET_COUNT, TURRET_MARGIN_X, BASE_UPGRADE_MAX_LEVEL, TURRET_MAX_LEVEL, SHOW_DEV_TOOLS_GEAR } from '../config/constants.js';

// หน้าฐานทัพหลัก — ดีไซน์ตาม mockup ลูกค้า (2026-09-04, ปรับตำแหน่งรอบสองตามฟีดแบ็กพิกเซลจริง):
// แถบบนสุดสูง 40px, แถวป้อมปืน+ภาพฐานทัพ (สไตล์เดียวกับหน้า Map) บีบให้จบที่ y=360, ต่อด้วยกริดปุ่มอัปเกรด
// 6 ใบ (2 คอลัมน์ x 3 แถว, ป้อม 5 + ฐานทัพ 1) ตั้งแต่ y=360 ถึง y=740 เป็นทางเข้าหลักไปหน้าอัปเกรดของแต่ละอย่าง
// (ดู upgrade.js — รับ data.turretIndex / data.isBase แสดงทีละอย่าง) แตะไอคอนป้อม/ฐานทัพด้านบนก็ไปหน้าเดียวกันได้เหมือนกัน
// (ทางลัดเสริม ไม่ใช่ทางเข้าหลัก) เครื่องมือ dev/QA เดิมย้ายไปซ่อนหลังไอคอน gear มุมขวาบนแล้ว (ดู devTools.js)
export class BaseScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BaseScene' });
    }

    create() {
        // สีพื้นหลังรวมของทั้ง Scene — เห็นได้ทุกจุดที่ไม่มีอะไรมาทับ (เช่นใต้ภาพ gameplay_bg ที่เลื่อนขึ้นไปแล้วไม่คลุมเต็มจอ)
        this.cameras.main.setBackgroundColor('#111b34');

        // พื้นหลังหน้าต่อสู้ (ไฟล์เดียวกับ MapScene, ขนาดเท่าจอพอดี 640x840 ไม่ต้อง scale) วาดก่อนสุดให้อยู่หลังทุกอย่าง
        // ซ้อนอยู่ใต้แถวป้อมปืน/ภาพฐานทัพด้านบน ให้บรรยากาศเดียวกับตอนเล่นจริงใน MapScene
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2-465, 'gameplay_bg');

        // แถบทึบสูง 40px บนสุด — วาดทับขอบบนของภาพพื้นหลังอีกที กันกรณีภาพ gameplay_bg โผล่มาถึงแถบนี้พอดี ให้พื้นหลัง
        // แถบเหรียญ/ไอคอน gear เป็นสีทึบเดียวกับพื้นหลังรวมเสมอ ไม่ปนกับภาพฉาก
        this.add.rectangle(0, 0, this.cameras.main.width, 40, 0x111b34).setOrigin(0, 0);

        this.createTopBar();
        this.createTurretRow();
        this.createBaseIllustration(); // มาส์กปิดขอบล่างของทั้ง gameplay_bg และ research_center อยู่ในนี้แล้ว (ก่อนวาดป้าย Lv.)
        this.createUpgradeGrid();
        this.createBottomRow();

        // ถ้าบอทกำลังทำงานอยู่ (กลับมาที่ Base ระหว่างรอบ) ให้ตัดสินใจก้าวต่อไปทันที ไม่ต้องรอคนกด
        // (สถานะบอทละเอียดๆ ดูได้ใน console/DevToolsScene ถ้าเปิดค้างไว้ — ไม่มี status text บน BaseScene ตรงๆ อีกแล้วหลังดีไซน์ใหม่)
        AutoPlayBot.onBaseSceneReady(this);
    }

    // แถบบนสุดสูง 40px เป๊ะ: Stage (ซ้าย) + เหรียญ (ขวา) + ไอคอน gear (ขวา ใต้แถบนี้) เปิดแผง dev-tools
    // (สลับตำแหน่งเหรียญ<->Stage ตามที่ขอ — เดิมเหรียญซ้าย/Stage ขวา ตอนนี้กลับกัน)
    createTopBar() {
        const screenW = this.cameras.main.width;
        const midY = 20; // กึ่งกลางแถบสูง 40px

        this.add.text(20, midY, `Stage ${SaveManager.getCurrentStage()}`, {
            fontFamily: FONT_FAMILY, fontSize: '19px', fill: '#ffffff'
        }).setOrigin(0, 0.5);

        // สร้างตัวเลขเหรียญก่อนแบบชิดขวา (จำนวนหลักไม่คงที่ ยิ่งเล่นนานเหรียญยิ่งเยอะ) แล้ววางไอคอนอิงความกว้างจริงของตัวเลข
        // กันตัวเลขยาวๆ ล้นขอบจอขวา (ตำแหน่งเดิมตอนเหรียญอยู่ซ้ายไม่มีปัญหานี้เพราะขยายเข้าพื้นที่ว่างตรงกลางแทน)
        const coinAmountText = this.add.text(screenW - 20, midY, `${SaveManager.getCoins()}`, {
            fontFamily: FONT_FAMILY, fontSize: '19px', fill: '#f1c40f', fontStyle: 'bold'
        }).setOrigin(1, 0.5);

        const coinX = coinAmountText.x - coinAmountText.width - 16;
        const coinIcon = this.add.graphics();
        coinIcon.fillStyle(0xf1c40f, 1);
        coinIcon.fillCircle(coinX, midY, 12);
        coinIcon.lineStyle(2, 0xd68910, 1);
        coinIcon.strokeCircle(coinX, midY, 12);
        this.add.text(coinX, midY, '$', { fontFamily: FONT_FAMILY, fontSize: '13px', fill: '#7d5a00', fontStyle: 'bold' }).setOrigin(0.5);

        // ไอคอน gear มุมขวาบน — ยังไม่มีหน้า Settings จริง ใช้เป็นทางเข้าแผง dev-tools ไปก่อน (ดู devTools.js)
        // ปิดได้ทั้งอันด้วย SHOW_DEV_TOOLS_GEAR (constants.js) ก่อนส่งบิลด์ให้ลูกค้า กันเห็น/กดเข้าแผง dev โดยไม่ตั้งใจ
        if (SHOW_DEV_TOOLS_GEAR) {
            const gearX = screenW - 24;
            const gear = this.add.graphics();
            gear.fillStyle(0x7f8c8d, 1);
            gear.fillCircle(gearX, midY+40, 16);
            gear.fillStyle(0x2c3e50, 1);
            gear.fillCircle(gearX, midY+40, 6);
            gear.setInteractive(new Phaser.Geom.Circle(gearX, midY+40, 16), Phaser.Geom.Circle.Contains);
            this.add.text(gearX, midY+40, '⚙', { fontFamily: FONT_FAMILY, fontSize: '25px', fill: '#ffffff' }).setOrigin(0.5);
            gear.on('pointerdown', () => {
                this.scene.pause();
                this.scene.launch('DevToolsScene');
            });
        }
    }

    // แถวไอคอนป้อมปืน 5 กระบอก (สไตล์เดียวกับหน้า Map — บนแท่นเรียงกัน) — ตำแหน่งใช้สูตรเดียวกับที่ MapScene จัดวางป้อมจริง
    // (TURRET_MARGIN_X/TURRET_COUNT) ให้ระยะห่างเห็นสอดคล้องกันทั้งสองหน้า แตะกระบอกไหนไปหน้าอัปเกรดของกระบอกนั้นได้เลย (ทางลัด)
    createTurretRow() {
        const screenW = this.cameras.main.width;
        const y = 120;
        const spacing = (screenW - TURRET_MARGIN_X * 2) / (TURRET_COUNT - 1);
        const iconScale = 1;

        TURRET_TYPES.forEach((type, index) => {
            const x = TURRET_MARGIN_X + index * spacing;

           /* const platform = this.add.graphics();
            platform.fillStyle(0x2c3e50, 0.5);
            platform.fillEllipse(x, y + 40, 62, 16);*/

            const icon = this.add.image(x, y, type.sprite).setScale(iconScale).setInteractive({ useHandCursor: true });
            icon.on('pointerdown', () => this.scene.start('UpgradeScene', { turretIndex: index }));

            /*this.add.text(x, y + 48, `Lv.${SaveManager.getTurretLevel(index)}`, {
                fontFamily: FONT_FAMILY, fontSize: '12px', fill: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);*/
        });
    }

    // ภาพฐานทัพตรงกลางจอ — ใช้ spritesheet research_center เฟรมเดียวกับที่โชว์มุมล่างซ้ายตอนเล่นจริงใน MapScene
    // (5 เฟรม เปลี่ยนตามเลเวลฐานทัพจริง 1-5 -> เฟรม 0-4) บีบเล็กลงให้พอดีพื้นที่ด้านบน (จบที่ y=360) แตะได้เหมือนกัน (ทางลัด)
    createBaseIllustration() {
        const cx = this.cameras.main.width / 2;
        const y = 263;
        const frame = SaveManager.getBaseLevel() - 1;

        const base = this.add.sprite(cx-67, y, 'research_center', frame).setScale(1).setInteractive({ useHandCursor: true });
        base.on('pointerdown', () => this.scene.start('UpgradeScene', { isBase: true }));

        // ปิดทับตั้งแต่ y=340 ลงไปจนสุดจอ ด้วยสีพื้นหลังเดียวกัน (#111b34) — วาดหลังสไปรต์ research_center ตั้งใจให้ทับขอบล่าง
        // ของภาพนี้ด้วย (ไม่ใช่แค่ gameplay_bg) กันโผล่ปนกับโซนกริดปุ่มอัปเกรดที่เริ่ม y=360 แต่วาดก่อนป้าย Lv. ด้านล่างนี้
        // เพื่อไม่ให้บังป้ายไปด้วย (ป้ายอยู่ที่ y=341 พอดีติดขอบ)
        this.add.rectangle(0, 340, this.cameras.main.width, this.cameras.main.height - 340, 0x111b34).setOrigin(0, 0);

        /*this.add.text(cx, y + 78, `Base  Lv.${SaveManager.getBaseLevel()}/${BASE_UPGRADE_MAX_LEVEL}`, {
            fontFamily: FONT_FAMILY, fontSize: '16px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);*/
    }

    // กริดปุ่มอัปเกรด 2 คอลัมน์ x 3 แถว (ป้อม 5 + ฐานทัพ 1) — ทางเข้าหลักไปหน้าอัปเกรดทีละอย่าง (upgrade.js)
    // ย่านพื้นที่ y=360 ถึง y=740 ตามตำแหน่งที่ลูกค้าระบุพิกเซลมาเป๊ะๆ
    createUpgradeGrid() {
        const screenW = this.cameras.main.width;
        const gridTop = 360;
        const gridBottom = 740;
        const margin = 18;
        const colGap = 14;
        const rowGap = 12;
        const cols = 2;
        const rows = 3;
        const cardW = (screenW - margin * 2 - colGap * (cols - 1)) / cols;
        const cardH = (gridBottom - gridTop - rowGap * (rows - 1)) / rows;

        // เรียงซ้าย->ขวา บน->ล่าง: ป้อม 5 กระบอกตามลำดับ TURRET_TYPES ก่อน แล้วฐานทัพเป็นใบสุดท้าย (ตำแหน่ง index 5 = แถวสุดท้ายคอลัมน์ขวา)
        // statLines ใช้ค่าจริงจากสูตรเดียวกับที่ยิง/คำนวณจริงในเกม (turretStats.js/baseStats.js) ไม่ใช่ค่าคงที่ตั้งต้น (สอดคล้องกับหน้า
        // อัปเกรดรายละเอียด upgrade.js ที่ใช้สูตรเดียวกันเป๊ะ) — 属性 (ธาตุ) โชว์ชื่อธาตุตรงๆ ไม่ใช่ตัวเลข
        const items = [
            ...TURRET_TYPES.map((type, index) => {
                const level = SaveManager.getTurretLevel(index);
                return {
                    icon: type.sprite, name: type.nameTh, color: type.color,
                    level, maxLevel: TURRET_MAX_LEVEL,
                    statLines: [
                        `攻撃力　　${getTurretDamage(type, level).toFixed(1)}`,
                        `速射性能　${getTurretShotsPerSecond(type, level).toFixed(2)}/s`,
                        `属性　　　${ELEMENTS[type.element].nameTh}`
                    ],
                    onTap: () => this.scene.start('UpgradeScene', { turretIndex: index })
                };
            }),
            (() => {
                const level = SaveManager.getBaseLevel();
                const regen = getBaseRegenPercentAtLevel(level);
                return {
                    icon: 'research_center', iconFrame: level - 1, isWideIcon: true,
                    name: 'Base', color: 0xbdbdbd,
                    level, maxLevel: BASE_UPGRADE_MAX_LEVEL,
                    statLines: [
                        `耐久力　　${getBaseMaxHp(level)}`,
                        `修復力　　${regen > 0 ? (regen * 100).toFixed(1) + '%/s' : '-'}`
                    ],
                    onTap: () => this.scene.start('UpgradeScene', { isBase: true })
                };
            })()
        ];

        items.forEach((item, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = margin + col * (cardW + colGap);
            const y = gridTop + row * (cardH + rowGap);
            this.createUpgradeCard(x, y, cardW, cardH, item);
        });
    }

    createUpgradeCard(x, y, w, h, item) {
        const panel = this.add.graphics();
        panel.fillStyle(0x2c3e50, 1);
        panel.fillRoundedRect(x, y, w, h, 12);
        panel.setInteractive(new Phaser.Geom.Rectangle(x, y, w, h), Phaser.Geom.Rectangle.Contains);
        panel.on('pointerdown', item.onTap);

        // ชื่อคาดหัวการ์ดเต็มความกว้าง แล้วแบ่ง 2 คอลัมน์ด้านล่าง: ซ้าย = ไอคอน+เลเวล, ขวา = ค่าสถานะจริง (攻撃力/速射性能/属性
        // สำหรับป้อม, 耐久力/修復力 สำหรับฐานทัพ — ดู statLines ที่ createUpgradeGrid()) ตามตำแหน่งที่ขอให้จัดไว้ฝั่งขวาของการ์ด
        this.add.text(x + 12, y + 10, item.name, {
            fontFamily: FONT_FAMILY, fontSize: '14px', fill: '#ffffff', fontStyle: 'bold'
        });

        const iconX = x + 32;
        const iconY = y + h / 2 + 6;
        if (item.isWideIcon) {
            // research_center เป็นภาพแนวนอนยาว (512x220/เฟรม) ใหญ่กว่าไอคอนป้อมมาก — ครอบกลางภาพให้เป็นสี่เหลี่ยมจัตุรัส
            // (ตัดพื้นที่ว่าง/ท่อด้านข้างที่ไม่ใช่ตัวเครื่องออก) แล้วย่อสเกลลงให้พอดีกรอบไอคอนเดียวกับป้อมกระบอกอื่นๆ
            const cropSize = 200; // = ความสูงเต็มของเฟรม (220) — ใช้เป็นด้านสี่เหลี่ยมจัตุรัส
            const cropX = (512 - cropSize) / 2;
            this.add.image(iconX -10, iconY-10, item.icon, item.iconFrame)
                .setCrop(cropX+80, 0, cropSize, cropSize)
                .setScale(0.3);
        } else {
            const iconBg = this.add.graphics();
            iconBg.fillStyle(item.color, 0.35);
            iconBg.fillCircle(iconX, iconY, 25);
            this.add.image(iconX, iconY+10, item.icon).setScale(0.4);
        }
        this.add.text(iconX, iconY + 28, `Lv.${item.level}/${item.maxLevel}`, {
            fontFamily: FONT_FAMILY, fontSize: '12px', fill: '#f39c12', fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        this.add.text(x + w -150, y + 13, item.statLines.join('\n'), {
            fontFamily: FONT_FAMILY, fontSize: '12px', fill: '#bdc3c7', lineSpacing: 6, align: 'left'
        }).setOrigin(0, 0);

        // ป้ายมุมขวาล่างการ์ด — เพิ่มกรอบให้ดูเหมือนปุ่มจริง (เดิมมีแค่ข้อความลอยๆ) วัดขนาดจากตัวข้อความจริงแล้ววาดกรอบ
        // พอดีตัว + padding ทับด้านหลัง (สร้างข้อความก่อนเพื่อวัดขนาด แล้ว bringToTop ให้ลอยเหนือกรอบเสมอ)
        const isMax = item.level >= item.maxLevel;
        const btnLabel = this.add.text(0, 0, isMax ? 'MAX' : '▶ Upgrade', {
            fontFamily: FONT_FAMILY, fontSize: '12px', fill: isMax ? '#bdc3c7' : '#ffffff', fontStyle: 'bold'
        });
        const padX = 10;
        const padY = 6;
        const btnW = btnLabel.width + padX * 2;
        const btnH = btnLabel.height + padY * 2;
        const btnX = x + w - 12 - btnW;
        const btnY = y + h - 12 - btnH;

        const btnFrame = this.add.graphics();
        btnFrame.fillStyle(isMax ? 0x3d4a5a : 0x27ae60, 1);
        btnFrame.fillRoundedRect(btnX, btnY, btnW, btnH, 8);

        btnLabel.setPosition(btnX + padX, btnY + padY);
        this.children.bringToTop(btnLabel);
    }

    // แถวปุ่มล่างสุดของจอ 3 ปุ่มเรียงกัน: Battle List (ซ้าย) / BATTLE START (กลาง) / Simulation Mode (ขวา)
    createBottomRow() {
        const screenW = this.cameras.main.width;
        const y = 765;
        const btnH = 70;
        const margin = 20;
        const gap = 15;
        const btnW = (screenW - margin * 2 - gap * 2) / 3;

        const leftX = margin;
        const centerX = leftX + btnW + gap;
        const rightX = centerX + btnW + gap;

        this.createBottomButton(leftX, y, btnW, btnH, 0x9b59b6, '過去の戦闘リスト', () => {
            this.scene.start('BattleListScene');
        });

        this.createBottomButton(centerX, y, btnW, btnH, 0xe74c3c, '戦闘開始', () => {
            this.scene.start('MapScene', { stage: SaveManager.getCurrentStage(), channel: 'battleStart' });
        });

        this.createBottomButton(rightX, y, btnW, btnH, 0xf39c12, 'シミュレーション', () => {
            this.scene.start('MapScene', { stage: SaveManager.getCurrentStage(), infinite: true, channel: 'simulation' });
        });

        // High Score โหมดจำลอง (Stage ไกลสุดที่เคยไปถึง) — โชว์เหนือปุ่มเป็นเป้าหมายให้ทำลายสถิติ ไม่แสดงถ้ายังไม่เคยเล่นเลย
        const bestStage = SaveManager.getBestSimulationStage();
        if (bestStage > 0) {
            this.add.text(rightX + btnW / 2, y - 20, `Best: Stage ${bestStage}`, {
                fontFamily: FONT_FAMILY, fontSize: '16px',
                fill: '#f39c12',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }
    }

    createBottomButton(x, y, w, h, color, label, onClick) {
        const gfx = this.add.graphics();
        gfx.fillStyle(color, 1);
        gfx.fillRoundedRect(x, y, w, h, 16);
        gfx.setInteractive(new Phaser.Geom.Rectangle(x, y, w, h), Phaser.Geom.Rectangle.Contains);

        this.add.text(x + w / 2, y + h / 2, label, {
            fontFamily: FONT_FAMILY, fontSize: '18px',
            fill: '#ffffff',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: w - 16 }
        }).setOrigin(0.5);

        // ใช้ pointerup ไม่ใช่ pointerdown: ถ้าสลับ Scene ทันทีตอนกดลง (pointerdown) ขณะที่นิ้ว/เมาส์ยังกดค้างอยู่ Scene ใหม่
        // (เช่น BattleListScene) จะถูกสร้างขึ้นมาระหว่างที่ pointer ยังไม่ปล่อย พอปล่อยนิ้วจริง Phaser จะ hit-test ใหม่กับ Scene
        // ใหม่ตรงตำแหน่งที่ปล่อย ทำให้ไปโดนปุ่ม/แถวของ Scene ใหม่โดยไม่ตั้งใจ (บั๊กที่เจอจริง: กดปุ่ม 過去の戦闘リスト ค้างไว้
        // จะเข้าหน้า Battle History ทันที แล้วพอปล่อยนิ้วดันไปเลือก Stage ที่ตรงตำแหน่งปล่อยแทน) — trigger ตอนปล่อย (pointerup)
        // แทน ทำให้ Scene สลับหลังจากที่ pointer gesture นี้จบไปแล้วจริงๆ ไม่มี event ค้างไปโดน Scene ใหม่อีก
        gfx.on('pointerup', onClick);
    }
}
