// ป้อมปืน 5 กระบอกคงที่ (Fixed 1:1 slot ไม่ใช่ให้ผู้เล่นเลือกธาตุเอง — ยืนยันจากไฟล์ Excel ที่มีสเปคแยกแต่ละกระบอก)
// ลำดับ array = ลำดับตำแหน่งป้อมจากซ้ายไปขวาบนหน้าจอ
//
// atk เป็นค่า Rank สเกล 1-5 (พอร์ตตรงจากไฟล์ Excel) แปลงเป็นหน่วยเกมจริงผ่าน constants.js (TURRET_DAMAGE_PER_ATK_RANK)
// fireRate ยังเก็บไว้เป็นข้อมูลอ้างอิงจาก Excel แต่ไม่ได้ใช้คำนวณจังหวะยิงแล้ว (2026-09-01: ทุกป้อมเริ่ม Lv.1 เท่ากันที่
// TURRET_FIRE_DELAY_BASE_MS ตามคอมเมนต์ลูกค้า — ความต่างของป้อมย้ายไปอยู่ที่ fireRateGrowthPerLevel ด้านล่างแทน ดู turretStats.js)
// element: ธาตุที่ใช้เทียบกับศัตรู (ดาเมจโบนัสตอนตรงธาตุ) — ตรงกับ src/data/elements.js
// color: สีตัวป้อม (เอกลักษณ์ของป้อมแต่ละกระบอก แยกจาก element เพราะป้อมไร้ธาตุ 2 กระบอกต้องแยกสีกันเองด้วย) — ยังใช้เป็น swatch สีใน UpgradeScene
// sprite: ชื่อ texture key รูปป้อมปืนจริง (โหลดจาก assets/<sprite>.png ใน PreloadScene) ใช้แทน placeholder Graphics เดิมใน MapScene
// muzzleOffsetX: ตำแหน่งปากกระบอกปืนเยื้องจาก center ของภาพ (px, ค่าลบ=ซ้าย/บวก=ขวา ตอนป้อมหันขึ้นตรง) ใช้คำนวณจุดเกิดกระสุนจริงใน MapScene.spawnBullet() ให้ตรงปากกระบอกเป๊ะแม้หมุนไปทิศไหนก็ตาม
// piercing: กระสุนทะลุศัตรูได้หลายตัว ไม่ดับหลังชนตัวแรก
// spread: ยิงกระจายหลายนัดพร้อมกันแทนยิงนัดเดียวเล็งตรง
//
// upgrade: เส้นทางอัปเกรด 5 เลเวล (1-5) ของป้อมนี้ — จงใจ "ไม่เท่ากันทุกป้อม" เพื่อให้อัปแต่ละกระบอกได้ผลลัพธ์ต่างกันจริง
// สะท้อนกลไกเดิมของป้อมนั้นๆ (ป้อมทะลุ/กระจายมีตัวคูณดาเมจแฝงอยู่แล้วจากการโดนหลายเป้า จึงเน้น atkGrowth ต่ำ
// แล้วไปเน้นแกนอื่นแทน กันไม่ให้ดาเมจรวมพุ่งเกินจริงตอนอัปสุด) รายละเอียดเหตุผลอยู่ในแผนที่คุยกับผู้ใช้
//   atkGrowthPerLevel: ดาเมจ/นัด คูณด้วย 1 + (level-1)*ค่านี้
//   fireRateGrowthPerLevel: อัตรายิงเร็วขึ้น หน่วงเวลายิงหารด้วย 1 + (level-1)*ค่านี้
//   bulletCountByLevel: จำนวนกระสุนต่อการยิง 1 ครั้งที่แต่ละเลเวล (มีความหมายเฉพาะป้อม spread:true)
//   focusLabel: ข้อความสั้นๆ อธิบายจุดเด่นของสายอัปเกรดนี้ ไว้โชว์ใน UpgradeScene ให้ผู้เล่นเห็นความต่างจริง
//
// ค่า growth ทั้งหมดถูกคูณ ~3.4 เท่าจากเดิม (คงสัดส่วนความต่างระหว่างป้อมไว้เหมือนเดิม แค่ทำให้ทุกป้อมชันขึ้น) เพื่อชดเชยเพดาน
// Level 5 ที่ลดลงไปพร้อมกับ TURRET_DAMAGE_PER_ATK_RANK (constants.js, 3->1) — DPS รวม Level 5 กลับมาที่ ~177/วิ เท่าเดิม
// (ก่อนหน้านี้ Level1/Level5 ต่างกันแค่ ~2.5 เท่า ตอนนี้ต่างกัน ~7.5 เท่า ให้การอัพเกรดมีความหมายจริงจัง ไม่ใช่แค่ Level 1 ก็ผ่านได้ทั้งเกม)
// ลำดับซ้าย->ขวา: ดำ, เหลือง, แดง, น้ำเงิน, รุ้ง (ตามที่ผู้ใช้กำหนด — เดิมคือ แดง,น้ำเงิน,เหลือง,ดำ,รุ้ง)
//
// 2026-09-01: fireRateGrowthPerLevel ทุกตัวถูกคำนวณใหม่ทั้งหมด หลังตัด type.fireRate ออกจากฐาน Lv.1 (ดู turretStats.js/constants.js —
// ทุกป้อมเริ่ม Lv.1 เท่ากันที่ TURRET_FIRE_DELAY_BASE_MS=1500ms ตามคอมเมนต์ลูกค้าเรื่องยิงไวไป) เดิม Lv.1 ของแต่ละป้อมไม่เท่ากัน (400-1400ms)
// ทำให้ off=0 ที่ Lv.1 "ล็อกจุดเริ่ม" ของป้อมไว้ต่างกันอยู่แล้วโดยธรรมชาติของสูตร (multiplier ที่ Lv.1 = 1 เสมอไม่ว่า growth เท่าไหร่)
// ถ้าไม่แก้ growth ตรงนี้ด้วย พอฐาน Lv.1 เท่ากันหมดแล้ว เพดาน Lv.5 ของทุกป้อมจะขยับตามฐานใหม่ไปด้วย (ทำให้ Lv.5 อ่อนลงทั้งกระดาน
// ไม่ได้ตั้งใจ) จึงคำนวณ growth ใหม่ให้ "หน่วงเวลายิงที่ Lv.5" ของแต่ละป้อมเท่าเดิมเป๊ะกับก่อนแก้ (Black 833ms, Yellow 536ms, Red 433ms,
// Blue 309ms, Colorful 100ms) สูตร: newGrowth = (1500/oldLv5Delay - 1) / 4 — เพดาน Lv.5 รวมเลยยังคง 177 DPS เหมือนเดิมทุกประการ
// มีแค่ Lv.1-4 ที่เปลี่ยน (Lv.1 เท่ากันหมดตามที่ขอ, Lv.2-4 ไล่ระดับชันขึ้นกว่าเดิมเพื่อให้ทันไปถึง Lv.5 เป้าหมายเดิม)
// 2026-09-01 (รอบ 2): ทดสอบจริงที่ 2000ms พบว่า DPS ต้นเกมหายไปเยอะเกิน (Stage 1 Lv.1 เหลือ HP 30%, หลายด่านตายที่เกียร์เดิมผ่านได้)
// จึงลดฐานลงมาที่ 1500ms ตามที่ตกลง แล้วคำนวณ growth ใหม่ตามสูตรเดียวกันด้วยฐาน 1500 แทน — ยังไม่ได้ชดเชย DPS ที่หายไปอยู่ดี
//
// 2026-09-01 (รอบ 3): ทดสอบจริงที่ 1500ms ยังไม่พอ — ผู้เล่นจริงติดที่ Stage 4-5 ตายรวด 9 ครั้ง (log จริง) เร็วกว่าตัวเทสต์อัตโนมัติชี้ไว้อีก
// (Stage 10) จึงชดเชยที่ atkGrowthPerLevel นี้แทน (คู่กับ TURRET_DAMAGE_PER_ATK_RANK=1.782 ใน constants.js) ด้วยสูตรเดียวกับ
// fireRateGrowthPerLevel ด้านบน: newAtkGrowth = ((1+4*oldAtkGrowth)/K - 1)/4 โดย K=1.782 — ทำให้ดาเมจ/นัดที่ Lv.1 สูงขึ้นตาม K
// แต่เพดาน Lv.5 ยังคงเดิมเป๊ะ (ไม่เปลี่ยนเลย) ผลคือ DPS รวม Lv.1 กลับไปที่ ~23.8 (ใกล้เคียง 23.7 เดิมมาก) และ Lv.2-4 ได้มากกว่าเดิม
// เล็กน้อยด้วย (28.1/49.6/91.4 เทียบเดิม 27.0/45.3/84.8) เผื่อพื้นที่ปลอดภัยเพิ่ม ค่าเดิมก่อนรอบนี้: Black 0.85, Yellow/Blue 0.27, Red 0.50, Colorful 0.34
export const TURRET_TYPES = [
    {
        id: 'noElement1', nameTh: 'Black Turret', element: 'none', color: 0x2c2c2c, sprite: 'gun_black', muzzleOffsetX: 0,
        atk: 5, fireRate: 1, piercing: true, spread: false,
        upgrade: { atkGrowthPerLevel: 0.367, fireRateGrowthPerLevel: 0.20, bulletCountByLevel: null, focusLabel: 'Focus: Damage (max destructive power)' }
    },
    {
        id: 'elementC', nameTh: 'Yellow Turret', element: 'lightning', color: 0xf1c40f, sprite: 'gun_yellow', muzzleOffsetX: 0,
        atk: 2, fireRate: 3, piercing: false, spread: true,
        upgrade: { atkGrowthPerLevel: 0.042, fireRateGrowthPerLevel: 0.45, bulletCountByLevel: [3, 3, 4, 4, 5], focusLabel: 'Focus: Bullet count (multi-barrel)' }
    },
    {
        id: 'elementA', nameTh: 'Red Turret', element: 'fire', color: 0xe74c3c, sprite: 'gun_red', muzzleOffsetX: 0,
        atk: 3, fireRate: 3, piercing: false, spread: false,
        upgrade: { atkGrowthPerLevel: 0.171, fireRateGrowthPerLevel: 0.617, bulletCountByLevel: null, focusLabel: 'Balanced (damage + fire rate)' }
    },
    {
        id: 'elementB', nameTh: 'Blue Turret', element: 'ice', color: 0x3498db, sprite: 'gun_blue', muzzleOffsetX: -14, // ดีไซน์กระบอกปืนเยื้องซ้ายจาก center 14px
        atk: 3, fireRate: 2, piercing: true, spread: false,
        upgrade: { atkGrowthPerLevel: 0.042, fireRateGrowthPerLevel: 0.963, bulletCountByLevel: null, focusLabel: 'Focus: Fire rate (already piercing)' }
    },
    {
        id: 'noElement2', nameTh: 'Colorful Turret', element: 'none', color: 0x9b59b6, sprite: 'gun_colorful', muzzleOffsetX: 0,
        atk: 1, fireRate: 5, piercing: false, spread: true,
        upgrade: { atkGrowthPerLevel: 0.081, fireRateGrowthPerLevel: 3.50, bulletCountByLevel: [3, 3, 3, 3, 3], focusLabel: 'Focus: Max fire rate' }
    }
];

export function getTurretTypeById(id) {
    return TURRET_TYPES.find((type) => type.id === id);
}
