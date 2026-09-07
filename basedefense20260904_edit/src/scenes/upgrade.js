import { SaveManager } from '../systems/SaveManager.js';
import { TestLogger } from '../systems/TestLogger.js';
import { requestQuizGate } from '../systems/QuizGate.js';
import { TURRET_TYPES } from '../data/turretTypes.js';
import { ELEMENTS } from '../data/elements.js';
import { getTurretDamage, getTurretShotsPerSecond } from '../systems/turretStats.js';
import { getBaseMaxHp, getBaseRegenPercent as getBaseRegenPercentAtLevel } from '../systems/baseStats.js';
import {
    TURRET_MAX_LEVEL,
    BASE_UPGRADE_MAX_LEVEL,
    UPGRADE_COST_BY_LEVEL,
    BASE_HP_REGEN_UNLOCK_LEVEL,
    FONT_FAMILY
} from '../config/constants.js';

// หน้าอัปเกรดของ "1 อย่าง" (ป้อมปืน 1 กระบอก หรือ ฐานทัพ 1) — เปิดจาก BaseScene ตอนแตะไอคอนป้อม/ฐานทัพโดยตรง
// รับ data.turretIndex (0-4) หรือ data.isBase (ดู BaseScene.createTurretRow/createBaseIllustration)
// ดีไซน์ใหม่ตาม mockup ลูกค้า 2026-09-04 — เดิมหน้านี้โชว์ทุกแถว 6 แถวพร้อมกัน ตอนนี้แยกเป็นคนละหน้าต่ออย่าง หัวหน้าจอโชว์ไอคอน/ชื่อ/
// จุดเด่น + ค่าสถานะจริง ณ เลเวลปัจจุบัน (攻撃力/速射性能/属性 หรือ 耐久力/修復力) ต่อด้วยแถบเลื่อนได้โชว์ทุกเลเวล Lv.1-maxLevel ในที่เดียว:
// เลเวลที่อัปแล้วมีป้าย ✓強化済み แทนปุ่ม, เลเวลถัดไปจริงกดอัปได้, เลเวลไกลกว่านั้นล็อกไว้ก่อน ต้องอัปตามลำดับ (ดู handleUpgradeClick)
export class UpgradeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UpgradeScene' });
    }

    create(data) {
        this.cameras.main.setBackgroundColor('#1a2438');
        this.sceneData = data; // เก็บไว้เผื่อ restart ตัวเองซ้ำหลังอัปเกรดสำเร็จ (ดู handleUpgradeClick)
        this.config = data.isBase ? this.buildBaseConfig() : this.buildTurretConfig(data.turretIndex);

        this.createTopBar();
        this.createHeader();
        this.createTierList();
    }

    buildTurretConfig(index) {
        const type = TURRET_TYPES[index];
        return {
            spriteKey: type.sprite,
            frame: undefined,
            headerIconScale: 1, // ป้อมโชว์เต็มขนาดจริง (100%) บนหัวหน้าอัปเกรด
            headerNameOffset: -40, // ภาพป้อมมีขอบโปร่งใสเหลือเยอะด้านล่างเฟรม ดึงชื่อขึ้นชิดตัวป้อมจริงมากกว่าคำนวณจาก displayHeight เฉยๆ
            name: type.nameTh,
            focusLabel: type.upgrade.focusLabel,
            logLabel: type.id,
            getLevel: () => SaveManager.getTurretLevel(index),
            maxLevel: TURRET_MAX_LEVEL,
            getCost: (level) => UPGRADE_COST_BY_LEVEL[level - 1],
            onUpgrade: (nextLevel) => SaveManager.setTurretLevel(index, nextLevel),
            // ค่าสถานะจริง ณ เลเวลที่ระบุ (สูตรเดียวกับที่ MapScene ใช้ยิงจริง — ดู src/systems/turretStats.js) — label ญี่ปุ่น
            // ให้ตรงกับที่ใช้ในการ์ดกริดหน้า Base แล้ว (攻撃力/速射性能/属性) เพื่อความสอดคล้องกันทั้งสองหน้า
            getStatLines: (level) => [
                `攻撃力　　${getTurretDamage(type, level).toFixed(1)}`,
                `速射性能　${getTurretShotsPerSecond(type, level).toFixed(2)}/s`,
                `属性　　　${ELEMENTS[type.element].nameTh}`
            ],
            // ผลลัพธ์จริงถ้าอัปจาก level -> level+1 (สูตร backloaded ทำให้ % ต่อขั้นไม่เท่ากันทุกเลเวล ต้องคำนวณจริงไม่ใช่ค่าคงที่)
            getPreviewLines: (level) => {
                const next = level + 1;
                const atkPct = Math.round((getTurretDamage(type, next) / getTurretDamage(type, level) - 1) * 100);
                const ratePct = Math.round((getTurretShotsPerSecond(type, next) / getTurretShotsPerSecond(type, level) - 1) * 100);
                const lines = [`ATK +${atkPct}%`, `Rate +${ratePct}%`];
                const u = type.upgrade;
                if (u.bulletCountByLevel) {
                    const delta = u.bulletCountByLevel[level] - u.bulletCountByLevel[level - 1];
                    if (delta > 0) lines.push(`Bullet +${delta}`);
                }
                return lines;
            }
        };
    }

    buildBaseConfig() {
        return {
            spriteKey: 'research_center',
            frame: () => SaveManager.getBaseLevel() - 1, // ฐานทัพโชว์เฟรมตามเลเวลปัจจุบันจริง (ไม่ใช่เลเวลที่กำลังพรีวิว) เหมือนที่อื่นในเกม
            headerIconScale: 0.6, // research_center เป็นภาพแนวนอนยาว (512x220) ใหญ่กว่าป้อมมาก เต็ม 100% จะล้นหัวหน้าจอ คงสเกลเดิมไว้
            headerNameOffset: 0, // ภาพนี้ไม่มีขอบโปร่งใสเหลือเยอะแบบป้อม ไม่ต้องดึงชื่อขึ้นชดเชยเหมือนกัน
            name: 'Base',
            focusLabel: null,
            logLabel: 'base',
            getLevel: () => SaveManager.getBaseLevel(),
            maxLevel: BASE_UPGRADE_MAX_LEVEL,
            getCost: (level) => UPGRADE_COST_BY_LEVEL[level - 1],
            onUpgrade: (nextLevel) => SaveManager.setBaseLevel(nextLevel),
            getStatLines: (level) => {
                const regen = getBaseRegenPercentAtLevel(level);
                const lines = [`耐久力　　${getBaseMaxHp(level)}`];
                lines.push(`修復力　　${regen > 0 ? (regen * 100).toFixed(1) + '%/s' : '-'}`);
                return lines;
            },
            getPreviewLines: (level) => {
                const next = level + 1;
                const nextRegen = getBaseRegenPercentAtLevel(next);
                const lines = [`HP +${getBaseMaxHp(next) - getBaseMaxHp(level)}`];
                if (next === BASE_HP_REGEN_UNLOCK_LEVEL) lines.push('Regen Unlocked!');
                else if (nextRegen > 0) lines.push(`Regen ${(nextRegen * 100).toFixed(1)}%/s`);
                return lines;
            }
        };
    }

    // แถบบนสุด: ปุ่มย้อนกลับ 戻る (ซ้าย) + เหรียญ (ขวา)
    createTopBar() {
        const screenW = this.cameras.main.width;

        const backBtn = this.add.graphics();
        backBtn.fillStyle(0x7f8c8d, 1);
        backBtn.fillRoundedRect(20, 12, 70, 40, 10);
        backBtn.setInteractive(new Phaser.Geom.Rectangle(20, 12, 70, 40), Phaser.Geom.Rectangle.Contains);
        this.add.text(55, 32, '← 戻る', { fontFamily: FONT_FAMILY, fontSize: '14px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        backBtn.on('pointerdown', () => this.scene.start('BaseScene'));

        // ไอคอน + ตัวเลขเหรียญ ตำแหน่ง/สไตล์เดียวกับหน้า Base เป๊ะ (ดู BaseScene.createTopBar — midY=20 ไม่ใช่กึ่งกลางปุ่ม Back
        // ที่ 32 เพราะแถบบนสุดของเกมกำหนดสูง 40px คงที่ทุกหน้า) วางไอคอนก่อนโดยอิงความกว้างจริงของตัวเลขกันล้นขอบจอขวา
        const midY = 20;
        this.coinsText = this.add.text(screenW - 20, midY, `${SaveManager.getCoins()}`, {
            fontFamily: FONT_FAMILY, fontSize: '19px', fill: '#f1c40f', fontStyle: 'bold'
        }).setOrigin(1, 0.5);

        const coinX = this.coinsText.x - this.coinsText.width - 16;
        const coinIcon = this.add.graphics();
        coinIcon.fillStyle(0xf1c40f, 1);
        coinIcon.fillCircle(coinX, midY, 12);
        coinIcon.lineStyle(2, 0xd68910, 1);
        coinIcon.strokeCircle(coinX, midY, 12);
        this.add.text(coinX, midY, '$', { fontFamily: FONT_FAMILY, fontSize: '13px', fill: '#7d5a00', fontStyle: 'bold' }).setOrigin(0.5);
    }

    // ส่วนหัว: ไอคอนใหญ่ + ชื่อ + จุดเด่นของสายอัปเกรดนี้ (ถ้ามี) + ค่าสถานะจริงของป้อม/ฐานทัพ ณ เลเวลปัจจุบัน
    // (攻撃力/速射性能/属性 สำหรับป้อม, 耐久力/修復力 สำหรับฐานทัพ — ดู getStatLines ที่ buildTurretConfig/buildBaseConfig)
    createHeader() {
        const cx = this.cameras.main.width / 2;
        const y = 110;

        const frame = typeof this.config.frame === 'function' ? this.config.frame() : this.config.frame;
        const icon = this.add.sprite(cx, y, this.config.spriteKey, frame).setScale(this.config.headerIconScale);

        // ระยะห่างจากไอคอนถึงชื่อคำนวณจากความสูงจริงของไอคอนหลังสเกล (ไม่ใช่ค่าคงที่ตายตัว) เพราะป้อม (สเกล 100%) กับ
        // research_center (สเกล 0.6) มีสัดส่วนต่างกันมาก ค่าคงที่เดิมจะทับกันพอดีตอนไอคอนสูงขึ้น — headerNameOffset ชดเชยขอบ
        // โปร่งใสที่เหลือต่างกันของแต่ละภาพ (ป้อม -40, ฐานทัพ 0 — ดู buildTurretConfig/buildBaseConfig)
        const nameY = y + icon.displayHeight / 2 + 12 + this.config.headerNameOffset;
        this.add.text(cx, nameY, this.config.name, {
            fontFamily: FONT_FAMILY, fontSize: '22px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        let infoY = nameY + 28;
        if (this.config.focusLabel) {
            this.add.text(cx, infoY, this.config.focusLabel, {
                fontFamily: FONT_FAMILY, fontSize: '13px', fill: '#95a5a6'
            }).setOrigin(0.5);
            infoY += 22;
        }

        const level = this.config.getLevel();
        this.add.text(cx, infoY, `Lv.${level}/${this.config.maxLevel}`, {
            fontFamily: FONT_FAMILY, fontSize: '15px', fill: '#f39c12', fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        const statLines = this.config.getStatLines(level);
        this.add.text(cx, infoY + 24, statLines.join('   '), {
            fontFamily: FONT_FAMILY, fontSize: '13px', fill: '#ffffff', fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5, 0);
    }

    // ลิสต์เลื่อนได้ของเลเวลที่เหลือ (level+1 .. maxLevel) — ใบแรกสุด (เลเวลถัดไปจริง) กดอัปได้ ใบอื่นล็อกไว้ก่อน
    // ใช้แพทเทิร์นเดียวกับป๊อปอัปคำอธิบาย quiz (mask + container + ลากเลื่อน) ดู quizRender.js showExplanationPopup
    // แสดงทุกเลเวลตั้งแต่ Lv.1 ถึง maxLevel เป็นแถบเดียว (ไม่ใช่แค่เลเวลที่เหลือแบบเดิม) — เลเวลที่อัปแล้วโชว์ป้าย 強化済み
    // แทนปุ่ม เลเวลถัดไปจริงกดอัปได้ ที่เหลือล็อกไว้ก่อน
    createTierList() {
        const screenW = this.cameras.main.width;
        const listX = 20;
        const listY = 290; // เลื่อนขึ้นจาก 330 กันเนื้อหา Lv.5 (5 การ์ด) โดนตัดที่ขอบล่างจอ
        const listW = screenW - 40;
        const listH = this.cameras.main.height - listY - 12;

        const maskShape = this.make.graphics();
        maskShape.fillRect(listX, listY, listW, listH);

        const container = this.add.container(listX, listY);
        container.setMask(maskShape.createGeometryMask());

        const level = this.config.getLevel();
        const cardH = 92;
        const gap = 14;
        let cursorY = 0;

        for (let targetLevel = 1; targetLevel <= this.config.maxLevel; targetLevel++) {
            const state = targetLevel <= level ? 'done' : targetLevel === level + 1 ? 'next' : 'locked';
            const card = this.buildTierCard(listW, cardH, targetLevel, state);
            card.y = cursorY;
            container.add(card);
            cursorY += cardH + gap;
        }
        const totalContentH = Math.max(0, cursorY - gap);

        if (totalContentH <= listH) return; // ทุกใบพอดีในจอ ไม่ต้องลากเลื่อน

        const minY = listY - (totalContentH - listH);
        const maxY = listY;

        // จับ pointerdown/move ระดับ scene ตรงๆ (ไม่ใช้ Zone.setInteractive) เพราะ Zone ที่วางทับการ์ดทั้งหมดจะไปกันไม่ให้
        // click ทะลุถึงปุ่มซื้อของแต่ละการ์ดได้เลย (Phaser input.topOnly=true ค่าเริ่มต้น — object บนสุดที่ถูก hit เท่านั้นที่ได้
        // event) — ปัจจุบัน list นี้ไม่เคยล้นจอจริง (maxLevel สูงสุด 5 พอดีจอเสมอ) โค้ดส่วนนี้เลยไม่เคยถูกเรียกใช้งานจริง แต่กันไว้
        // เผื่ออนาคตเพิ่ม maxLevel แล้วล้น — ดู bug เดียวกันที่เจอจริงใน battleList.js createStageList
        const withinList = (pointer) => pointer.y >= listY && pointer.y <= listY + listH && pointer.x >= listX && pointer.x <= listX + listW;

        let isDragging = false;
        let dragStartY = 0;
        let containerStartY = 0;
        const onDown = (pointer) => {
            if (!withinList(pointer)) return;
            isDragging = true;
            dragStartY = pointer.y;
            containerStartY = container.y;
        };
        const onMove = (pointer) => {
            if (!isDragging) return;
            container.y = Phaser.Math.Clamp(containerStartY + (pointer.y - dragStartY), minY, maxY);
        };
        const onUp = () => { isDragging = false; };
        this.input.on('pointerdown', onDown);
        this.input.on('pointermove', onMove);
        this.input.on('pointerup', onUp);
        this.input.on('pointerupoutside', onUp);
        container.once('destroy', () => {
            this.input.off('pointerdown', onDown);
            this.input.off('pointermove', onMove);
            this.input.off('pointerup', onUp);
            this.input.off('pointerupoutside', onUp);
        });
    }

    // การ์ด 1 ใบต่อ 1 เลเวล — state: 'done' (อัปแล้ว โชว์ค่าจริงที่เลเวลนั้น + ป้าย 強化済み มุมขวา ไม่มีปุ่ม),
    // 'next' (เลเวลถัดไปจริง กดอัปได้ถ้าเหรียญพอ), 'locked' (ไกลกว่านั้น โชว์พรีวิวจางๆ กดไม่ได้ ต้องอัปตามลำดับ)
    buildTierCard(cardW, cardH, targetLevel, state) {
        const level = targetLevel - 1;
        const isNext = state === 'next';
        const isDone = state === 'done';

        const container = this.add.container(0, 0);

        const panel = this.add.graphics();
        panel.fillStyle(isNext ? 0x34495e : isDone ? 0x27384a : 0x25303e, 1);
        panel.fillRoundedRect(0, 0, cardW, cardH, 10);
        container.add(panel);

        container.add(this.add.text(18, 16, `Lv.${targetLevel}`, {
            fontFamily: FONT_FAMILY, fontSize: '17px', fill: isNext ? '#ffffff' : isDone ? '#f39c12' : '#7f8c8d', fontStyle: 'bold'
        }));

        if (isDone) {
            // อัปแล้ว — โชว์ค่าสถานะจริงที่ทำได้ ณ เลเวลนี้ (ไม่ใช่พรีวิว) แทนบรรทัดพรีวิว
            container.add(this.add.text(18, 44, this.config.getStatLines(targetLevel).join('   '), {
                fontFamily: FONT_FAMILY, fontSize: '13px', fill: '#95a5a6', fontStyle: 'bold'
            }));
        } else {
            const previewLines = this.config.getPreviewLines(level);
            container.add(this.add.text(18, 44, previewLines.join('   '), {
                fontFamily: FONT_FAMILY, fontSize: '14px', fill: isNext ? '#2ecc71' : '#5d6d7c', fontStyle: 'bold'
            }));
        }

        const btnW = 130;
        const btnH = 56;
        const btnX = cardW - btnW - 14;
        const btnY = (cardH - btnH) / 2;
        const btnGfx = this.add.graphics();

        if (isDone) {
            // อัปแล้ว — ป้าย 強化済み มุมขวา (ขอบด้านขวาของการ์ด) แทนที่ปุ่มซื้อ ไม่ต้องกดอะไรได้อีก
            btnGfx.fillStyle(0x1e824c, 1);
            btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
            container.add(btnGfx);
            container.add(this.add.text(btnX + btnW / 2, btnY + btnH / 2, '✓ 強化済み', {
                fontFamily: FONT_FAMILY, fontSize: '13px', fill: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5));
            return container;
        }

        if (!isNext) {
            // เลเวลไกลกว่าเลเวลถัดไป — ล็อกไว้ก่อน โชว์เฉยๆ กดไม่ได้ ต้องอัปตามลำดับ
            btnGfx.fillStyle(0x3d4a5a, 1);
            btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
            container.add(btnGfx);
            container.add(this.add.text(btnX + btnW / 2, btnY + btnH / 2, '🔒 Locked', {
                fontFamily: FONT_FAMILY, fontSize: '13px', fill: '#7f8c8d', fontStyle: 'bold'
            }).setOrigin(0.5));
            return container;
        }

        const cost = this.config.getCost(level);
        const affordable = SaveManager.getCoins() >= cost;
        btnGfx.fillStyle(affordable ? 0x2ecc71 : 0x7f8c8d, 1);
        btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
        btnGfx.setInteractive(new Phaser.Geom.Rectangle(btnX, btnY, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        container.add(btnGfx);
        container.add(this.add.text(btnX + btnW / 2, btnY + btnH / 2, `${cost} coins`, {
            fontFamily: FONT_FAMILY, fontSize: '15px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));

        btnGfx.on('pointerdown', () => this.handleUpgradeClick(level, cost));

        return container;
    }

    // กดปุ่มอัปเกรด: เช็คเหรียญพอก่อน (ยังไม่หักเงิน) แล้วต้องตอบคำถามให้ถูกก่อน (ดู QuizGate) ถึงจะหักเหรียญ + เพิ่มเลเวลจริง
    // ตอบผิดไม่เสียเหรียญ กดปุ่มเดิมลองใหม่ได้ — รีสตาร์ท Scene เดิมทั้งหน้าหลังอัปสำเร็จ ให้การ์ดปัจจุบัน/ลิสต์ที่เหลือรีเฟรชครบ
    handleUpgradeClick(level, cost) {
        if (SaveManager.getCoins() < cost) return; // เหรียญไม่พอ

        requestQuizGate(this, 'base', () => {
            if (!SaveManager.spendCoins(cost)) return; // กันเคส edge เผื่อเหรียญเปลี่ยนไประหว่างตอบคำถาม
            this.config.onUpgrade(level + 1);
            TestLogger.recordUpgrade(this.config.logLabel, level + 1, cost, SaveManager.getCoins()); // เก็บ Log ไว้วิเคราะห์สมดุล ไม่มีผลต่อเกม
            this.scene.restart(this.sceneData);
        });
    }
}
