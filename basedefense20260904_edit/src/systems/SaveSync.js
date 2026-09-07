// เชื่อม SaveManager (in-memory state จริงที่เกมอ่าน/เขียนตลอดเวลา) เข้ากับ api-basedefense (server — ตัว
// authoritative หนึ่งเดียวสำหรับ gameplay save เมื่อมี member_id ไม่มี localStorage เกี่ยวข้องเลย) — เป็นจุดเดียวที่
// ตัดสินใจว่าจะ hydrate/reset ตอนไหน และเป็นจุดเดียวที่คุมจังหวะการยิง save ไป server (debounce + serialize)
//
// กติกา (ดูรายละเอียดเหตุผลใน README ของ api-basedefense):
//   - ไม่มี member_id (d/i ไม่มี/ถอดรหัสไม่ผ่าน) -> เล่นแบบเซสชันชั่วคราวในหน่วยความจำล้วนๆ ไม่มีการบันทึกถาวรที่ไหน
//     เลย (ไม่ยิง network, ไม่เขียน localStorage) — สำคัญมากสำหรับ dev/test ที่เปิด index.html ตรงๆ โดยไม่มี query
//     param (testMode.js/devTools.js ต้องยังเล่นได้ แค่ progress จะหายเมื่อรีโหลดหน้า ซึ่งเป็นเรื่องปกติของโหมดนี้)
//   - มี member_id + server มี save อยู่แล้ว (exists:true) -> hydrate SaveManager.data จาก server
//   - มี member_id + server ไม่มี save (exists:false) -> ใช้ default state ปกติของเกม (ยืนยันจาก server แล้วว่า
//     เป็นผู้เล่นใหม่จริงๆ ไม่ใช่แค่เดาจากการไม่มี local cache)
//   - มี member_id แต่โหลดจาก server ไม่สำเร็จ (network/timeout/5xx/JSON เพี้ยน) -> "load ไม่สำเร็จ" ไม่ใช่ "ไม่มี
//     save" ต้อง "ไม่" hydrate และต้อง "ไม่" ปล่อยให้เกมเริ่มเล่นด้วย default (จะเสี่ยง save ทับของจริงบน server
//     ทีหลัง) — resolve ready เป็น {ok:false} ให้ TitleScene บล็อกไม่ให้เข้าเกม (ดู title.js) ไม่มี fallback ไป
//     localStorage ใดๆ ทั้งสิ้นเพราะไม่มี localStorage cache ให้ fallback ไปแล้ว
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

// ตอนปิดแท็บ/เปลี่ยนหน้า ถ้ายังมี state ที่ debounce ค้างอยู่ (ตั้ง timer ไว้แต่ยังไม่ทันยิง) ให้พยายามยิงแบบ
// best-effort ครั้งสุดท้ายด้วย sendBeacon
//
// สำคัญ: ต้อง "ไม่" ยิง beacon ตอนมี request อื่นค้างอยู่ (inFlight) แม้จะมีข้อมูลใหม่กว่ารออยู่ก็ตาม (dirtyWhileInFlight)
// เพราะ beacon กับ fetch ที่ inFlight อยู่เป็นคนละ request ที่ไม่ได้เข้าคิวเดียวกัน ถ้าเบราว์เซอร์ส่งถึง server ไม่เรียง
// ลำดับ (beacon ซึ่งมีข้อมูลใหม่กว่าไปถึงก่อน แล้ว fetch เก่าที่ค้างอยู่เพิ่งไปถึงทีหลัง) ไฟล์บน server จะย้อนกลับไป
// เป็นข้อมูลเก่ากว่าได้ — ยอมรับความเสี่ยงเล็กน้อยที่ fetch ที่ inFlight อยู่อาจถูกเบราว์เซอร์ตัดทิ้งกลางคันตอนปิดแท็บ
// แทน (ข้อจำกัดปกติของทุกเว็บแอปที่ save ตอน unload ไม่ใช่บั๊กที่เกิดจากโค้ดนี้) ดีกว่าเสี่ยงข้อมูลย้อนกลับไปเก่ากว่า
function flushOnUnload() {
    if (!memberId || latestSnapshot === null) return;
    if (inFlight || !debounceTimer) return; // ไม่มี request ค้าง (idle) เท่านั้นถึงจะยิง beacon ได้อย่างปลอดภัย
    sendBeaconSave(memberId, latestSnapshot);
}

