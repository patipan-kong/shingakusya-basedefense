// บอทเล่นเกมเองอัตโนมัติ ตั้งแต่ Stage 1 จนจบเกม (หรือจนกว่าจะติดด่านใดด่านหนึ่งเกิน MAX_ATTEMPTS_PER_STAGE ครั้ง)
// วนรันหลายโปรไฟล์ (กลยุทธ์อัพเกรด x นโยบายสกิล) ต่อกันในคิวเดียว แต่ละโปรไฟล์เริ่มจาก SaveManager.reset() เสมอ
// เพื่อไม่ให้ผลของโปรไฟล์ก่อนหน้าปนกัน — จบคิวแล้ว export CSV รวมทุกโปรไฟล์ให้อัตโนมัติ (ดู BaseScene.exportTestLog())
//
// ไม่มี LLM เกี่ยวข้องระหว่างเล่นเลย — เรียก method จริงของแต่ละ Scene ตรงๆ (onSkillSlotTap/...) เท่าที่ยังต้องผ่าน UI จริง
// ส่วนการซื้ออัพเกรด (spendGold) เรียก SaveManager ตรงๆ ไม่ผ่านหน้า UpgradeScene แล้ว (ดูคอมเมนต์ที่ spendGold ด้านล่าง)
import { SaveManager } from './SaveManager.js';
import { TestLogger } from './TestLogger.js';
import { TURRET_TYPES } from '../data/turretTypes.js';
import { TURRET_MAX_LEVEL, BASE_UPGRADE_MAX_LEVEL, UPGRADE_COST_BY_LEVEL } from '../config/constants.js';

const MAX_ATTEMPTS_PER_STAGE = 25; // อ้างอิงจากเคสที่แย่ที่สุดที่เคยเจอจริงในโปรเจกต์นี้ (สาย specialize ติด 24 รอบ)
// วงจรป้องกันเผื่อหลุด loop ที่ไม่คาดคิด ไม่ผูกกับ logic รายด่าน — ต้องตั้งสูงกว่าที่การรันจริงทั้งหมดจะใช้จริงมากๆ ไม่ใช่ตัดจบงานปกติ
// เพดานตามทฤษฎีถ้าทุกโปรไฟล์แย่สุดจริง (ติด MAX_ATTEMPTS_PER_STAGE ทุก stage) = 9 โปรไฟล์ x 50 stage x 25 ครั้ง = 11250 (เกิน 6000 ปัจจุบัน)
// แต่ผลจริงในทางปฏิบัติต่ำกว่านั้นมาก (เทส 24 โปรไฟล์เดิมจริงใช้ไปแค่ 1220 ศึกรวม) ยังไม่เคยชนเพดานนี้จริง — ถ้าจะรันชุดใหญ่/โปรไฟล์แย่ผิดปกติในอนาคต ควรพิจารณาปรับขึ้น
const MAX_TOTAL_BATTLES = 6000;

