import { SaveManager } from '../systems/SaveManager.js';
import { STAGE_CONFIG } from '../data/stages.js';
import { FONT_FAMILY } from '../config/constants.js';

// ประวัติการรบ: เลือกเล่นด่านที่เคยเคลียร์ไปแล้วซ้ำได้ — ไม่มี field แยกเก็บ "ด่านที่เคลียร์แล้ว" เพราะโปรเกรสเป็นเส้นตรงเสมอ
// (currentStage เลื่อนขึ้นเฉพาะตอนเคลียร์จริงเท่านั้น — ดู MapScene.onStageClear()) จึงสรุปได้ว่าด่าน 1..currentStage-1 เคลียร์แล้วทั้งหมด
export class BattleListScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleListScene' });
    }

    create() {
        const screenW = this.cameras.main.width;
        const cx = screenW / 2;

        this.cameras.main.setBackgroundColor('#2c3e50');

        this.createTopBar();

        const maxReplayable = Math.min(SaveManager.getCurrentStage() - 1, STAGE_CONFIG.length);

        if (maxReplayable < 1) {
            this.add.text(cx, 200, 'No stages cleared yet', {
                fontFamily: FONT_FAMILY, fontSize: '22px',
                fill: '#bdc3c7'
            }).setOrigin(0.5);
        } else {
            this.createStageList(cx, maxReplayable);
        }
    }

    // แถบบนสุด: ปุ่มย้อนกลับ 戻る (ซ้าย) + เหรียญ (ขวา) — สไตล์/ตำแหน่งเดียวกับ upgrade.js createTopBar เป๊ะ
    createTopBar() {
        const screenW = this.cameras.main.width;

        const backBtn = this.add.graphics();
        backBtn.fillStyle(0x7f8c8d, 1);
        backBtn.fillRoundedRect(20, 12, 70, 40, 10);
        backBtn.setInteractive(new Phaser.Geom.Rectangle(20, 12, 70, 40), Phaser.Geom.Rectangle.Contains);
        this.add.text(55, 32, '← 戻る', { fontFamily: FONT_FAMILY, fontSize: '14px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        backBtn.on('pointerdown', () => this.scene.start('BaseScene'));

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

    // ลิสต์ Stage ที่เคลียร์แล้ว เรียงจากบนลงล่าง "ล่าสุดอยู่บนสุด" (Stage เลขสูงสุด -> ต่ำสุด) โชว์สูงสุด 10 แถวพอดีจอ
    // (ไม่ต้องเลื่อน) ถ้าเกิน 10 ลากเลื่อนดูด่านเก่ากว่าด้านล่างได้ — ใช้แพทเทิร์นเดียวกับลิสต์เลเวลอัปเกรด (mask + container + ลากเลื่อน)
    // มี momentum/easing ตอนลากเหมือนหน้า quiz (ดู quizRender.js placeScrollableImage) ดู upgrade.js createTierList
    // ขอบขวาของแต่ละแถวโชว์สถิติ % ความเสียหายฐานที่ต่ำที่สุดเท่าที่เคยทำได้ตอนเคลียร์ด่านนั้น (SaveManager.recordStageClear
    // อัปเดตให้เองทุกครั้งที่เคลียร์ ไม่ว่าจะเล่นด่านใหม่หรือเล่นซ้ำจากหน้านี้ — เก็บเฉพาะสถิติที่ดีกว่าเดิม) — 0% คือดีที่สุด
    createStageList(cx, maxReplayable) {
        const screenH = this.cameras.main.height;
        const rowW = 400;
        const gap = 10;
        const rowX = cx - rowW / 2;
        const visibleRows = 10;

        const listY = 56;
        const listH = this.cameras.main.height - listY - 20;
        const rowH = Math.floor((listH - (visibleRows - 1) * gap) / visibleRows);

        const maskShape = this.make.graphics();
        maskShape.fillRect(rowX, listY, rowW, listH);

        const container = this.add.container(0, listY);
        container.setMask(maskShape.createGeometryMask());

        // ระยะทางที่ลากไปแล้วสะสม (px) ใช้แยกว่าเป็นการแตะเลือกด่าน (tap) หรือการลากเลื่อนดูรายการ (scroll)
        // ต้องประกาศไว้ก่อนลูปสร้างแถว เพราะปุ่มแต่ละแถว (closure ด้านล่าง) ต้องอ่านค่านี้ตอนปล่อยนิ้ว
        let dragDistance = 0;
        const TAP_MOVE_THRESHOLD = 8; // ลากไม่เกินนี้ = ถือว่าเป็นการแตะเลือกด่านจริง ไม่ใช่ลากเลื่อน

        for (let i = 0; i < maxReplayable; i++) {
            const stage = maxReplayable - i; // เรียงมาก->น้อย เพราะ Stage ล่าสุดที่เคลียร์ต้องอยู่บนสุด
            const y = i * (rowH + gap);

            const gfx = this.add.graphics();
            gfx.fillStyle(0x3498db, 1);
            gfx.fillRoundedRect(rowX, y, rowW, rowH, 12);
            gfx.setInteractive(new Phaser.Geom.Rectangle(rowX, y, rowW, rowH), Phaser.Geom.Rectangle.Contains);
            container.add(gfx);

            container.add(this.add.text(rowX + 20, y + rowH / 2, `Stage ${stage}`, {
                fontFamily: FONT_FAMILY, fontSize: '20px',
                fill: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0, 0.5));

            const record = SaveManager.getStageRecord(stage);
            const dmgText = record === undefined ? '-' : `${record}%`;
            container.add(this.add.text(rowX + rowW - 20, y + rowH / 2, dmgText, {
                fontFamily: FONT_FAMILY, fontSize: '18px',
                fill: this.damageColor(record),
                fontStyle: 'bold'
            }).setOrigin(1, 0.5));

            // ใช้ pointerup (ไม่ใช่ pointerdown) + เช็ค dragDistance กันชนกับการลากเลื่อนรายการ (ดูคอมเมนต์ TAP_MOVE_THRESHOLD ด้านบน)
            gfx.on('pointerup', () => {
                if (dragDistance < TAP_MOVE_THRESHOLD) {
                    this.scene.start('MapScene', { stage, channel: 'battleList' });
                }
            });
        }

        const totalContentH = maxReplayable * (rowH + gap) - gap;
        if (totalContentH <= listH) return; // ไม่เกิน 10 แถว ไม่ต้องลากเลื่อน

        // ขอบเขตตำแหน่ง container.y จริง (ไม่ใช่ offset): maxY = บนสุด (โชว์ด่านล่าสุด), minY = ล่างสุด (โชว์ด่าน 1)
        const maxY = listY;
        const minY = listY - (totalContentH - listH);

        // จับ pointerdown/move ระดับ scene ตรงๆ (ไม่ใช้ Zone.setInteractive) เพราะ Zone ที่วางทับแถวทั้งหมดจะไปกันไม่ให้
        // click ทะลุถึงปุ่มแต่ละแถวได้เลย (Phaser input.topOnly=true ค่าเริ่มต้น — object บนสุดที่ถูก hit เท่านั้นที่ได้ event
        // ทำให้ปุ่มเลือก stage กดไม่ติดเลยสักปุ่ม) — pointerdown/move/up ระดับ scene ไม่ผ่าน hit-test แบบนั้น จึงไม่ชนกัน
        const withinList = (pointer) => pointer.y >= listY && pointer.y <= listY + listH && pointer.x >= rowX && pointer.x <= rowX + rowW;

        let isDragging = false;
        let dragStartY = 0;
        let containerStartY = 0;
        let coastVelocity = 0; // px/วินาที ที่ยังไถลต่อเนื่องอยู่หลังปล่อยมือ (แรงเสียดทานหน่วงให้ช้าลงเรื่อยๆ ใน onUpdate ด้านล่าง) — เลียนแบบ quizRender.js placeScrollableImage

        const onDown = (pointer) => {
            if (!withinList(pointer)) return;
            coastVelocity = 0; // จับใหม่ระหว่างไถลอยู่ -> หยุดไถลทันที
            isDragging = true;
            dragStartY = pointer.y;
            containerStartY = container.y;
            dragDistance = 0;
        };
        const onMove = (pointer) => {
            if (!isDragging) return;
            const delta = pointer.y - dragStartY;
            dragDistance = Math.max(dragDistance, Math.abs(delta));
            container.y = Phaser.Math.Clamp(containerStartY + delta, minY, maxY);
        };
        const onUp = (pointer) => {
            if (isDragging) {
                isDragging = false;
                const velocity = pointer.velocity.y;
                if (Math.abs(velocity) > 40) coastVelocity = velocity;
            }
        };

        const FRICTION_PER_SEC = 0.05;
        const onUpdate = (time, delta) => {
            if (coastVelocity === 0) return;
            const dt = delta / 1000;
            const next = container.y + coastVelocity * dt;
            if (next <= minY || next >= maxY) {
                container.y = Phaser.Math.Clamp(next, minY, maxY);
                coastVelocity = 0; // ชนขอบจริง -> หยุดไถลทันที ไม่เด้งกลับ
            } else {
                container.y = next;
                coastVelocity *= Math.pow(FRICTION_PER_SEC, dt);
                if (Math.abs(coastVelocity) < 10) coastVelocity = 0;
            }
        };

        this.input.on('pointerdown', onDown);
        this.input.on('pointermove', onMove);
        this.input.on('pointerup', onUp);
        this.input.on('pointerupoutside', onUp);
        this.events.on('update', onUpdate);
        container.once('destroy', () => {
            this.input.off('pointerdown', onDown);
            this.input.off('pointermove', onMove);
            this.input.off('pointerup', onUp);
            this.input.off('pointerupoutside', onUp);
            this.events.off('update', onUpdate);
        });
    }

    // สีของสถิติ % เสียหาย — 0% (ดีที่สุด) เขียว, เสียหายปานกลางเหลือง, เสียหายเยอะแดง, ยังไม่มีสถิติ (save เก่า) เทา
    damageColor(percent) {
        if (percent === undefined) return '#7f8c8d';
        if (percent <= 0) return '#2ecc71';
        if (percent <= 30) return '#f1c40f';
        return '#e74c3c';
    }
}
