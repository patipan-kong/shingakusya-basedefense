import { STAGE_CONFIG, generateStageWaves } from '../data/stages.js';
import { WAVE_COMPLETE_DELAY_MS, WAVES_PER_STAGE, DEPTH_ENTITY_UI, FONT_FAMILY } from '../config/constants.js';

// Fisher-Yates สับไพ่แบบ in-place คืน array เดิม — ใช้สับลำดับ spawn ของ Wave ให้ชนิดศัตรูที่กำหนดไว้ตายตัวดูสุ่มปนกัน ไม่ใช่ยิงเป็นก้อนทีละชนิด
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// จัดการวงจรชีวิตของ Wave ภายใน "1 Stage" เดียว (10 Wave) ต่อการเล่น 1 รอบ — MapScene 1 session = 1 Stage เท่านั้น
// เคลียร์ Wave สุดท้าย (ที่ 10) ของ Stage นี้ = จบ session ทันที (เรียก onStageComplete) ไม่ต่อไป Stage ถัดไปในเซสชันเดียวกันอีกต่อไป
// (ผู้เล่นต้องกลับหน้า Base แล้วกด Battle Start ใหม่ถึงจะไป Stage ถัดไป — ดู MapScene.onStageClear() / BaseScene)
// ข้อยกเว้น: Simulation Mode (infinite:true) ไม่กลับ Base ระหว่างเคลียร์ Stage — ใช้ advanceToStage() ต่อ Stage ถัดไปในเซสชันเดียวกันแทน
// แยกออกจาก MapScene เพื่อให้แก้ไข-ทดสอบ Wave logic ได้โดยไม่ต้องแตะโค้ดฉากทั้งไฟล์
export class WaveManager {
    constructor(scene, { stageNumber, spawnEnemy, onStageComplete, infinite = false }) {
        this.scene = scene;
        this.spawnEnemy = spawnEnemy; // (typeId, elementId) => void — ให้ MapScene เป็นคนสร้าง Enemy Sprite จริง
        this.onStageComplete = onStageComplete; // (isFinalStage: boolean) => void — เรียกเมื่อเคลียร์ Wave สุดท้ายของ Stage นี้สำเร็จ
        this.infinite = infinite; // true = Simulation Mode: ไม่มี Stage สุดท้าย ไม่มีวันจบ (isFinalStage เป็น false เสมอ)

        this.currentWaveIndex = 0; // index ภายใน Stage นี้ (0-9)
        this.enemiesSpawned = 0;
        this.enemiesRemaining = 0;
        this.spawnTimer = null;
        this.stopped = false;

        this.waveText = null;
        this.enemiesLeftText = null;

        this.setStage(stageNumber);
    }

    // หา waves ของ Stage นี้: ใช้ STAGE_CONFIG ที่เตรียมไว้ล่วงหน้าถ้ามี (Stage 1-50 ปกติ)
    // ไม่มีก็ตกไปที่ generateStageWaves() ซึ่งคืน Wave ของ Stage สุดท้ายซ้ำ (Stage เกิน 50 — ใช้เฉพาะ Simulation Mode)
    setStage(stageNumber) {
        this.stageNumber = stageNumber; // เลข Stage (1-based) ที่จะเล่น
        const stageConfig = STAGE_CONFIG.find((stage) => stage.id === stageNumber);
        this.waves = stageConfig ? stageConfig.waves : generateStageWaves(stageNumber, WAVES_PER_STAGE);
        this.isFinalStage = !this.infinite && stageNumber >= STAGE_CONFIG[STAGE_CONFIG.length - 1].id; // Simulation Mode ไม่มี Stage สุดท้าย
    }

