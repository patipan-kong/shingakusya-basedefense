// เชื่อม SaveManager (local, ตัว state จริงที่เกมอ่าน/เขียนตลอดเวลา) เข้ากับ api-basedefense (server, ตัว authoritative
// เมื่อมี member_id) เข้าด้วยกัน — เป็นจุดเดียวที่ตัดสินใจว่าจะ hydrate/reset/เก็บ state เดิมไว้ตอนไหน
//
// กติกา (ดูรายละเอียดเหตุผลใน README ของ api-basedefense หัวข้อ "no-save vs load-failed" และ "local/server ambiguity"):
//   - ไม่มี member_id (d/i ไม่มี/ถอดรหัสไม่ผ่าน) -> โหมด local-only ล้วนๆ เหมือนเกมเดิมทุกประการ ไม่ยิง network เลย
//     (สำคัญมากสำหรับ dev/test ที่เปิด index.html ตรงๆ โดยไม่มี query param — testMode.js/devTools.js ต้องยังใช้ได้)
//   - มี member_id + server มี save อยู่แล้ว (exists:true) -> hydrate SaveManager.data จาก server (server ชนะเสมอ)
//   - มี member_id + server ไม่มี save (exists:false) -> ใช้ default state ปกติของเกม (ไม่ใช่ค่าที่ค้างอยู่ใน
//     localStorage key เดิมจาก session/ผู้เล่นคนอื่นก่อนหน้าบนเครื่องเดียวกัน — key เดิมเป็น key เดียวไม่แยกตาม
//     member จึงมีโอกาสเป็นข้อมูลของคนละคนได้ ป้องกัน "รั่ว" ข้าม member โดยไม่ตั้งใจ)
//   - มี member_id แต่โหลดจาก server ไม่สำเร็จ (network/timeout/5xx) -> "load ไม่สำเร็จ" ไม่ใช่ "ไม่มี save"
//     ห้าม reset ทับ ต้องคง state ที่ SaveManager โหลดจาก localStorage มาตอนเปิดหน้าไว้ก่อน (fail-safe, กัน progress หาย)
import { resolveMemberId } from './MemberSession.js';
import { loadFromServer, saveToServer, sendBeaconSave } from './SaveApi.js';

const SAVE_DEBOUNCE_MS = 900;

let memberId = null;
let hydrateCallback = null; // ผูกจาก SaveManager.js ตอน init() เพื่อกัน circular import (SaveManager <-> SaveSync)

let debounceTimer = null;
let inFlight = false;
let dirtyWhileInFlight = false;
let latestSnapshot = null;

function scheduleFlush() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, SAVE_DEBOUNCE_MS);
}

async function flush() {
    debounceTimer = null;
    if (!memberId || latestSnapshot === null) return;

    // ห้ามยิงซ้อนกันเด็ดขาด — ถ้ามี request ค้างอยู่ ให้แค่ตั้งธง แล้วรอ request นั้นจบก่อนค่อยยิงรอบใหม่ด้วยข้อมูลล่าสุด
    // กันปัญหา response กลับมาไม่เรียงลำดับ (ของเก่าตอบช้ากว่าของใหม่) ที่จะทำให้ไฟล์บน server ย้อนกลับไปเป็นข้อมูลเก่ากว่า
    if (inFlight) {
        dirtyWhileInFlight = true;
        return;
    }

    inFlight = true;
    const payload = latestSnapshot;
    try {
        await saveToServer(memberId, payload);
    } catch (e) {
        console.warn('[SaveSync] บันทึกไป server ไม่สำเร็จ (จะลองใหม่ตอนมีการเปลี่ยนแปลงครั้งถัดไป)', e);
    } finally {
        inFlight = false;
        if (dirtyWhileInFlight) {
            dirtyWhileInFlight = false;
            flush();
        }
    }
}

// เรียกทุกครั้งที่ SaveManager.persist() ทำงาน (ทุกครั้งที่ state เปลี่ยน) — no-op ถ้ายังไม่รู้ member_id
export function scheduleSave(data) {
    if (!memberId) return;
    latestSnapshot = data;
    scheduleFlush();
}