export const AutoPlayBot = {
    isActive: false,
    queue: [],
    queueIndex: 0,
    attemptsOnCurrentStage: 0,
    totalBattles: 0,

    // เริ่มบอท — queue คือ [{upgradeStrategy, skillPolicy}, ...] (มาจาก BotSettingsScene)
    start(queue) {
        this.queue = queue;
        this.queueIndex = 0;
        this.attemptsOnCurrentStage = 0;
        this.totalBattles = 0;
        this.isActive = true;
        this.resetSaveForProfile();
        console.log(`[AutoPlayBot] เริ่มทำงาน — คิว ${queue.length} โปรไฟล์: ${queue.map((p) => `${p.upgradeStrategy}+${p.skillPolicy}`).join(', ')}`);
    },

    // ล้าง save เป็นค่าเริ่มต้น + ปิด Quiz Gate เสมอ — สำคัญมาก: ไม่มี hook ใน quiz.js เลยตอนบอททำงาน
    // (ตามแผนที่ตกลงไว้ว่าบอทข้าม quiz เสมอ) ถ้าลืมปิดตรงนี้ บอทจะค้างตอนเจอ Quiz Gate จริงครั้งแรกทันที
    // เรียกทั้งตอนเริ่มคิว (start) และทุกครั้งที่ขึ้นโปรไฟล์ใหม่ (advanceProfile) เพราะ reset() คืนค่า quizEnabled เป็น true ทุกครั้ง
    resetSaveForProfile() {
        SaveManager.reset();
        SaveManager.setQuizEnabled(false);
    },

    stop() {
        this.isActive = false;
    },

    currentProfile() {
        return this.queue[this.queueIndex] || null;
    },

    currentProfileName() {
        const p = this.currentProfile();
        return p ? `${p.upgradeStrategy}+${p.skillPolicy}` : '-';
    },

    statusText() {
        const p = this.currentProfile();
        if (!p) return 'Bot: Finishing up...';
        return `Bot: Profile ${this.queueIndex + 1}/${this.queue.length} (${this.currentProfileName()}) · Stage ${SaveManager.getCurrentStage()} · Attempt ${this.attemptsOnCurrentStage + 1}/${MAX_ATTEMPTS_PER_STAGE}`;
    },

    // เรียกจาก BaseScene.create() ท้ายสุด (หรือเรียกตรงจาก BotSettingsScene ตอนกด START ครั้งแรก)
    onBaseSceneReady(scene) {
        if (!this.isActive) return;

        if (this.queueIndex >= this.queue.length) {
            // คิวหมดแล้ว — export CSV รวมทุกโปรไฟล์ให้อัตโนมัติแล้วหยุด
            this.isActive = false;
            console.log(`[AutoPlayBot] ทำงานครบทุกโปรไฟล์แล้ว (รวม ${this.totalBattles} ศึก) — กำลัง export CSV`);
            scene.exportTestLog();
            return;
        }

        console.log(`[AutoPlayBot] ${this.statusText()}`);
        if (scene.updateBotStatusText) scene.updateBotStatusText(this.statusText());

        // 2026-09-04: UpgradeScene เปลี่ยนดีไซน์เป็นแสดงทีละ 1 อย่าง (เปิดจากการแตะไอคอนป้อม/ฐานทัพใน BaseScene) ไม่เหมาะให้บอทไล่
        // เปิดทีละหน้าอีกต่อไป — ซื้อของตรงผ่าน SaveManager เลย (ดู spendGold) ไม่ต้องเปิด UpgradeScene จริงๆ เลยด้วยซ้ำ
        // (Quiz Gate ก็ไม่มีผลอยู่แล้วเพราะ resetSaveForProfile() ปิด quizEnabled ไว้เสมอตอนบอททำงาน — ผลลัพธ์เหมือนกันทุกประการ)
        const profile = this.currentProfile();
        this.spendGold(profile.upgradeStrategy);
        scene.scene.start('MapScene', { stage: SaveManager.getCurrentStage(), channel: 'battleStart' });
    },

    // ซื้ออัพเกรดตามกลยุทธ์วนจนหมดตังค์/ครบ MAX — เรียก SaveManager.setTurretLevel/setBaseLevel ตรงๆ (ข้าม UI ทั้งหมด)
    // เทียบเท่าพฤติกรรมเดิมทุกประการตอน Quiz Gate ปิดอยู่ (บอทปิดเสมอ ดู resetSaveForProfile) เพราะ requestQuizGate ตอนปิดอยู่
    // ก็แค่เรียก callback ทันทีอยู่แล้ว ไม่ต่างจากซื้อตรงแบบนี้เลย
    spendGold(strategy) {
        if (strategy === 'none') return;
        const rows = this.buildPurchaseRows();

        // เพดานกันลูปไม่จบ (มี 6 แถว x อัปสูงสุด 4 เลเวล/แถว = ซื้อได้จริงสูงสุด 24 ครั้งต่อโปรไฟล์)
        for (let guard = 0; guard < 30; guard++) {
            const row = this.pickUpgradeRow(rows, strategy);
            if (!row) break;

            const level = row.getLevel();
            const cost = row.getCost(level);
            if (!SaveManager.spendCoins(cost)) break; // ซื้อไม่สำเร็จ (กัน edge case ค้างลูป)
            row.onUpgrade(level + 1);
            TestLogger.recordUpgrade(row.logLabel, level + 1, cost, SaveManager.getCoins()); // เก็บ Log ไว้วิเคราะห์สมดุล เหมือนตอนซื้อผ่าน UI ทุกประการ
        }
    },

    // 5 แถวป้อมปืน + 1 แถวฐานทัพ คำนวณสดจาก SaveManager/TURRET_TYPES/UPGRADE_COST_BY_LEVEL ตรงๆ (โครงสร้างเดียวกับที่
    // UpgradeScene ใช้สร้าง config ต่อป้อม/ฐานทัพ ดู src/scenes/upgrade.js buildTurretConfig/buildBaseConfig)
    buildPurchaseRows() {
        const turretRows = TURRET_TYPES.map((type, index) => ({
            logLabel: type.id,
            getLevel: () => SaveManager.getTurretLevel(index),
            maxLevel: TURRET_MAX_LEVEL,
            getCost: (level) => UPGRADE_COST_BY_LEVEL[level - 1],
            onUpgrade: (nextLevel) => SaveManager.setTurretLevel(index, nextLevel)
        }));
        const baseRow = {
            logLabel: 'base',
            getLevel: () => SaveManager.getBaseLevel(),
            maxLevel: BASE_UPGRADE_MAX_LEVEL,
            getCost: (level) => UPGRADE_COST_BY_LEVEL[level - 1],
            onUpgrade: (nextLevel) => SaveManager.setBaseLevel(nextLevel)
        };
        return [...turretRows, baseRow];
    },

    // คืนแถวที่ควรซื้อถัดไปตามกลยุทธ์ หรือ null ถ้าไม่มีอะไรซื้อได้ตอนนี้
    pickUpgradeRow(rows, strategy) {
        const buyable = rows.filter((row) => {
            const level = row.getLevel();
            return level < row.maxLevel && SaveManager.getCoins() >= row.getCost(level);
        });
        if (buyable.length === 0) return null;

        if (strategy === 'cheapest') {
            return buyable.reduce((best, row) => (row.getCost(row.getLevel()) < best.getCost(best.getLevel()) ? row : best));
        }
        if (strategy === 'specialize') {
            // ทุ่มแถวแรก (ตามลำดับ rows) ที่ยังไม่ maxed จนสุดก่อนค่อยย้ายไปแถวถัดไป — ถ้าซื้อแถวเป้าหมายไม่ไหวตอนนี้ ก็ไม่ซื้อแถวอื่นแทนเด็ดขาด
            const target = rows.find((row) => row.getLevel() < row.maxLevel);
            return target && buyable.includes(target) ? target : null;
        }
        return null;
    },

    // เรียกจาก MapScene.create() ท้ายสุด — ตั้งความเร็วสูงสุด + ตั้ง timer ประเมินนโยบายสกิลเป็นระยะ
    onMapSceneReady(scene) {
        if (!this.isActive) return;

        // คืนกลับ 20x จาก 100x: การวัด "100x = overshoot 0%" ก่อนหน้านี้ทดสอบด้วยศัตรูจำนวนน้อย ไม่ใช่ความหนาแน่นจริงของ Stage ปลายเกม (Stage9-10 = 110-140 ตัว/เวฟ)
        // พิสูจน์แล้วว่าที่ 100x + ความหนาแน่นสูงขนาดนั้น ป้อมปืนยิงพลาด/ไม่ทันจริง (physics overshoot) จนดูเหมือนด่านนั้น "ผ่านไม่ได้" ทั้งที่เกียร์เต็มแล้ว
        // ทดสอบ Stage9 เกียร์เต็มชุดเดียวกันที่ 20x ผ่านฉลุย 0% ดาเมจ — 20x คือความเร็วที่มั่นใจว่าปลอดภัยจริงในทุกความหนาแน่นศัตรู ไม่ใช่แค่กรณีเบาๆ
        scene.setGameSpeed(20);

        const profile = this.currentProfile();
        if (profile.skillPolicy === 'never') return;

        // เช็คถี่ขึ้น (1000ms -> 300ms เกมไทม์) กัน swarmDefense พลาดจังหวะศัตรูกองตัวชั่วครู่ก่อนโดนป้อมเก็บหมด
        const timer = scene.time.addEvent({
            delay: 300,
            loop: true,
            callback: () => this.checkSkillCast(scene, profile.skillPolicy)
        });
        scene.activeSkillTimers.push(timer); // ฝากระบบ pause/resume เดิมของ MapScene จัดการ timer นี้ไปด้วยเลย
    },

    checkSkillCast(scene, policy) {
        if (scene.isGameOver || scene.isPaused) return;
        if (scene.skillCharge < 1) return;
        if (scene.skillMenuState !== 'closed') return; // กันชนกับเมนูที่เปิดค้างจากรอบก่อน (ไม่ควรเกิด แต่กันไว้)

        if (!this.evaluatePolicy(scene, policy)) return;

        // สลับชนิดวนไปตามจำนวนที่ร่ายไปแล้วในศึกนี้ (bomb->laser->plasma->bomb->...) แทนที่จะร่าย bomb อย่างเดียวตลอด
        // เพื่อให้ผลเทสครอบคลุมทั้ง 3 สกิลจริง ไม่ใช่แค่ระเบิดเพลิง — เลเวลล็อกที่ 1 เสมออยู่แล้ว ชนิดไหนก็หักเกจเท่ากัน เลือกสลับได้อย่างอิสระ
        const skillIds = ['bomb', 'laser', 'plasma'];
        const nextSkillId = skillIds[scene.skillCastLog.length % skillIds.length];
        this.castViaMenu(scene, nextSkillId);
    },

    evaluatePolicy(scene, policy) {
        switch (policy) {
            case 'asap':
                return true;
            case 'lowHP':
                return scene.baseHP / scene.baseMaxHP <= 0.3;
            default:
                return false;
        }
    },

    // ร่ายผ่าน flow จริงเหมือนผู้เล่นกดเอง (เปิดเมนู -> เลือกชนิด) เพื่อให้วิ่งผ่าน requestQuizGate เหมือนของจริงทุกจุด
    // เดิมมีขั้นเลือกเลเวลต่ออีกแตะ ตัดออกแล้วเพราะเลเวลล็อกที่ 1 เสมอ (ดู MapScene.getSkillLevel())
    castViaMenu(scene, skillId) {
        const typeIndex = ['bomb', 'laser', 'plasma'].indexOf(skillId);
        scene.onSkillCircleTap();
        scene.onSkillSlotTap(typeIndex);
    },

    // เรียกจากบรรทัดแรกสุดของ MapScene.showEndOverlay() — ตัดสินใจต่อว่าจะเล่นด่านเดิมซ้ำ/ไปด่านถัดไป/เลิกโปรไฟล์นี้
    onBattleEnd(scene, titleText) {
        if (!this.isActive) return;

        this.totalBattles++;
        console.log(`[AutoPlayBot] ศึกที่ ${this.totalBattles} จบ — ${this.currentProfileName()} · Stage ${SaveManager.getCurrentStage()} · ผล: ${titleText}`);

        if (titleText === 'VICTORY!!') {
            console.log(`[AutoPlayBot] โปรไฟล์ ${this.currentProfileName()} ชนะครบเกม!`);
            this.advanceProfile();
        } else if (titleText === 'DEFEAT...') {
            this.attemptsOnCurrentStage++;
            if (this.attemptsOnCurrentStage >= MAX_ATTEMPTS_PER_STAGE) {
                console.log(`[AutoPlayBot] โปรไฟล์ ${this.currentProfileName()} ติดที่ Stage ${SaveManager.getCurrentStage()} เกิน ${MAX_ATTEMPTS_PER_STAGE} ครั้ง — ยอมแพ้ ไปโปรไฟล์ถัดไป`);
                this.advanceProfile();
            }
        } else {
            // "STAGE X CLEAR!" — เคลียร์ด่านสำเร็จ ไปด่านถัดไป (SaveManager.currentStage เลื่อนให้แล้วโดยโค้ดเดิม)
            this.attemptsOnCurrentStage = 0;
        }

        if (this.totalBattles >= MAX_TOTAL_BATTLES) {
            console.log(`[AutoPlayBot] ชนวงจรป้องกันฉุกเฉิน MAX_TOTAL_BATTLES=${MAX_TOTAL_BATTLES} — ตัดจบคิวทั้งหมด`);
            // วงจรป้องกันฉุกเฉิน — บังคับให้คิวถือว่า "หมดแล้ว" แทนที่จะปิด isActive ตรงๆ
            // เพื่อให้ path ปกติใน onBaseSceneReady (เช็คคิวหมด -> export -> ปิด isActive) ทำงานเหมือนจบงานตามปกติ
            // ไม่ใช่หยุดเงียบๆ โดยไม่ export ให้
            this.queueIndex = this.queue.length;
        }

        scene.time.delayedCall(1200, () => scene.scene.start('BaseScene'));
    },

    advanceProfile() {
        this.queueIndex++;
        this.attemptsOnCurrentStage = 0;
        if (this.queueIndex < this.queue.length) {
            this.resetSaveForProfile(); // โปรไฟล์ถัดไปเริ่มจาก save สะอาด + quiz ปิดเสมอ กันผลลัพธ์ปนกัน/บอทค้าง
        }
    }
};
