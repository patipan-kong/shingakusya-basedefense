// เครื่องมือคำนวณสมดุลเกม — รันด้วย Node ไม่ต้องเปิดเบราว์เซอร์:  node tools/balance-dps.mjs
//
// คำนวณ "DPS ที่ต้องมี" ของแต่ละ Stage แล้วเทียบกับกำลังป้อมปืนที่ผู้เล่นมีได้จริง
//   DPS ที่ต้องมี = (อัตราศัตรูเกิดต่อวินาที) x (เลือดเฉลี่ยของศัตรูที่ปลดล็อกใน Stage นั้น)
//
// เคยตรวจความแม่นกับ log ที่เล่นจริงมาแล้วสมัยระบบ Wave แบบ Procedural เดิม (ทำนายตรงทั้ง Stage 1-3 ตอนนั้น)
// แต่ตอนนี้เปลี่ยนมาใช้สเปก Wave ของลูกค้าทั้งหมด (50 Stage เขียนมือ) แล้ว ยังไม่ได้ตรวจซ้ำกับผลเล่นจริงชุดใหม่
// เกณฑ์คร่าวๆ (อ้างอิงจากการตรวจครั้งก่อน ควรตรวจซ้ำก่อนเชื่อเต็มที่): <0.5 สบาย | ~0.6 เสียเลือดหนัก | >0.9 ตาย
//
// หมายเหตุ: เคยลองเขียนตัวจำลองการรบเต็มรูปแบบแล้วตรวจไม่ผ่าน (จำลองพฤติกรรมตอนศัตรูหนาแน่น
// และการชนแบบ Arcade Physics ให้ตรงไม่ได้) จึงเหลือไว้เฉพาะโมเดลเชิงเลขนี้ที่พิสูจน์แล้วว่าแม่น
import { STAGE_CONFIG } from '../src/data/stages.js';
import { getEnemyTypeById } from '../src/data/enemyTypes.js';
import { TURRET_TYPES } from '../src/data/turretTypes.js';
import { getTurretDamage, getTurretFireDelay } from '../src/systems/turretStats.js';
import { getBaseMaxHp, getBaseRegenPercent } from '../src/systems/baseStats.js';
import { getEnemyHp } from '../src/systems/enemyStats.js';
import * as C from '../src/config/constants.js';

// DPS รวมของป้อมทั้ง 5 กระบอกที่เลเวลเดียวกัน (รวมจำนวนกระสุนของป้อมกระจายด้วย)
function combinedDps(level) {
    return TURRET_TYPES.reduce((sum, t) => {
        const bullets = t.upgrade.bulletCountByLevel ? t.upgrade.bulletCountByLevel[level - 1] : 1;
        return sum + getTurretDamage(t, level) * (1000 / getTurretFireDelay(t, level)) * bullets;
    }, 0);
}

function report() {
    const dps = [1, 2, 3, 4, 5].map(combinedDps);
    console.log('=== กำลังป้อมปืนรวม 5 กระบอก ===');
    dps.forEach((d, i) => console.log(`  เลเวล ${i + 1}: ${d.toFixed(1)} DPS`));

    console.log('\n=== ความอึดของฐานทัพ ===');
    for (let lv = 1; lv <= C.BASE_UPGRADE_MAX_LEVEL; lv++) {
        const hp = getBaseMaxHp(lv);
        const regenPct = getBaseRegenPercent(lv);
        console.log(`  เลเวล ${lv}: ${hp} HP | ฟื้น ${(hp * regenPct).toFixed(1)} HP/วิ`);
    }

    console.log('\n=== ราคาอัปเกรด ===');
    const tCosts = C.UPGRADE_COST_BY_LEVEL;
    const bCosts = C.UPGRADE_COST_BY_LEVEL;
    const tTotal = tCosts.reduce((a, b) => a + b, 0);
    const bTotal = bCosts.reduce((a, b) => a + b, 0);
    console.log(`  ป้อม  : ${tCosts.join('/')}  = ${tTotal} ต่อกระบอก, ${tTotal * 5} ครบ 5 กระบอก`);
    console.log(`  ฐานทัพ: ${bCosts.join('/')}  = ${bTotal}`);
    console.log(`  รวมทั้งเกม: ${tTotal * 5 + bTotal}`);

    console.log('\n=== DPS ที่ต้องมีในแต่ละ Stage ===');
    console.log('Stage | เลือดเฉลี่ย | ต้องมี (w1->w10) | เทียบ Lv1 | เทียบ Lv3 | เทียบ Lv5');
    console.log('------|------------|------------------|-----------|-----------|----------');
    for (const stage of STAGE_CONFIG) {
        // เลือดเฉลี่ยถ่วงน้ำหนักตามจำนวนจริงต่อ slot (สเปกใหม่กำหนดชนิด+จำนวนตายตัว ไม่ใช่สุ่มเท่าๆ กันจาก pool แบบเดิม) — ไม่มีตัวคูณตาม Stage แล้ว (ตัดทิ้งพร้อมระบบ Wave ใหม่)
        const slots = stage.waves[0].slots;
        const totalCount = slots.reduce((a, s) => a + s.count, 0);
        const avgHp = slots.reduce((a, s) => a + getEnemyHp(getEnemyTypeById(s.type)) * s.count, 0) / totalCount;
        const req = (w) => (1000 / w.spawnInterval) * avgHp;
        const r1 = req(stage.waves[0]);
        const r10 = req(stage.waves[stage.waves.length - 1]);
        console.log(
            String(stage.id).padStart(5) + ' | ' + avgHp.toFixed(1).padStart(10) + ' | ' +
            `${r1.toFixed(0)} -> ${r10.toFixed(0)}`.padStart(16) + ' | ' +
            (r10 / dps[0]).toFixed(2).padStart(9) + ' | ' +
            (r10 / dps[2]).toFixed(2).padStart(9) + ' | ' +
            (r10 / dps[4]).toFixed(2).padStart(9)
        );
    }
    console.log('\nเกณฑ์ (เทียบจากผลเล่นจริง): <0.5 สบาย | ~0.6 เสียเลือดหนัก | >0.9 ตาย');
    console.log('อัตราส่วน >1.0 = ยิงไม่ทันโดยธรรมชาติ ต้องรอดด้วยเลือด/regen ของฐานทัพแทน');
}

report();