// ตอนปิดแท็บ/เปลี่ยนหน้า ถ้ายังมี state ที่ debounce ค้างอยู่ยังไม่ได้ยิงจริง ให้พยายามยิงแบบ best-effort ครั้งสุดท้าย
// เช็ค inFlight ด้วย (ไม่ใช่แค่ debounceTimer/dirtyWhileInFlight) เพราะ fetch() ที่ค้างอยู่ระหว่างเปลี่ยนหน้าอาจถูก
// เบราว์เซอร์ตัดทิ้งกลางคันได้ — ยิง beacon สำรองด้วยข้อมูลชุดเดียวกันไปพร้อมกัน (ซ้ำได้ ไม่เป็นอันตราย เขียนทับด้วยค่าเดิม)
function flushOnUnload() {
    if (!memberId || latestSnapshot === null) return;
    if (!debounceTimer && !dirtyWhileInFlight && !inFlight) return; // ไม่มีอะไรค้าง (ยิงไปแล้วและไม่มีการเปลี่ยนแปลงต่อ)
    sendBeaconSave(memberId, latestSnapshot);
}

// promise ที่ resolve เมื่อ "รู้ผลแน่นอนแล้ว" ว่าจะใช้ state ไหน (server/local/default) — TitleScene ต้อง await
// ก่อน start BaseScene เสมอ กัน race ที่ BaseScene อ่าน SaveManager.data ไปแสดงผลก่อน hydrate เสร็จ
// resolve เสมอภายใน timeout ของ SaveApi (ไม่มีทาง hang ค้างตลอดไปแม้ network เงียบสนิท)
let readyPromise = null;

export function init({ hydrate }) {
    hydrateCallback = hydrate;

    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', flushOnUnload);
    }

    readyPromise = (async () => {
        const { memberId: resolvedId, reason } = resolveMemberId();
        if (!resolvedId) {
            console.log('[SaveSync] ไม่มี member_id (' + reason + ') — เล่นแบบ local-only เหมือนเดิม');
            return;
        }

        memberId = resolvedId;

        try {
            const result = await loadFromServer(memberId);
            if (result.exists) {
                hydrateCallback(result.data);
                console.log('[SaveSync] โหลด save จาก server สำเร็จสำหรับ member_id=' + memberId);
            } else {
                // ยังไม่เคยมี save บน server สำหรับ member นี้ -> เริ่มเกมด้วยค่า default ปกติ (ไม่ใช่ค่าเก่าที่อาจ
                // ค้างอยู่ใน localStorage จาก session/ผู้เล่นคนอื่นก่อนหน้า)
                hydrateCallback(null);
                console.log('[SaveSync] ยังไม่มี save บน server สำหรับ member_id=' + memberId + ' — เริ่มใหม่ด้วยค่า default');
            }
        } catch (e) {
            // โหลดไม่สำเร็จ (network/timeout/server error) — สำคัญมาก: ต้อง "ไม่" เรียก hydrateCallback เลย
            // ปล่อยให้ SaveManager ใช้ค่าที่โหลดจาก localStorage ไว้แต่แรกต่อไป กัน progress หายเพราะ network ล่ม
            // ไม่ต้อง retry ทันทีตรงนี้ด้วย — การเปลี่ยนแปลงจริงครั้งถัดไปตอนเล่น (upgrade/battle reward/ฯลฯ) จะ
            // เรียก persist() -> scheduleSave() ตามปกติเองอยู่แล้ว ไม่จำเป็นต้องยิง network เพิ่มตรงนี้ให้ถี่ขึ้น
            console.warn('[SaveSync] โหลด save จาก server ไม่สำเร็จ — ใช้ state ที่มีอยู่ในเครื่องต่อไปก่อน (ไม่ reset)', e);
        }
    })();
}

// ให้ Scene อื่น await ได้ว่า SaveSync พร้อมหรือยัง (TitleScene ก่อน start BaseScene)
export const SaveSync = {
    get ready() {
        return readyPromise || Promise.resolve();
    },
    scheduleSave
};