// promise ที่ resolve เป็น { ok, reason } เมื่อ "รู้ผลแน่นอนแล้ว" ว่าจะใช้ state ไหน (server/default/ชั่วคราวในเครื่อง)
// TitleScene ต้อง await ก่อน start BaseScene เสมอ และต้องเช็ค ok — ถ้า ok:false (โหลดจาก server ไม่สำเร็จ) ต้องบล็อก
// ไม่ให้เข้าเกมเลย (ดู title.js) resolve เสมอภายใน timeout ของ SaveApi (ไม่มีทาง hang ค้างตลอดไปแม้ network เงียบสนิท)
//
// reason ที่เป็นไปได้:
//   'no_member'   - ไม่มี member_id เล่นแบบเซสชันชั่วคราวในหน่วยความจำ (ok:true)
//   'hydrated'    - โหลดจาก server สำเร็จ มี save อยู่แล้ว (ok:true)
//   'fresh'       - โหลดจาก server สำเร็จ แต่ยังไม่มี save (ok:true, ใช้ default)
//   'load_failed' - โหลดจาก server ไม่สำเร็จ (ok:false, ต้องบล็อกการเริ่มเกม)
let readyPromise = null;

function init({ hydrate }) {
    hydrateCallback = hydrate;

    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', flushOnUnload);
    }

    readyPromise = (async () => {
        const { memberId: resolvedId, reason } = resolveMemberId();
        if (!resolvedId) {
            console.log('[SaveSync] ไม่มี member_id (' + reason + ') — เล่นแบบเซสชันชั่วคราวในหน่วยความจำ ไม่มีการบันทึกถาวรใดๆ');
            return { ok: true, reason: 'no_member' };
        }

        memberId = resolvedId;

        try {
            const result = await loadFromServer(memberId);
            if (result.exists) {
                hydrateCallback(result.data);
                console.log('[SaveSync] โหลด save จาก server สำเร็จสำหรับ member_id=' + memberId);
                return { ok: true, reason: 'hydrated' };
            }
            // ยังไม่เคยมี save บน server สำหรับ member นี้ -> เริ่มเกมด้วยค่า default ปกติ
            hydrateCallback(null);
            console.log('[SaveSync] ยังไม่มี save บน server สำหรับ member_id=' + memberId + ' — เริ่มใหม่ด้วยค่า default');
            return { ok: true, reason: 'fresh' };
        } catch (e) {
            // โหลดไม่สำเร็จ (network/timeout/server error/JSON เพี้ยน) — สำคัญมาก: ต้อง "ไม่" เรียก hydrateCallback
            // เลย และต้อง "ไม่" ปล่อยให้เกมเริ่มเล่นด้วย default (ไม่มี localStorage ให้ fallback แล้ว จะเสี่ยง save
            // ทับ progress จริงบน server ทีหลังถ้าปล่อยให้เล่นต่อ) — ผู้เรียก (title.js) ต้องบล็อกการเริ่มเกมเมื่อเห็น ok:false
            console.error('[SaveSync] โหลด save จาก server ไม่สำเร็จ — บล็อกการเริ่มเกม (กัน progress หายเพราะ save ทับด้วย default)', e);
            return { ok: false, reason: 'load_failed' };
        }
    })();
}

// ให้ Scene อื่น await ได้ว่า SaveSync พร้อมหรือยัง พร้อมผลลัพธ์ (TitleScene ก่อน start BaseScene)
export const SaveSync = {
    init,
    get ready() {
        return readyPromise || Promise.resolve({ ok: true, reason: 'not_initialized' });
    },
    scheduleSave
};
