// ค่าลับสำหรับถอดรหัส member_id จาก URL params d/i — ธรรมเนียมเดียวกับเกม Dungeon Survival
// (chikatanken/chikatanken20250514/js/game.js: getPlayerData()) เพียงแต่ที่นั่น key ถูก hardcode ค่าเดียว
// ส่วนที่นี่แยก STAGING/PRODUCTION ตามที่ระบบ SHINGAKUSHA ให้มา
//
// ทั้งสองค่าเป็นความลับยาว 64 ตัวอักษร แต่ "ใช้จริงแค่ 32 ตัวแรก" เป็น AES-256 key — ตั้งใจแบบนี้ ไม่ใช่บั๊ก ห้ามแก้
// (32 ตัวอักษร UTF-8 = 32 ไบต์ = ขนาด key ของ AES-256 พอดี) ส่วน iv ตัวจริงมาจาก query param `i` ตรงๆ แบบเต็มความยาว
// ไม่ตัด — คนละค่ากับ key นี้ เจนใหม่ทุกครั้งฝั่งที่เข้ารหัส (ดู MemberSession.js)
const STAGING_SECRET = 'rMuWsfrJhVnlrQVbOcJRdMt7lRa6HtxvpmDqAwegwPg1pzYkfXSIIHjbVmwK6TNu';
const PRODUCTION_SECRET = '6PBVPcjME9He7Bcwh90nO2SwwcLP0M93iVe6zpmBXqC2iVtT98T6YFcNjNl4T6RT';

// โปรเจกต์นี้ไม่มีระบบ build/env variable (ดู README ของ api-basedefense) — สลับ environment ด้วยการแก้บรรทัดนี้ตรงๆ
// ก่อน deploy จริง เหมือนธรรมเนียมเดิมที่ dungeon survival hardcode ค่าคงที่ในไฟล์ (ดู chikatanken/.../test.php ที่ override ตัวแปรตรงๆ)
const ACTIVE_ENV = 'staging'; // 'staging' | 'production'

const SECRETS = {
    staging: STAGING_SECRET,
    production: PRODUCTION_SECRET
};

// คืน 32 ตัวอักษรแรกของ secret ที่ active อยู่ ไว้ใช้เป็น AES-256 key
export function getMemberAuthKey() {
    const secret = SECRETS[ACTIVE_ENV] || STAGING_SECRET;
    return secret.slice(0, 32);
}
