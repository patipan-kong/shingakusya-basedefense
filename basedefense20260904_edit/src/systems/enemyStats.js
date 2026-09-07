// สูตรคำนวณ HP/ดาเมจจริงของศัตรู จาก rank (1-5) ใน src/data/enemyTypes.js — แยกออกมาเหมือน turretStats.js/baseStats.js
// เพราะทั้ง MapScene (ตอนเล่นจริง) และ tools/balance-dps.mjs (ตอนประเมินบาลานซ์) ต้องใช้สูตรเดียวกันเป๊ะ
import { ENEMY_HP_PER_DURABILITY_RANK, ENEMY_DAMAGE_PER_ATK_RANK, ENEMY_RANK_CURVE_POWER } from '../config/constants.js';

// ยกกำลัง rank ก่อนคูณ (ดูเหตุผลที่ constants.js) — rank 1 ไม่กระทบเลย (1^P = 1 เสมอ) มีผลเฉพาะ rank 2 ขึ้นไป
export function getEnemyHp(type) {
    return type.durability ** ENEMY_RANK_CURVE_POWER * ENEMY_HP_PER_DURABILITY_RANK;
}

export function getEnemyDamage(type) {
    return type.atk ** ENEMY_RANK_CURVE_POWER * ENEMY_DAMAGE_PER_ATK_RANK;
}
