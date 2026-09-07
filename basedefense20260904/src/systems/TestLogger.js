// ระบบเก็บ Log สำหรับทดสอบสมดุลเกมโดยเฉพาะ — ไม่เกี่ยวกับ gameplay จริง ไม่มีผลต่อการเล่น
// เก็บลง localStorage คนละคีย์กับ save จริง เพื่อให้ log ไม่หายแม้รีโหลดหน้า/ปิดเบราว์เซอร์ระหว่างเล่นยาวข้ามหลาย Stage
// ใช้งาน: เล่นตามปกติจนจบ -> กดปุ่ม "COPY LOG" ที่หน้า Base -> วางส่งให้ผู้วิเคราะห์
import {
    REWARD_MULTIPLIER,
    REWARD_BASE_DAMAGE_BONUS_MAX,
    UPGRADE_COST_BY_LEVEL,
    TURRET_DAMAGE_PER_ATK_RANK,
    ENEMY_HP_PER_DURABILITY_RANK,
    ENEMY_RANK_CURVE_POWER
} from '../config/constants.js';
import { TURRET_TYPES } from '../data/turretTypes.js';

const LOG_KEY = 'basedefense_testlog_v1';

const EMPTY = { battles: [], pendingUpgrades: [] };

function load() {
    try {
        const raw = localStorage.getItem(LOG_KEY);
        if (!raw) return { ...EMPTY, battles: [], pendingUpgrades: [] };
        const parsed = JSON.parse(raw);
        return {
            battles: Array.isArray(parsed.battles) ? parsed.battles : [],
            pendingUpgrades: Array.isArray(parsed.pendingUpgrades) ? parsed.pendingUpgrades : []
        };
    } catch (e) {
        console.warn('โหลด Test Log ไม่สำเร็จ เริ่มใหม่', e);
        return { battles: [], pendingUpgrades: [] };
    }
}

