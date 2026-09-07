// STAGE_CONFIG มาจากสเปกของลูกค้าโดยตรง (WAVE_SPEC — ดู src/data/waveSpec.js) ไม่ใช่ Procedural แบบเดิมอีกต่อไป
// รื้อระบบ Wave ใหม่ทั้งหมดตามที่ลูกค้าส่งไฟล์ Excel มา (50 Stage x 10 Wave กำหนดศัตรูทุก Wave ไว้ตายตัว)
// ปลดล็อกชนิด/สุ่มจาก pool แบบเดิมถูกตัดทิ้งไปพร้อมกัน เพราะ WAVE_SPEC ระบุชนิด+ธาตุ+จำนวนตรงๆ ต่อ Wave อยู่แล้ว
import { WAVE_SPEC } from './waveSpec.js';
import { WAVES_PER_STAGE } from '../config/constants.js';

// ----- Spawn Interval: คงสูตรเดิมไว้ทั้งหมดตามที่ตกลง (ค่าคงที่ 3 ตัวนี้เป็น local ของไฟล์นี้ ไม่ได้ย้ายไป constants.js) -----
// ลดลงเส้นตรงตาม global wave index (นับรวมข้าม Stage) จนถึงเพดานความถี่ (กันปล่อยถี่จนดูไม่ออกเป็นตัวๆ/lag)
const GEN_BASE_SPAWN_INTERVAL_MS = 1000;
const GEN_SPAWN_INTERVAL_DECAY_PER_WAVE = 9;
const GEN_MIN_SPAWN_INTERVAL_MS = 250;

// ----- Balance patch เฉพาะจุด (ไม่ได้อยู่ในสเปก Excel ต้นฉบับของลูกค้า — แจ้งลูกค้าทราบด้วยถ้ามีการรีวิวสเปกรอบหน้า) -----
// 2026-08-28: ลองล้าง override ทั้งหมดแล้วทดสอบใหม่ (หลังเปลี่ยนสูตรศัตรูกลับเป็นเส้นตรงล้วน ไม่ยกกำลัง rank แล้ว) เพื่อดูว่า mediumSpeed-spike
// (Stage 18/22/25/29/32/37/41/47 ใช้เป็นตัวหลักของเวฟ) ยังเป็นปัญหาจริงไหมถ้าไม่นับผลจากสูตรยกกำลังเดิม — ยืนยันแล้วว่า "ใช่" ยังเป็นปัญหาจริง
// (ทดสอบ Stage 18/22 ตรงๆ: Lv.3 ตาย 0% HP ทั้งคู่ แม้ไม่มีสูตรยกกำลัง rank แล้วก็ตาม) เพราะ atk rank 3 ของ mediumSpeed สูงกว่าเพื่อนบ้าน (rank 1-2)
// อยู่แล้วโดยธรรมชาติ ไม่เกี่ยวกับสูตรแปลง rank เลย — จึงใส่ patch กลับมาเหมือนเดิม (ค่าเดิม 0.3 ที่เคยทดสอบแล้วว่าให้ความเสี่ยงใกล้เคียง Stage ข้างเคียง)
// เพื่อให้ "จุดโชว์ตัวศัตรูใหม่" (ตามตารางสิ่งใหม่ที่ลูกค้าอธิบาย) ยังรู้สึกท้าทายสมจริง ไม่ใช่กำแพงที่ทำให้ตายซ้ำจนหาทองไปอัปเกรดต่อไม่ได้
// 2026-08-28 (รอบ 2): ลองแก้ Stage 41-50 ("Gauntlet -> Endgame" ตามเอกสารลูกค้า — Lv.4 ล้างได้ 100% HP เท่ากับ Lv.5 ทุกด่าน ไม่มีความกดดัน
// เพิ่มขึ้นเลย) มา 2 ทาง: (1) allMultiplier เพิ่มจำนวนศัตรู แทบไม่มีผล เพราะชน spawn floor 250ms อยู่แล้ว (2) ขึ้น LEVEL_CURVE_POWER ใน
// turretStats.js เพื่อบีบ Lv.4 ทั้งเกม — พังของเดิม (Stage 18/20/21/22/30 ตายที่เคยรอด) โดยไม่ได้ช่วย 41-50 เลยสักด่าน (ดูเหตุผลเต็มที่ turretStats.js)
// สรุปว่า enemy composition ของ Stage 41-50 เบาเกินกว่า turret DPS ระดับไหนจะกดดันได้ที่ pacing baseline — มีแค่การลด minSpawnIntervalMs
// เฉพาะจุด (ไม่ใช่ตัวเลขสเปกลูกค้า สเปกไม่มีคอลัมน์ timing) ที่เห็นผลจริง และเห็นผลแค่ Stage 48/50 (avgHp/count สูงสุดในช่วงนี้) เท่านั้น —
// ด่านอื่นในช่วงนี้ (41/43/44/45/46/47/49) ยังคง 100% HP แม้ลดเพดานลงมากแค่ไหน ยอมรับว่าเป็น "จุดพีค 2 จุดก่อนจบ" ไม่ใช่การไล่ระดับสม่ำเสมอ
const BALANCE_OVERRIDES = {
    18: { type: 'mediumSpeed', countMultiplier: 0.3 },
    22: { type: 'mediumSpeed', countMultiplier: 0.3 },
    25: { type: 'mediumSpeed', countMultiplier: 0.3 },
    29: { type: 'mediumSpeed', countMultiplier: 0.3 },
    32: { type: 'mediumSpeed', countMultiplier: 0.3 },
    37: { type: 'mediumSpeed', countMultiplier: 0.3 },
    41: { type: 'mediumSpeed', countMultiplier: 0.3 },
    47: { type: 'mediumSpeed', countMultiplier: 0.3 },
    48: { minSpawnIntervalMs: 55 },
    50: { minSpawnIntervalMs: 40 }
};

