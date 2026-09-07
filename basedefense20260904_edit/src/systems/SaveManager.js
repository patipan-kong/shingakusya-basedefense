// จัดการข้อมูลที่ต้องอยู่ข้ามเซสชัน (persistence) — server-only ผ่าน api-basedefense (ดู SaveSync.js)
// ES Module จะถูก import ครั้งเดียวและ cache ไว้ (singleton) ทุก Scene ที่ import จึงใช้ state ก้อนเดียวกัน
//
// ไม่มี localStorage เกี่ยวข้องกับ gameplay save เลย (ตั้งใจ — ห้ามเพิ่มกลับมาเป็น cache/fallback/migration source
// ใดๆ ทั้งสิ้น) this.data เริ่มต้นในหน่วยความจำด้วยค่า default ธรรมดาเสมอ แล้วรอ SaveSync ตัดสินใจว่าจะ hydrate จาก
// server หรือคงค่า default ไว้ (ดู SaveSync.js สำหรับกติกาเต็ม: มี member_id+มี save / มี member_id+ไม่มี save /
// ไม่มี member_id เลย (dev/test, ไม่มีการบันทึกถาวรใดๆ) / โหลดจาก server ไม่สำเร็จ) — เกมจะไม่เริ่มเล่นจริงจนกว่า
// SaveSync.ready จะ resolve ก่อน (ดู title.js) จึงไม่มีช่วงเวลาที่ default state ที่ยังไม่ผ่านการตัดสินใจจะถูกเซฟทับ
// save บน server ที่มีอยู่แล้วโดยไม่ตั้งใจ
import { SaveSync } from './SaveSync.js';

const DEFAULT_SAVE_DATA = {
    coins: 0, // เริ่มจากศูนย์จริงๆ — เล่น Stage 1 ด้วยสถานะเริ่มต้นก่อนถึงจะได้อัปเกรด (เดิม 1000 เป็นค่าสะดวกตอนเทส แต่ทำให้เศรษฐกิจพังตั้งแต่ยังไม่เริ่มเล่น)
    turretLevels: [1, 1, 1, 1, 1], // ตามลำดับเดียวกับ TURRET_TYPES ใน src/data/turretTypes.js (5 กระบอก)
    baseLevel: 1,
    currentStage: 1, // Stage ที่จะเล่นเมื่อกด Battle Start ครั้งถัดไป (เลื่อนขึ้นเมื่อเคลียร์ Stage สำเร็จ ดู MapScene.onStageClear())
    quizEnabled: true, // เปิด = ต้องตอบคำถามให้ถูกก่อนอัปเกรด/ใช้สกิลถึงจะสำเร็จ (ดู src/systems/QuizGate.js) — ปิดไว้เพื่อเทสเร็วๆ ได้
    bestSimulationStage: 0, // Virtual Stage ไกลสุดที่เคยไปถึงในโหมดจำลอง (Simulation Mode) — 0 = ยังไม่เคยเล่น ดู MapScene.gameOver()
    stageRecords: {} // สถิติ % ความเสียหายฐานที่ต่ำที่สุดเท่าที่เคยทำได้ต่อ Stage คีย์เป็น stage number (string) ดู recordStageClear — ใช้โชว์ในหน้า Battle History
};

// สำเนาลึกของ DEFAULT_SAVE_DATA เสมอ — ห้ามใช้ {...DEFAULT_SAVE_DATA} เฉยๆ เพราะเป็น shallow copy
// turretLevels เป็น array จะได้ reference เดิมกับ DEFAULT_SAVE_DATA.turretLevels พอ setTurretLevel() ไป mutate
// array นั้นตรงๆ (this.data.turretLevels[index]=level) จะเผลอไป mutate DEFAULT_SAVE_DATA ถาวรตลอดทั้ง session
// (พบระหว่างเทส: เรียก reset() หลังเคยอัปเกรดแล้ว กลับไม่รีเซ็ต turretLevels กลับเป็น 1 จริง)
function cloneDefault() {
    return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
}

// รวม partial data จาก server เข้ากับ default เสมอ เผื่อ save เก่าบน server ยังไม่มีฟิลด์ที่เพิ่งเพิ่มใน Phase หลังๆ
function mergeWithDefault(partial) {
    const merged = { ...cloneDefault(), ...partial };
    // PHP json_decode/json_encode แยกไม่ออกระหว่าง object ว่างกับ array ว่าง ({} กับ []) — object ว่างที่ส่งไป API
    // จะย้อนกลับมาเป็น [] เสมอ (ดู api-basedefense/README.md หัวข้อ "ทำไม stageRecords อาจกลับมาเป็น [] ")
    // เกิดเฉพาะตอน stageRecords ว่างเปล่าเท่านั้น (ไม่ว่างจะกลับมาเป็น object ปกติเพราะคีย์เป็น string ไม่ใช่เลขเรียงจาก 0)
    // แปลงกลับเป็น {} ตรงนี้ที่เดียว กันไม่ให้ปนไปเป็น sparse array ตอนมีคนเซ็ตคีย์ทีหลัง (เช่น stageRecords["5"]=...)
    if (Array.isArray(merged.stageRecords)) {
        merged.stageRecords = {};
    }
    return merged;
}

