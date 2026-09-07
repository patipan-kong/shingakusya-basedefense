// ธาตุทั้งหมดในเกม: ไร้ธาตุ, ไฟ, น้ำแข็ง, สายฟ้า (ตรงกับ Element A/B/C ในไฟล์ Excel ป้อมปืน)
// color = สี Tint ที่ใช้ย้อมศัตรู (แทนการวาด texture แยกทุกธาตุ ตามที่ระบุในเอกสารดีไซน์ว่า
// "แต่ละชนิดจะมีรูปลักษณ์เหมือนกัน หากธาตุต่างกันให้เปลี่ยนสี")
//
// กติกาการแพ้ธาตุ (ยืนยันแล้ว): ศัตรูแพ้ทางเฉพาะ "ธาตุเดียวกับตัวเอง" เท่านั้น ไม่ใช่ตารางแพ้ทางแบบวนกัน
// ตัวคูณดาเมจตอนแพ้ทางอยู่ที่ constants.js (ELEMENT_MATCH_DAMAGE_MULTIPLIER)
// หมายเหตุ: ตอนนี้ยังใช้จริงไม่ได้เต็มระบบ เพราะป้อมปืนยังไม่มีธาตุ (จะผูกกันใน Phase ป้อมปืนธาตุ)
export const ELEMENTS = {
    none:      { id: 'none',      nameTh: 'None',      color: 0x95a5a6 },
    fire:      { id: 'fire',      nameTh: 'Fire',      color: 0xe74c3c },
    ice:       { id: 'ice',       nameTh: 'Ice',       color: 0x3498db },
    lightning: { id: 'lightning', nameTh: 'Lightning', color: 0xf1c40f }
};

export const ELEMENT_IDS = Object.keys(ELEMENTS);
