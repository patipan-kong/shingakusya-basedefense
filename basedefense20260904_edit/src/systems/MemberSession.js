// ถอดรหัส d/i จาก URL query string เพื่อดึง member_id — ธรรมเนียมเดียวกับ Dungeon Survival
// (chikatanken/chikatanken20250514/js/game.js: getPlayerData()): AES-256-CBC ผ่าน CryptoJS (โหลดเป็น global
// script ใน index.html ก่อน main.js), key = 32 ตัวแรกของ secret ต่อ environment (ดู config/memberAuth.js),
// iv = ค่าดิบของ query param `i` แบบเต็มความยาวตรงๆ ไม่ตัด (คนละกติกากับ key)
//
// คืนค่าเป็น { memberId, reason } เสมอ ไม่มีทาง throw ออกนอกไฟล์นี้ — ทุกความล้มเหลว (ไม่มี d/i, ถอดรหัสไม่ผ่าน,
// JSON เพี้ยน, ไม่มี member_id ในผลลัพธ์) แปลว่า memberId=null ให้ผู้เรียกตัดสินใจเอง (เกมต้องเล่นได้ต่อแบบ local-only
// เมื่อไม่มี member_id เช่น เปิด index.html ตรงๆ ตอน dev/test — ดู testMode.js, devTools.js)
import { getMemberAuthKey } from '../config/memberAuth.js';

function getUrlParams() {
    return new URLSearchParams(window.location.search);
}

function decryptPayload(dParam, iParam) {
    const key = CryptoJS.enc.Utf8.parse(getMemberAuthKey());
    const iv = CryptoJS.enc.Utf8.parse(iParam);
    const decrypted = CryptoJS.AES.decrypt(dParam, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

let cached = null;

// resolveMemberId() memoize ผลลัพธ์ไว้ — เรียกซ้ำได้ปลอดภัย คำนวณแค่ครั้งแรกครั้งเดียวต่อการโหลดหน้า
export function resolveMemberId() {
    if (cached) return cached;

    const params = getUrlParams();
    const d = params.get('d');
    const i = params.get('i');

    if (!d || !i) {
        cached = { memberId: null, reason: 'missing_params' };
        return cached;
    }

    let jsonText;
    try {
        jsonText = decryptPayload(d, i);
    } catch (e) {
        console.warn('[MemberSession] ถอดรหัส d/i ไม่สำเร็จ', e);
        cached = { memberId: null, reason: 'decrypt_error' };
        return cached;
    }

    if (!jsonText) {
        // CryptoJS ไม่ throw ตอน key/iv ผิด แต่จะได้ผลลัพธ์ว่างหรือขยะแทน (padding ไม่ตรง) — เช็คแยกจาก try/catch ด้านบน
        console.warn('[MemberSession] ถอดรหัส d/i ได้ค่าว่าง (key/iv ไม่ตรง หรือข้อมูลเสีย)');
        cached = { memberId: null, reason: 'decrypt_empty' };
        return cached;
    }

    let payload;
    try {
        payload = JSON.parse(jsonText);
    } catch (e) {
        console.warn('[MemberSession] JSON ที่ถอดรหัสได้ parse ไม่ผ่าน', e);
        cached = { memberId: null, reason: 'malformed_json' };
        return cached;
    }

    if (!payload || typeof payload.member_id !== 'string' || payload.member_id === '') {
        console.warn('[MemberSession] ไม่มี member_id ใน payload ที่ถอดรหัสได้');
        cached = { memberId: null, reason: 'missing_member_id' };
        return cached;
    }

    cached = { memberId: payload.member_id, reason: null };
    return cached;
}
