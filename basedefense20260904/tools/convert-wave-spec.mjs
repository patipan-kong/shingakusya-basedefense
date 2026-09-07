// เครื่องมือแปลงสเปก Wave จากไฟล์ Excel ของลูกค้า -> src/data/waveSpec.js
// รัน: npm install xlsx (ครั้งเดียว, dev-only ไม่ใช่ dependency ของเกมจริง) แล้ว node tools/convert-wave-spec.mjs "path/to/spec.xlsx"
//
// ถ้าลูกค้าส่งสเปกฉบับแก้ไขมาใหม่ ให้รันสคริปต์นี้ซ้ำแทนการแก้ src/data/waveSpec.js ด้วยมือ
// (ข้อมูลใน waveSpec.js เป็น literal ที่ generate มาจากไฟล์นี้ ไม่ใช่สูตรคำนวณ)
import XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const xlsxPath = process.argv[2];
if (!xlsxPath) {
    console.error('Usage: node tools/convert-wave-spec.mjs <path-to-xlsx>');
    process.exit(1);
}

// แปลงชื่อชนิดศัตรู (ญี่ปุ่น ตามชีต "stage setting") -> id ที่ตรงกับ src/data/enemyTypes.js
const TYPE_MAP = {
    'ノーマルタイプ1': 'normal1',
    'ノーマルタイプ2': 'normal2',
    'ノーマルタイプ3': 'normal3',
    'スピードタイプ1': 'speed1',
    'スピードタイプ2': 'speed2',
    '遠距離攻撃タイプ': 'ranged',
    '中型タイプ': 'medium',
    '中型スピードタイプ': 'mediumSpeed',
    '中型遠距離攻撃タイプ': 'mediumRanged',
    '大型タイプ': 'large'
};
// ธาตุ A/B/C ตามที่ระบุในชีต "master data" ว่าคาดหวังเป็น ไฟ/น้ำแข็ง/สายฟ้า (火・氷・雷)
const ELEMENT_MAP = { '無属性': 'none', '属性A': 'fire', '属性B': 'ice', '属性C': 'lightning' };
const CELL_RE = /^(.+?)(無属性|属性A|属性B|属性C)\s*x\s*(\d+)$/;

const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets['stage setting'];
if (!ws) {
    console.error('ไม่พบชีต "stage setting" ในไฟล์');
    process.exit(1);
}
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

let curStage = null;
const stages = []; // [{id, waves:[{slots:[{type,element,count}]}]}]
const unmapped = new Set();

for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[0] !== '') {
        curStage = r[0];
        stages.push({ id: curStage, waves: [] });
    }
    const slots = [];
    for (let c = 2; c <= 6; c++) {
        const v = r[c];
        if (v === '') continue;
        const m = v.match(CELL_RE);
        if (!m) {
            console.error(`แถว ${i + 1} คอลัมน์ ${c + 1}: parse ไม่ได้ -> "${v}"`);
            process.exit(1);
        }
        const type = TYPE_MAP[m[1]];
        const element = ELEMENT_MAP[m[2]];
        if (!type) unmapped.add(m[1]);
        slots.push({ type, element, count: parseInt(m[3], 10) });
    }
    stages[stages.length - 1].waves.push({ slots });
}

if (unmapped.size > 0) {
    console.error('พบชื่อชนิดศัตรูที่ไม่รู้จัก (เพิ่มใน TYPE_MAP ก่อน):', [...unmapped]);
    process.exit(1);
}

const header = `// ข้อมูล Wave ทั้ง 50 Stage x 10 Wave — generate อัตโนมัติจากสเปกลูกค้า (BASEDEFENSE STAGE SETTING & ENEMY＆TURRET LIST.xlsx)
// ด้วย tools/convert-wave-spec.mjs — ถ้าลูกค้าส่งไฟล์แก้ไขมาใหม่ ให้รันสคริปต์นั้นซ้ำ อย่าแก้ไฟล์นี้ด้วยมือ
//
// เลเวลป้อม/ฐานที่ลูกค้าคาดหวังไว้ต่อ Stage (อ้างอิงเท่านั้น ไม่มีผลต่อโค้ด — เกมไม่มีระบบล็อกด่านตามเลเวล):
//   Stage 1-10 -> เลเวล 1, Stage 11-20 -> เลเวล 2, Stage 21-30 -> เลเวล 3, Stage 31-40 -> เลเวล 4, Stage 41-50 -> เลเวล 5
export const WAVE_SPEC = `;

writeFileSync(
    new URL('../src/data/waveSpec.js', import.meta.url),
    header + JSON.stringify(stages) + ';\n'
);

console.log(`เขียน src/data/waveSpec.js สำเร็จ: ${stages.length} stage, ${stages.reduce((s, st) => s + st.waves.length, 0)} wave`);