function persist(data) {
    try {
        localStorage.setItem(LOG_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('บันทึก Test Log ไม่สำเร็จ', e);
    }
}

// หนีอักขระที่จะทำให้ CSV เพี้ยน (คั่นด้วย comma)
function csvCell(value) {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export const TestLogger = {
    data: load(),

    // บันทึกการซื้ออัปเกรด 1 ครั้ง — พักไว้ใน pendingUpgrades ก่อน แล้วจะไปโผล่ในแถวของ "ศึกครั้งถัดไป"
    // (เพราะสิ่งที่เราอยากรู้คือ "ก่อนลงศึกครั้งนี้ อัพอะไรมาบ้าง")
    recordUpgrade(label, newLevel, cost, goldAfter) {
        this.data.pendingUpgrades.push(`${label}->${newLevel}(${cost})`);
        this.data.lastGoldAfterUpgrade = goldAfter;
        persist(this.data);
    },

    // บันทึกผลการรบ 1 รอบ (เรียกตอนจบศึกทั้งแพ้และชนะ)
    // skillCasts: [{id, level, wave, hpPercent}] ต่อการร่ายสกิล 1 ครั้ง (แทน skillsUsed แบบเดิมที่รู้แค่ชื่อ ไม่รู้เลเวล/จังหวะ)
    // enemyKillBreakdown: {typeId: count} — สรุปศัตรูที่ฆ่าแยกชนิด (ดึงจาก killedEnemyCounts ที่ตัวเกมคำนวณรางวัลอยู่แล้ว)
    // turretDamage/turretKills: array 5 ช่อง เรียงตามลำดับป้อมเดียวกับ turretLevels
    // channel: 'battleStart' | 'battleList' | 'simulation' | 'testMode' — ช่องทางที่เริ่มศึกครั้งนี้
    recordBattle({
        stage, result, waveReached, baseDamagePercent, goldEarned, goldBalance,
        turretLevels, baseLevel, skillCasts, enemyKillBreakdown,
        turretDamage, turretKills, quizCorrect, quizWrong,
        minBaseHPPercent, maxGameSpeed, channel, durationSec, botProfile
    }) {
        // นับ attempt แยกตาม botProfile ด้วย ไม่ใช่แค่ stage อย่างเดียว — กันไม่ให้เลขพองข้ามโปรไฟล์ตอนบอทวนหลายโปรไฟล์ใน TestLogger เดียวกัน
        // (TestLogger ไม่ reset ระหว่างโปรไฟล์โดยตั้งใจ เพื่อรวม CSV เดียวจบทั้งคิว — เล่นเองด้วยมือทุกแถวมี botProfile='-' เหมือนกันหมด จึงพฤติกรรมเดิมทุกอย่าง)
        const resolvedBotProfile = botProfile ?? '-';
        const attempt = this.data.battles.filter((b) => b.stage === stage && b.botProfile === resolvedBotProfile).length + 1;

        this.data.battles.push({
            stage,
            attempt,
            result,
            waveReached,
            baseDamagePercent,
            goldEarned,
            goldBalance,
            turretLevels: turretLevels.join('/'),
            baseLevel,
            skillCasts: skillCasts.length ? skillCasts.map((c) => `${c.id}:L${c.level}:w${c.wave}:hp${c.hpPercent}%`).join('|') : '-',
            upgradesBefore: this.data.pendingUpgrades.length ? this.data.pendingUpgrades.join(' ') : '-',
            enemyKills: Object.keys(enemyKillBreakdown).length ? Object.entries(enemyKillBreakdown).map(([id, count]) => `${id}:${count}`).join('/') : '-',
            turretDamage: turretDamage.map((d) => Math.round(d)).join('/'),
            turretKills: turretKills.join('/'),
            quizCorrect,
            quizWrong,
            minBaseHPPercent,
            maxGameSpeed,
            channel,
            durationSec,
            botProfile: resolvedBotProfile
        });

        this.data.pendingUpgrades = [];
        persist(this.data);
    },

    getBattleCount() {
        return this.data.battles.length;
    },

    // แปลง log ทั้งหมดเป็นข้อความ CSV พร้อมส่งให้วิเคราะห์
    // บรรทัด # ด้านบนคือค่าคงที่สมดุลของบิลด์ที่ใช้เล่น เพื่อกันสับสนว่า log นี้มาจากเวอร์ชันไหน
    export() {
        // ราคาตายตัวเดียวกับที่ UpgradeScene ใช้จริง (ดู upgrade.js getCost) — ป้อมปืนกับฐานทัพราคาเท่ากันทุกเลเวล
        const turretCosts = UPGRADE_COST_BY_LEVEL;
        const baseCosts = UPGRADE_COST_BY_LEVEL;
        const treeTotal = turretCosts.reduce((a, b) => a + b, 0) * 5 + baseCosts.reduce((a, b) => a + b, 0);
        // ดึงลำดับสีจริงจาก TURRET_TYPES ตรงๆ (ไม่ hardcode) กันคอมเมนต์ค้างผิดถ้าลำดับป้อมถูกสลับอีกในอนาคต — ใช้ร่วมกันทั้ง turretLevels/turretDamage/turretKills เพราะเรียงลำดับเดียวกันหมด
        const turretOrderLabel = TURRET_TYPES.map((t) => t.nameTh.replace('ป้อมสี', '').replace('ป้อม ', '')).join('/');

        const header = [
            '# BaseDefense Test Log',
            '# exported: ' + new Date().toISOString(),
            `# REWARD_MULTIPLIER=${REWARD_MULTIPLIER} REWARD_BASE_DAMAGE_BONUS_MAX=${REWARD_BASE_DAMAGE_BONUS_MAX}`,
            `# TURRET_DAMAGE_PER_ATK_RANK=${TURRET_DAMAGE_PER_ATK_RANK} ENEMY_HP_PER_DURABILITY_RANK=${ENEMY_HP_PER_DURABILITY_RANK} ENEMY_RANK_CURVE_POWER=${ENEMY_RANK_CURVE_POWER}`,
            `# UPGRADE_COST turret=${turretCosts.join('/')} base=${baseCosts.join('/')} treeTotal=${treeTotal}`,
            `# turretLevels/turretDamage/turretKills เรียงตาม: ${turretOrderLabel}`,
            '# skillCasts รูปแบบ: id:Lเลเวล:wWave:hpX% คั่นด้วย | ต่อการร่าย 1 ครั้ง (เช่น bomb:L2:w3:hp72%) — ไม่เคยร่าย = "-"',
            '# enemyKills รูปแบบ: typeId:count คั่นด้วย / — ไม่มีการฆ่า = "-"',
            "# channel: battleStart=กดปุ่มเล่นปกติ / battleList=เล่นด่านเก่าซ้ำ / simulation=โหมดจำลอง / testMode=ตั้งค่า Stage/เลเวลเองจากโหมดทดสอบ",
            '# botProfile: "อัพเกรด+สกิล" ตอนเล่นผ่าน AutoPlayBot (ดู src/systems/AutoPlayBot.js) — เล่นเองด้วยมือ = "-"',
            '# minBaseHPPercent = HP ฐานทัพ % ต่ำสุดที่เคยเหลือระหว่างเล่น (ไม่ใช่ HP ตอนจบ — ใช้ดูว่าเฉียดตายแค่ไหน)',
            ''
        ].join('\n');

        const cols = [
            'stage', 'attempt', 'result', 'waveReached', 'baseDamagePercent', 'goldEarned', 'goldBalance',
            'turretLevels', 'baseLevel', 'skillCasts', 'upgradesBefore', 'enemyKills',
            'turretDamage', 'turretKills', 'quizCorrect', 'quizWrong',
            'minBaseHPPercent', 'maxGameSpeed', 'channel', 'durationSec', 'botProfile'
        ];
        const rows = this.data.battles.map((b) => cols.map((c) => csvCell(b[c])).join(','));

        return header + cols.join(',') + '\n' + rows.join('\n') + '\n';
    },

    reset() {
        this.data = { battles: [], pendingUpgrades: [] };
        persist(this.data);
    }
};

// เปิดให้เรียกผ่าน DevTools console ได้ด้วย (ES Module ไม่ auto-global) — เผื่อปุ่มคัดลอกมีปัญหา
if (typeof window !== 'undefined') {
    window.TestLogger = TestLogger;
    window.dumpTestLog = () => {
        const text = TestLogger.export();
        console.log(text);
        return text;
    };
}
