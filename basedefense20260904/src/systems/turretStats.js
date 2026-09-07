// สูตรคำนวณค่าสถานะจริงของป้อมปืน ณ เลเวลที่กำหนด (รวมโบนัสจากอัปเกรดแล้ว)
// แยกออกมาเป็นไฟล์กลาง เพราะทั้ง MapScene (ตอนยิงจริง) และ UpgradeScene (ตอนโชว์ค่าปัจจุบันให้ผู้เล่นดู)
// ต้องใช้สูตรเดียวกันเป๊ะๆ ไม่งั้นตัวเลขที่โชว์ในหน้าอัปเกรดจะไม่ตรงกับที่เกิดขึ้นจริงในสนามรบ
import {
    TURRET_DAMAGE_PER_ATK_RANK,
    TURRET_FIRE_DELAY_BASE_MS,
    TURRET_MAX_LEVEL
} from '../config/constants.js';

// ตัวคูณต่อเลเวล — backloaded: เลเวลสูงสุดได้ค่าเท่าสูตรเส้นตรงเดิมเป๊ะ (1+off*rate) เสมอไม่ว่า POWER เท่าไหร่ แต่เลเวลกลางๆ อ่อนกว่านั้นมาก
//
// 2026-08-28: รีบาลานซ์รอบใหม่ทั้งเกม (ป้อม+ฐาน คู่กัน ดู baseStats.js) โดยยึดสเปกศัตรู/จำนวนต่อ Stage ของลูกค้า 100% ไม่แตะเลยแม้แต่ Stage เดียว
// (ก่อนหน้านี้เคยลองบีบเฉพาะ Stage 50 ด้วยการเพิ่มจำนวนศัตรู 4 เท่า — ลูกค้ารู้สึกแปลกที่ตัวเลขไม่ตรงสเปก จึงถอยมาแก้ที่สูตรพลังแทน)
// ทดสอบจริงพบว่าความยากจากสเปกลูกค้าไม่ได้ไต่ 5 ขั้นสม่ำเสมอ (พุ่งช่วง Stage 10->20 แล้วแบนราบยาวถึง Stage 50) จึงไม่ได้พยายามบีบให้ป้อมเต็มทุกเลเวล
// จำเป็นเป๊ะทุกช่วง 10 Stage แบบเทียม แต่ปรับ POWER ให้เกียร์แต่ละเลเวลมีช่วง Stage ที่ตัวเองเก่งจริง ไม่ใช่เลเวลไหนก็ผ่านได้สบายเหมือนกันหมด (ผลทดสอบจริง:
// Lv1 พอ ~Stage 10, Lv2 พอ ~Stage 15, Lv3 พอ ~Stage 20-30 แต่เริ่มเสี่ยง, Lv4 คุม Stage 30-50 ได้สบาย, Lv3 ตายที่ Stage 50 ยืนยันว่า Lv4 ยังจำเป็นจริง)
// เพดาน Lv5 คงเดิมเป๊ะ (177 DPS รวม) ไม่กระทบบาลานซ์ปลายเกมที่เคยจูนไว้ก่อนหน้า
//
// 2026-08-28 (รอบ 2, ลองแล้วถอย): เคยลองขึ้น POWER เป็น 3.2 เพื่อบีบ Lv.4 ให้อ่อนลง (84.8 -> 68.6 DPS, -19%) หวังให้ Stage 41-50 ต้องพึ่ง Lv.5
// จริง แต่ผลทดสอบเต็มเกม (Stage 1-50) พบ 2 อย่าง: (1) Stage 18/20/21/22/30 ที่เคย "รอด 76-88%" ด้วย Lv.2/3 เดิม กลับ "ตาย 0%" ทันทีเพราะ
// Lv.2/3 ก็อ่อนลงไปด้วยเป็นผลข้างเคียง (สูตรนี้ Lv.2/3/4 ขยับลงพร้อมกันเสมอ แยกปรับเฉพาะ Lv.4 ไม่ได้) (2) แม้ Lv.4 อ่อนลง 19% แล้ว Stage 41-50
// ทุกด่านก็ยังชนะ 100% HP เท่าเดิมไม่ขยับเลยสักด่านเดียว (รวมถึง Stage 48/50 ที่เคยขยับได้ด้วยการลด spawn interval) — สรุปว่า enemy composition
// ของ Stage 41-50 เบาเกินกว่าที่ turret DPS ระดับไหนก็ตามจะรู้สึกกดดันได้ที่ pacing baseline (250ms) จึงไม่ใช่ turret curve ที่เป็นปัญหาจริง
// (ทำให้พังของเดิมเปล่าๆ โดยไม่ได้อะไรเพิ่ม) ย้อนกลับ POWER เป็น 2.3 ตามเดิม
const LEVEL_CURVE_POWER = 2.3;
const MAX_LEVEL_OFFSET = TURRET_MAX_LEVEL - 1;
function levelMultiplier(growthPerLevel, level) {
    const off = level - 1;
    return 1 + off ** LEVEL_CURVE_POWER * (growthPerLevel / MAX_LEVEL_OFFSET ** (LEVEL_CURVE_POWER - 1));
}

// ดาเมจต่อนัดจริงของป้อมชนิด type ที่เลเวล level
export function getTurretDamage(type, level) {
    return type.atk * TURRET_DAMAGE_PER_ATK_RANK * levelMultiplier(type.upgrade.atkGrowthPerLevel, level);
}

// หน่วงเวลาระหว่างการยิงแต่ละนัดจริง (ms) ของป้อมชนิด type ที่เลเวล level — ยิ่งน้อยยิ่งยิงถี่
// 2026-09-01: ลูกค้าคอมเมนต์ว่า Lv.1 ยิงไวเกินไปและป้อมแต่ละกระบอกเริ่มไม่เท่ากัน (เดิม type.fireRate rank 1-5 ต่างกันทำให้ Lv.1
// ห่างกันตั้งแต่ 400ms ถึง 1400ms) จึงตัด type.fireRate ออกจากฐานตรงนี้ ให้ทุกป้อมเริ่ม Lv.1 ที่ TURRET_FIRE_DELAY_BASE_MS เท่ากันหมด
// (multiplier ที่ level=1 = 1 เสมอไม่ว่า growthPerLevel เท่าไหร่) ความต่างของป้อมยังคงมีอยู่ แต่ย้ายไปโผล่ตอนอัปเกรดแทนผ่าน
// fireRateGrowthPerLevel ที่ต่างกันต่อป้อมอยู่แล้ว (ดู turretTypes.js) — type.fireRate ยังเก็บไว้เป็นข้อมูลอ้างอิงจาก Excel ลูกค้า
// แต่ไม่ได้ใช้คำนวณอะไรแล้ว ยังไม่ได้ชดเชย DPS ที่หายไปตอนนี้ — รอผลทดสอบ Stage 1-15 จริงก่อนตัดสินใจว่าต้องชดเชยเพิ่มไหม
export function getTurretFireDelay(type, level) {
    return TURRET_FIRE_DELAY_BASE_MS / levelMultiplier(type.upgrade.fireRateGrowthPerLevel, level);
}

// แปลงหน่วงเวลายิงเป็นจำนวนนัดต่อวินาที (อ่านง่ายกว่า และ "ยิ่งเยอะยิ่งดี" ทิศทางเดียวกับดาเมจ)
export function getTurretShotsPerSecond(type, level) {
    return 1000 / getTurretFireDelay(type, level);
}
