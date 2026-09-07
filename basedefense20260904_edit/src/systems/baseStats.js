// สูตรคำนวณ Max HP และ HP Regen จริงของฐานทัพ ณ เลเวลที่กำหนด — แยกออกมาเหมือน turretStats.js
// เพราะทั้ง MapScene (ตอนเล่นจริง) และ UpgradeScene (ตอนโชว์ค่าปัจจุบันให้ผู้เล่นดู) ต้องใช้สูตรเดียวกันเป๊ะ
import {
    BASE_MAX_HP,
    BASE_HP_MULTIPLIER_PER_LEVEL,
    BASE_UPGRADE_MAX_LEVEL,
    BASE_HP_REGEN_UNLOCK_LEVEL,
    BASE_HP_REGEN_PERCENT_PER_SEC_BASE,
    BASE_HP_REGEN_PERCENT_PER_SEC_PER_LEVEL
} from '../config/constants.js';

// ตัวคูณต่อเลเวล — backloaded แบบเดียวกับป้อมปืน (ดู turretStats.js เหตุผลการรีบาลานซ์ 2026-08-28 ทั้งหมดอยู่ที่นั่น) เลเวลสูงสุดได้ค่าเท่าสูตรเส้นตรงเดิมเป๊ะ
// เสมอไม่ว่า POWER เท่าไหร่ แต่เลเวลกลางๆ อ่อนกว่านั้นมาก — ใช้ POWER เดียวกับป้อมปืน (2.3) ให้โค้งความยากของทั้งสองระบบสอดคล้องกัน (ฐานทัพคือตัวที่เคยแบกเกมไว้
// เกือบทั้งหมดตอนยังเป็นตารางเลขนิ่งๆ ทำให้ป้อมยิ่งอ่อนแค่ไหนก็ไม่ตายถ้าฐานเลเวลกลางๆ ขึ้นไป — ต้อง backload คู่กันถึงจะเห็นผลจริง)
const LEVEL_CURVE_POWER = 2.3;
const MAX_LEVEL_OFFSET = BASE_UPGRADE_MAX_LEVEL - 1;
function levelMultiplier(growthPerLevel, level) {
    const off = level - 1;
    return 1 + off ** LEVEL_CURVE_POWER * (growthPerLevel / MAX_LEVEL_OFFSET ** (LEVEL_CURVE_POWER - 1));
}

export function getBaseMaxHp(level) {
    return Math.round(BASE_MAX_HP * levelMultiplier(BASE_HP_MULTIPLIER_PER_LEVEL, level));
}

// % HP ฟื้นต่อวินาที ณ เลเวลปัจจุบัน — 0 ถ้ายังไม่ถึง BASE_HP_REGEN_UNLOCK_LEVEL
// ใช้ backloaded curve แบบเดียวกัน แต่เริ่มนับ off จากจุดปลดล็อก (level2) แทนเลเวล 1 เพราะ level2 คือ "ค่าเริ่มต้น" ของระบบนี้ ไม่ใช่ level1
function regenLevelMultiplier(level) {
    const offMaxRegen = BASE_UPGRADE_MAX_LEVEL - BASE_HP_REGEN_UNLOCK_LEVEL;
    const off = level - BASE_HP_REGEN_UNLOCK_LEVEL;
    return off ** LEVEL_CURVE_POWER * (BASE_HP_REGEN_PERCENT_PER_SEC_PER_LEVEL / offMaxRegen ** (LEVEL_CURVE_POWER - 1));
}

export function getBaseRegenPercent(level) {
    if (level < BASE_HP_REGEN_UNLOCK_LEVEL) return 0;
    return BASE_HP_REGEN_PERCENT_PER_SEC_BASE + regenLevelMultiplier(level);
}
