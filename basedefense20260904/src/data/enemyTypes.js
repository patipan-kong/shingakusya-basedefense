// ตารางค่าพลังศัตรูพื้นฐาน 10 ชนิด (พอร์ตตรงจากไฟล์ Excel ที่ผู้ใช้ให้มา — ชื่อ id/nameEn อ้างอิงชื่อในชีตเพื่อเทียบกลับได้ง่าย)
//
// atk / durability / moveSpeed เป็นค่า "Rank" สเกล 1-5 ตามที่ออกแบบไว้ในไฟล์ Excel (ค่าดีไซน์ ไม่ใช่หน่วยเกมจริง)
// การแปลง Rank เป็นหน่วยเกมจริง (px/s, ดาเมจ, จำนวนนัดที่ต้องยิงตาย) กำหนดแยกไว้ที่ src/config/constants.js
// (ENEMY_SPEED_PER_RANK, ENEMY_HP_PER_DURABILITY_RANK, ENEMY_DAMAGE_PER_ATK_RANK)
// ต้องการปรับสมดุลศัตรูทั้งเกมพร้อมกัน -> แก้ค่าคูณใน constants.js
// ต้องการปรับศัตรูชนิดใดชนิดหนึ่งเป็นการเฉพาะ -> แก้ตัวเลขในตารางนี้
//
// sizeScale = ตัวคูณขนาดภาพ (placeholder graphics ยังไม่มี asset จริง จึงใช้ขนาดวงกลมสื่อความ "ใหญ่/เล็ก" ของศัตรูแทนรูปทรงจริง)
// coinValue = เงินรางวัลที่ได้ต่อตัวเมื่อกำจัดได้ (ใช้คำนวณเงินรางวัลจบเกม ดู MapScene.computeReward()) — ลดลง ~3 เท่าจากเดิมหลังพบว่าเศรษฐกิจพังจากการเล่นจริง (Stage 1-2 ได้เหรียญเยอะเกินจนอัปได้หลายเลเวลทันที) ยังไม่มีสเปก รอปรับต่อจากการเล่นจริงรอบใหม่
// iconColor = สีวงกลมย่อ ใช้เฉพาะตอนสรุปผลจบเกม (หน้าจอ Victory/Defeat) แยกแยะชนิดศัตรูด้วยตา ไม่เกี่ยวกับสี tint จริงในสนามรบ (อันนั้นมาจากธาตุ)
export const ENEMY_TYPES = [
    { id: 'normal1',      nameTh: 'Normal Enemy 1',            nameEn: 'Normal Type1',               atk: 2, durability: 2, moveSpeed: 2, sizeScale: 1.0, coinValue: 2, iconColor: 0xe74c3c },
    { id: 'normal2',      nameTh: 'Normal Enemy 2',            nameEn: 'Normal Type2',               atk: 3, durability: 1, moveSpeed: 2, sizeScale: 1.0, coinValue: 2, iconColor: 0xe67e22 },
    { id: 'normal3',      nameTh: 'Normal Enemy 3',            nameEn: 'Normal Type3',               atk: 1, durability: 3, moveSpeed: 2, sizeScale: 1.0, coinValue: 2, iconColor: 0xf1c40f },
    { id: 'speed1',       nameTh: 'Speed Enemy 1',             nameEn: 'Speed Type1',                atk: 2, durability: 1, moveSpeed: 4, sizeScale: 0.85, coinValue: 1, iconColor: 0x2ecc71 },
    { id: 'speed2',       nameTh: 'Speed Enemy 2',             nameEn: 'Speed Type2',                atk: 1, durability: 1, moveSpeed: 5, sizeScale: 0.8, coinValue: 1, iconColor: 0x1abc9c },
    { id: 'ranged',       nameTh: 'Ranged Attack Enemy',       nameEn: 'Range ATK Type',             atk: 1, durability: 2, moveSpeed: 2, sizeScale: 1.0, coinValue: 2, iconColor: 0x3498db, isRanged: true },
    { id: 'medium',       nameTh: 'Medium Enemy',              nameEn: 'Medium Size Type',           atk: 4, durability: 4, moveSpeed: 2, sizeScale: 1.3, coinValue: 4, iconColor: 0x9b59b6 },
    { id: 'mediumSpeed',  nameTh: 'Medium Enemy (Speed)',      nameEn: 'Medium Size Speed Type',     atk: 3, durability: 3, moveSpeed: 3, sizeScale: 1.3, coinValue: 3, iconColor: 0xe91e8c },
    { id: 'mediumRanged', nameTh: 'Medium Enemy (Ranged)',     nameEn: 'Medium Size Range ATK Type', atk: 2, durability: 3, moveSpeed: 2, sizeScale: 1.3, coinValue: 3, iconColor: 0x795548, isRanged: true },
    { id: 'large',        nameTh: 'Large Enemy',               nameEn: 'Large Size Type',            atk: 5, durability: 5, moveSpeed: 1, sizeScale: 1.6, coinValue: 5, iconColor: 0x7f8c8d }
];

// หา enemy type จาก id — คืน undefined ถ้าไม่พบ (เช่น waves.js สะกด id ผิด จะได้เห็น error ชัดเจนตอนทดสอบ)
export function getEnemyTypeById(id) {
    return ENEMY_TYPES.find((type) => type.id === id);
}
