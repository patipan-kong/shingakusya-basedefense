// Fetch wrappers ต่อ basedefense/api-basedefense — ไม่มี logic ตัดสินใจใดๆ ในไฟล์นี้ (ไม่รู้จัก SaveManager ด้วยซ้ำ)
// แค่คุยกับ API ตรงๆ แล้วโยนผลลัพธ์/error กลับให้ SaveSync.js ตัดสินใจว่าจะ hydrate/reset/เก็บ state เดิมไว้ยังไง
//
// path เป็น relative จากตำแหน่งไฟล์เกม ('../api-basedefense/') ตามโครงสร้าง repo จริง (basedefense/basedefense20260904
// อยู่คู่กับ basedefense/api-basedefense) — ถ้า deploy จริงย้ายโครงสร้างนี้ ต้องแก้ค่านี้ค่าเดียว
const API_URL = '../api-basedefense/index.php';

const REQUEST_TIMEOUT_MS = 8000;

function withTimeout(signalController) {
    const timer = setTimeout(() => signalController.abort(), REQUEST_TIMEOUT_MS);
    return () => clearTimeout(timer);
}

// โหลด save ของ member_id นี้จาก server
// คืนค่า { exists:true, data } / { exists:false, data:null } เมื่อสำเร็จ
// throw เมื่อ "โหลดไม่สำเร็จ" (network/timeout/5xx/JSON เพี้ยน) — ต้องแยกจากกรณี exists:false ให้ชัด (ดู SaveSync.js)
export async function loadFromServer(memberId) {
    const controller = new AbortController();
    const clearTimer = withTimeout(controller);
    try {
        const url = `${API_URL}?m=load&member_id=${encodeURIComponent(memberId)}`;
        const response = await fetch(url, { method: 'GET', signal: controller.signal });
        const body = await response.json();
        if (!response.ok || body.status !== 'ok') {
            throw new Error('load response not ok: ' + (body && body.error ? body.error : response.status));
        }
        return { exists: !!body.exists, data: body.exists ? body.data : null };
    } finally {
        clearTimer();
    }
}

// บันทึก save ของ member_id นี้ไป server — data ต้องเป็น plain object (จะถูก JSON.stringify ในนี้)
// throw เมื่อบันทึกไม่สำเร็จ ผู้เรียก (SaveSync.js) จะ catch ไว้เฉยๆ ไม่ทำให้เกม crash (เก็บไว้ในเครื่องแล้วผ่าน localStorage อยู่แล้ว)
export async function saveToServer(memberId, data) {
    const controller = new AbortController();
    const clearTimer = withTimeout(controller);
    try {
        const body = new URLSearchParams();
        body.set('m', 'save');
        body.set('member_id', memberId);
        body.set('data', JSON.stringify(data));

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            signal: controller.signal
        });
        const result = await response.json();
        if (!response.ok || result.status !== 'ok') {
            throw new Error('save response not ok: ' + (result && result.error ? result.error : response.status));
        }
    } finally {
        clearTimer();
    }
}

// ยิง save สุดท้ายแบบ best-effort ตอนปิดแท็บ/เปลี่ยนหน้า (ดู SaveSync.js: flushOnUnload, ผูกกับ event 'pagehide')
// sendBeacon ไม่รอ response และไม่บล็อกการปิดหน้า ไม่มี timeout ให้ตั้งเพราะ browser จัดการเอง
export function sendBeaconSave(memberId, data) {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false;
    const body = new URLSearchParams();
    body.set('m', 'save');
    body.set('member_id', memberId);
    body.set('data', JSON.stringify(data));
    const blob = new Blob([body.toString()], { type: 'application/x-www-form-urlencoded' });
    return navigator.sendBeacon(API_URL, blob);
}