function applyBalanceOverride(stageId, slots) {
    const override = BALANCE_OVERRIDES[stageId];
    if (!override || !override.countMultiplier) return slots;
    return slots.map((s) => (!override.type || s.type === override.type
        ? { ...s, count: Math.max(1, Math.round(s.count * override.countMultiplier)) }
        : s));
}

export const STAGE_CONFIG = WAVE_SPEC.map((stageSpec) => ({
    id: stageSpec.id,
    name: `Stage ${stageSpec.id}`,
    waves: stageSpec.waves.map((w, waveIdx) => {
        const globalIdx = (stageSpec.id - 1) * WAVES_PER_STAGE + waveIdx;
        const minSpawnInterval = BALANCE_OVERRIDES[stageSpec.id]?.minSpawnIntervalMs ?? GEN_MIN_SPAWN_INTERVAL_MS;
        const spawnInterval = Math.max(
            minSpawnInterval,
            Math.round(GEN_BASE_SPAWN_INTERVAL_MS - GEN_SPAWN_INTERVAL_DECAY_PER_WAVE * globalIdx)
        );
        const slots = applyBalanceOverride(stageSpec.id, w.slots);
        const totalEnemies = slots.reduce((sum, s) => sum + s.count, 0);

        return { totalEnemies, spawnInterval, slots };
    })
}));

// Simulation Mode (โหมดจำลอง เล่นเกิน Stage สุดท้ายไปเรื่อยๆ ไม่มีวันจบ): ของเดิมมี generator สูตรคำนวณต่อได้ไม่จำกัด
// แต่ตอนนี้ข้อมูลเป็น literal ทั้งหมด (ไม่มีสูตร) จึงให้เล่นซ้ำ Stage สุดท้าย (ยากสุดที่มีจริงในสเปก) ไปเรื่อยๆ แทน
// คงชื่อ/signature เดิมไว้เพราะ WaveManager.js เรียกใช้ชื่อนี้อยู่ (generateStageWaves(stageNumber, WAVES_PER_STAGE))
export function generateStageWaves() {
    return STAGE_CONFIG[STAGE_CONFIG.length - 1].waves;
}
