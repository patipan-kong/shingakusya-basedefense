// เก็บคลังคำถาม + สุ่มแจกแบบไม่ซ้ำจนกว่าคำถามจะหมดแล้วค่อยวนใหม่ (Fisher-Yates สับสำเนา ไม่ใช่ pool จริง)
// แยกเป็น 2 คลังอิสระต่อกัน ('base' กับ 'play') เพราะ Quiz Gate ตอนอัปเกรดฐาน/ป้อม กับตอนใช้สกิลระหว่างรบ
// ต้องใช้คำถามคนละชุดกัน (ดู QuizGate.requestQuizGate ที่ต้องระบุชื่อคลังทุกครั้งที่เรียก)
// ตั้งค่าคลังครั้งเดียวตอน PreloadScene โหลด+รวมไฟล์รายวิชาย่อยจาก assets/quiz_base/ และ assets/quiz_play/ เสร็จ (ดู PreloadScene.create())
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const EMPTY_QUIZ = {
    quiz_text: '(No questions in bank)',
    quiz_imagefile: '',
    right_answer: 1,
    choice_type: 0,
    choice_text1: '-', choice_text2: '-', choice_text3: '-', choice_text4: '-',
    choice_imagefile1: '', choice_imagefile2: '', choice_imagefile3: '', choice_imagefile4: ''
};

const banks = {}; // { [bankName]: { pool: [], remaining: [] } }

function getOrCreateBank(bankName) {
    if (!banks[bankName]) banks[bankName] = { pool: [], remaining: [] };
    return banks[bankName];
}

export const QuizBank = {
    setPool(bankName, list) {
        const bank = getOrCreateBank(bankName);
        bank.pool = Array.isArray(list) ? list : [];
        bank.remaining = [];
    },

    // ดึงคำถาม 1 ข้อจากคลังที่ระบุ — สับใหม่อัตโนมัติเมื่อคิวหมด (การันตีไม่ซ้ำจนกว่าจะครบทุกข้อในคลังนั้น)
    draw(bankName) {
        const bank = banks[bankName];
        if (!bank || bank.pool.length === 0) {
            // กันเหตุคลังว่าง/ไม่รู้จักชื่อ (เช่น โหลด json ไม่สำเร็จ หรือพิมพ์ชื่อคลังผิด) ไม่ให้เกมพังตอนเปิด QuizScene
            return EMPTY_QUIZ;
        }

        if (bank.remaining.length === 0) bank.remaining = shuffle([...bank.pool]);
        return bank.remaining.pop();
    },

    // รายการคำถามทั้งหมดตามลำดับจริงในคลัง (ไม่สุ่ม) — ใช้เฉพาะหน้าพรีวิว QA (ดู quizPreview.js)
    getPool(bankName) {
        return (banks[bankName] && banks[bankName].pool) || [];
    }
};