    // สร้าง UI ข้อความ Stage/Wave / Enemies Left (เรียกครั้งเดียวตอน create() ของ Scene)
    createUI() {
        const screenW = this.scene.cameras.main.width;

        this.waveText = this.scene.add.text(screenW / 2, 70, '', {
            fontFamily: FONT_FAMILY, fontSize: '22px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0).setDepth(DEPTH_ENTITY_UI);

        // เว้นระยะจากขอบขวามากกว่าเดิม (15->50) กันชนกับปุ่ม Pause มุมบนขวาของ MapScene
        this.enemiesLeftText = this.scene.add.text(screenW/2+50, 30, 'Enemies Left: 0', {
            fontFamily: FONT_FAMILY, fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(1, 0).setDepth(DEPTH_ENTITY_UI+1);

        this.createEnemiesLeftBar(20, 20);
    }

    // ==========================================
    // แถบ Enemies Left (ภาพจริง) — โครงสร้างเดียวกับแถบ HP ฐานทัพใน map.js (frame + minus + fill ตัด mask)
    // frame 526x41, minus/fill 514x27 เว้นขอบ 6px แนวนอน / 7px แนวตั้ง (วัดจากไฟล์จริง)
    // ==========================================
    createEnemiesLeftBar(x, y) {
        const innerX = x + 6;
        const innerY = y + 5;
        this.enemiesLeftBarInnerX = innerX;
        this.enemiesLeftBarInnerY = innerY;
        this.enemiesLeftBarInnerW = 514;
        this.enemiesLeftBarInnerH = 27;

        this.scene.add.image(innerX, innerY, 'enemy_hp_minus').setOrigin(0, 0).setDepth(DEPTH_ENTITY_UI);

        this.enemiesLeftBarFillImg = this.scene.add.image(innerX, innerY, 'enemy_hp_fill').setOrigin(0, 0).setDepth(DEPTH_ENTITY_UI);
        this.enemiesLeftBarMaskGfx = this.scene.make.graphics({}, false); // ไม่ add เข้าฉาก ใช้แค่เป็นเรขาคณิตของ mask
        this.enemiesLeftBarFillImg.setMask(new Phaser.Display.Masks.GeometryMask(this.scene, this.enemiesLeftBarMaskGfx));

        this.scene.add.image(x, y, 'enemy_hp_frame').setOrigin(0, 0).setDepth(DEPTH_ENTITY_UI); // กรอบทับบนสุด ปิดขอบ minus/fill ให้เนียน

        this.enemiesLeftBarState = { fillWidth: this.enemiesLeftBarInnerW }; // ค่าที่ tween จริง — เริ่มเต็มแถบตรงกับ Wave แรกที่ยังไม่มีใครตาย
        this.updateEnemiesLeftBar();
    }

    // ตัด mask ของ enemy_hp_fill ให้กว้างตามสัดส่วนศัตรูที่เหลือ/ทั้งหมดใน Wave ปัจจุบัน
    // tween ความกว้างเข้าเป้าหมายใหม่แบบสมูท ไม่ใช่กระโดดทันที (เหมือนแถบ HP ฐานทัพ/เกจสกิลใน map.js)
    updateEnemiesLeftBar() {
        if (!this.enemiesLeftBarMaskGfx) return;

        const wave = this.waves[this.currentWaveIndex];
        const total = wave ? wave.totalEnemies : 0;
        const percent = total > 0 ? Phaser.Math.Clamp(this.enemiesRemaining / total, 0, 1) : 0;
        const targetFillWidth = this.enemiesLeftBarInnerW * percent;

        this.scene.tweens.killTweensOf(this.enemiesLeftBarState);
        this.scene.tweens.add({
            targets: this.enemiesLeftBarState,
            fillWidth: targetFillWidth,
            duration: 300,
            ease: 'Sine.easeOut',
            onUpdate: () => this.drawEnemiesLeftBarFill()
        });
    }

    // วาด mask จริงตามค่า enemiesLeftBarState.fillWidth ปัจจุบัน (เรียกทุกเฟรมระหว่าง tween กำลังวิ่ง)
    drawEnemiesLeftBarFill() {
        const gfx = this.enemiesLeftBarMaskGfx;
        gfx.clear();
        gfx.fillStyle(0xffffff);
        gfx.fillRect(this.enemiesLeftBarInnerX, this.enemiesLeftBarInnerY, this.enemiesLeftBarState.fillWidth, this.enemiesLeftBarInnerH);
    }

    // เริ่ม Wave แรกของ Stage นี้
    start() {
        this.startWave(0);
    }

    // (เฉพาะ Simulation Mode) ต่อไป Stage ถัดไปในเซสชันเดียวกัน โดยไม่สร้าง WaveManager/UI text object ใหม่
    advanceToStage(newStageNumber) {
        this.setStage(newStageNumber);
        this.currentWaveIndex = 0;
        this.enemiesSpawned = 0;
        this.enemiesRemaining = 0;
        this.startWave(0);
    }

    // หยุด Wave Manager ทั้งหมด (เรียกตอนเกมจบ ไม่ว่าแพ้หรือชนะ — ถาวร ไม่มี resume)
    stop() {
        this.stopped = true;
        if (this.spawnTimer) {
            this.spawnTimer.remove();
            this.spawnTimer = null;
        }
    }

    // หยุดปล่อยศัตรูชั่วคราว (ใช้ตอนกด Pause) — ต่างจาก stop() ตรงที่ resume() กลับมาได้
    pause() {
        if (this.spawnTimer) this.spawnTimer.paused = true;
    }

    resume() {
        if (this.spawnTimer) this.spawnTimer.paused = false;
    }

    // เริ่ม Wave ตาม index ภายใน Stage นี้ (0-9) หรือแจ้งเคลียร์ Stage สำเร็จถ้าไม่มี Wave ถัดไปแล้ว
    startWave(waveIndex) {
        if (waveIndex >= this.waves.length) {
            this.onStageComplete(this.isFinalStage);
            return;
        }

        const wave = this.waves[waveIndex];
        this.currentWaveIndex = waveIndex;
        this.enemiesSpawned = 0;
        this.enemiesRemaining = wave.totalEnemies;
        // สับไพ่ลำดับ spawn ใหม่ทุกครั้งที่ Wave เริ่ม — เก็บไว้ที่ instance นี้ ไม่ยุ่งกับ wave.slots ต้นฉบับใน STAGE_CONFIG
        // (Simulation Mode เรียก Stage สุดท้ายซ้ำได้หลายรอบ ต้อง shuffle ใหม่ทุกครั้ง ไม่ใช่ mutate array เดิมทิ้งไว้)
        this.spawnQueue = shuffle(wave.slots.flatMap((s) => Array(s.count).fill({ type: s.type, element: s.element })));

        this.waveText.setText(`Stage ${this.stageNumber} - Wave ${waveIndex + 1}/${WAVES_PER_STAGE}`);
        this.enemiesLeftText.setText(`Enemies Left: ${this.enemiesRemaining}`);
        this.updateEnemiesLeftBar();

        if (this.spawnTimer) {
            this.spawnTimer.remove();
        }
        this.spawnTimer = this.scene.time.addEvent({
            delay: wave.spawnInterval,
            loop: true,
            callback: () => this.spawnTick(wave)
        });
    }

    // ปล่อยศัตรู 1 ตัวตามลำดับใน spawnQueue (สับไพ่ไว้แล้วตอน startWave) แล้วหยุดปล่อยเมื่อครบจำนวน
    // เช็ค enemiesSpawned ก่อนอ่านคิวเสมอ กัน edge case ที่ timer ยิง tick สุดท้ายซ้ำอีกครั้งก่อน .remove() มีผลจริง
    // (ช่วง delay สั้นมากตอนเร่งความเร็วสูง) ซึ่งจะทำให้ shift() คืน undefined จากคิวที่ว่างแล้ว
    spawnTick(wave) {
        if (this.stopped || this.enemiesSpawned >= wave.totalEnemies) return;

        const next = this.spawnQueue.shift();
        this.spawnEnemy(next.type, next.element);
        this.enemiesSpawned++;

        if (this.enemiesSpawned >= wave.totalEnemies && this.spawnTimer) {
            this.spawnTimer.remove();
            this.spawnTimer = null;
        }
    }

    // เรียกทุกครั้งที่ศัตรู 1 ตัว "จบชีวิต" ในสนาม (ถูกทำลาย หรือหลุดไปชนฐาน) เพื่ออัปเดต Enemies Left และเช็คจบ Wave
    resolveEnemy() {
        if (this.stopped) return;

        this.enemiesRemaining = Math.max(0, this.enemiesRemaining - 1);
        this.enemiesLeftText.setText(`Enemies Left: ${this.enemiesRemaining}`);
        this.updateEnemiesLeftBar();

        if (this.enemiesRemaining <= 0) {
            this.completeWave();
        }
    }

    // Wave ปัจจุบันเคลียร์ครบแล้ว: ถ้าเป็น Wave สุดท้ายของ Stage นี้ (ที่ 10) ให้จบ session ทันที (ไม่มีข้อความคั่น เพราะ MapScene จะโชว์หน้าสรุปผล Stage เต็มรูปแบบต่อเลย)
    // ไม่งั้นแสดงข้อความ WAVE COMPLETE ปกติ แล้วเริ่ม Wave ถัดไปหลัง 3 วินาที (ยังอยู่ Stage เดิม)
    completeWave() {
        const isLastWaveOfStage = this.currentWaveIndex >= this.waves.length - 1;

        if (isLastWaveOfStage) {
            this.onStageComplete(this.isFinalStage);
            return;
        }

        const cx = this.scene.cameras.main.centerX;
        const cy = this.scene.cameras.main.centerY;

        const completeText = this.scene.add.text(cx, cy, 'WAVE COMPLETE', {
            fontFamily: FONT_FAMILY, fontSize: '48px',
            fill: '#2ecc71',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(DEPTH_ENTITY_UI);

        this.scene.time.delayedCall(WAVE_COMPLETE_DELAY_MS, () => {
            completeText.destroy();
            if (!this.stopped) {
                this.startWave(this.currentWaveIndex + 1);
            }
        });
    }
}