// state เปลี่ยน -> ส่งไป schedule save กับ server เท่านั้น (ดู SaveSync.js: debounce + serialize) ไม่มีการเขียน
// localStorage ใดๆ ในนี้ — ถ้ายังไม่รู้ member_id (dev/test เปิด index.html ตรงๆ) SaveSync.scheduleSave() จะเป็น no-op
// เอง (เล่นได้ปกติแต่ progress จะไม่ถูกบันทึกถาวรที่ไหนเลย เป็นเซสชันชั่วคราวในหน่วยความจำล้วนๆ)
function persist(data) {
    SaveSync.scheduleSave(data);
}

export const SaveManager = {
    data: cloneDefault(),

    getCoins() {
        return this.data.coins;
    },

    // เพิ่มเหรียญ คืนค่ายอดรวมล่าสุดหลังบวก
    addCoins(amount) {
        this.data.coins += amount;
        persist(this.data);
        return this.data.coins;
    },

    // หักเหรียญ คืน true ถ้าหักสำเร็จ, false ถ้าเหรียญไม่พอ (ไม่หักอะไรเลย)
    spendCoins(amount) {
        if (this.data.coins < amount) return false;
        this.data.coins -= amount;
        persist(this.data);
        return true;
    },

    // เลเวลป้อมปืนกระบอกที่ index (0-4) — ค่าเริ่มต้น 1 ถ้ายังไม่เคยอัปเกรด
    getTurretLevel(index) {
        return this.data.turretLevels[index] ?? 1;
    },

    setTurretLevel(index, level) {
        this.data.turretLevels[index] = level;
        persist(this.data);
    },

    getBaseLevel() {
        return this.data.baseLevel;
    },

    setBaseLevel(level) {
        this.data.baseLevel = level;
        persist(this.data);
    },

    getCurrentStage() {
        return this.data.currentStage;
    },

    setCurrentStage(stageNumber) {
        this.data.currentStage = stageNumber;
        persist(this.data);
    },

    getQuizEnabled() {
        return this.data.quizEnabled;
    },

    setQuizEnabled(enabled) {
        this.data.quizEnabled = enabled;
        persist(this.data);
    },

    getBestSimulationStage() {
        return this.data.bestSimulationStage;
    },

    setBestSimulationStage(stage) {
        this.data.bestSimulationStage = stage;
        persist(this.data);
    },

    // สถิติ % ความเสียหายฐานที่ต่ำที่สุดของ Stage นี้เท่าที่เคยเคลียร์มา — undefined ถ้ายังไม่เคยมีบันทึก (เช่น save เก่าก่อนมีฟีเจอร์นี้)
    getStageRecord(stageNumber) {
        return this.data.stageRecords[stageNumber];
    },

    // บันทึกผลเคลียร์ Stage — เก็บเฉพาะสถิติที่ดีกว่าเดิม (% เสียหายต่ำกว่า) เท่านั้น ดู MapScene.onStageClear
    recordStageClear(stageNumber, damagePercent) {
        const prev = this.data.stageRecords[stageNumber];
        if (prev === undefined || damagePercent < prev) {
            this.data.stageRecords[stageNumber] = damagePercent;
            persist(this.data);
        }
    },

    // ล้าง Save ทั้งหมดกลับเป็นค่าเริ่มต้น (ไว้ใช้ตอน debug/reset) — reset จะ sync ไป server ด้วย (ผ่าน persist() ปกติ)
    reset() {
        this.data = cloneDefault();
        persist(this.data);
    },

    // เรียกจาก SaveSync.js เพียงที่เดียว (ไม่เรียกตรงๆ จากที่อื่น) ตอนรู้ผลจาก server แล้วว่าจะใช้ state ไหน:
    //   - serverData เป็น object -> มี save บน server อยู่แล้ว รวมเข้ากับ default แล้วสลับไปใช้ (server เป็นตัว
    //     authoritative หนึ่งเดียว ไม่มี local cache ให้เทียบ)
    //   - serverData เป็น null -> ยังไม่มี save บน server (ผู้เล่นใหม่ตัวจริง ยืนยันจาก server แล้วว่า exists:false)
    //     -> รีเซ็ตกลับ default ปกติของเกม
    // ไม่ยิง save กลับไป server ทันที เพราะข้อมูลชุดนี้มาจาก server เองอยู่แล้ว ไม่มีอะไรใหม่ให้ save กลับ —
    // การเปลี่ยนแปลงจริงครั้งถัดไปตอนเล่นจะ sync ไป server ตามปกติเองผ่าน persist()
    hydrate(serverData) {
        this.data = serverData ? mergeWithDefault(serverData) : cloneDefault();
    }
};

// เริ่ม resolve member_id + โหลด save จาก server ทันทีตอน module นี้ถูก import ครั้งแรก (เร็วที่สุดเท่าที่ทำได้ —
// ไม่ต้องรอ Scene ไหนทำงานก่อน) SaveSync.ready ให้ Scene ที่ต้องรอผลใช้ (ดู title.js — ต้องรอก่อนเริ่ม BaseScene
// เสมอ และต้องบล็อกไม่ให้เข้าเกมถ้า SaveSync.ready resolve เป็น {ok:false} คือโหลดจาก server ไม่สำเร็จ)
SaveSync.init({ hydrate: (serverData) => SaveManager.hydrate(serverData) });
