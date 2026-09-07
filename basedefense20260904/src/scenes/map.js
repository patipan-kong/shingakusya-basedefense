import { WaveManager } from '../systems/WaveManager.js';
import { SaveManager } from '../systems/SaveManager.js';
import { TestLogger } from '../systems/TestLogger.js';
import { requestQuizGate } from '../systems/QuizGate.js';
import { AutoPlayBot } from '../systems/AutoPlayBot.js';
import { getTurretDamage, getTurretFireDelay } from '../systems/turretStats.js';
import { getBaseMaxHp, getBaseRegenPercent as calcBaseRegenPercent } from '../systems/baseStats.js';
import { getEnemyHp, getEnemyDamage } from '../systems/enemyStats.js';
import { getEnemyTypeById, ENEMY_TYPES } from '../data/enemyTypes.js';
import { TURRET_TYPES } from '../data/turretTypes.js';
import { ELEMENTS } from '../data/elements.js';
import {
    BASE_WIDTH,
    BASE_HEIGHT,
    BASE_HIT_SHAKE_DURATION_MS,
    BASE_HIT_SHAKE_INTENSITY,
    TURRET_COUNT,
    TURRET_MARGIN_X,
    TURRET_Y_OFFSET_FROM_BASE_TOP,
    TURRET_FIRE_STAGGER_MS,
    TURRET_SPREAD_ANGLE_DEG,
    TURRET_ROTATION_SPEED_RAD_PER_SEC,
    TURRET_RANGE_PX,
    BARREL_LENGTH,
    BULLET_SPEED,
    ENEMY_SPAWN_MARGIN_X,
    ENEMY_HIT_FLASH_DURATION_MS,
    ENEMY_HIT_FLASH_SCALE_MULTIPLIER,
    ENEMY_SPEED_PER_RANK,
    ENEMY_RANGED_ATTACK_RANGE_PX,
    ENEMY_RANGED_FIRE_INTERVAL_MS,
    ENEMY_RANGED_DAMAGE_MULTIPLIER,
    ENEMY_RANGED_PROJECTILE_SPEED,
    ELEMENT_MATCH_DAMAGE_MULTIPLIER,
    BULLET_CLEANUP_Y,
    ENEMY_CLEANUP_Y,
    COLOR_BASE,
    COLOR_ENEMY_HIT_FLASH,
    REWARD_BASE_DAMAGE_BONUS_MAX,
    REWARD_MULTIPLIER,
    BASE_HP_REGEN_TICK_MS,
    SKILL_MAX_CHARGE,
    SKILL_KILLS_PER_CHARGE,
    SKILL_BOMB_BASE_RADIUS,
    SKILL_BOMB_RADIUS_PER_LEVEL,
    SKILL_BOMB_BASE_DAMAGE,
    SKILL_BOMB_DAMAGE_PER_LEVEL,
    SKILL_BOMB_BURST_VISUAL_MS,
    SKILL_BOMB_FIRE_TICK_DAMAGE,
    SKILL_BOMB_FIRE_TICK_DAMAGE_PER_LEVEL,
    SKILL_BOMB_FIRE_TICK_MS,
    SKILL_BOMB_FIRE_DURATION_MS,
    SKILL_LASER_WIDTH,
    SKILL_LASER_VISUAL_MS,
    SKILL_LASER_BASE_DAMAGE,
    SKILL_LASER_DAMAGE_PER_LEVEL,
    SKILL_PLASMA_WIDTH,
    SKILL_PLASMA_DURATION_MS,
    SKILL_PLASMA_TICK_MS,
    SKILL_PLASMA_TICK_DAMAGE_BASE,
    SKILL_PLASMA_TICK_DAMAGE_PER_LEVEL,
    DEPTH_BACKGROUND,
    DEPTH_BASE_DECOR,
    DEPTH_ENTITY_UI,
    DEPTH_OVERLAY,
    WAVE_COMPLETE_DELAY_MS,
    FONT_FAMILY,
    SHOW_SPEED_BUTTONS
} from '../config/constants.js';

export class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
    }

    create(data) {
        // ==========================================
        // ค่าคงที่ของหน้าจอ (แนวตั้ง 640x840)
        // ==========================================
        const screenW = this.cameras.main.width;   // 640
        const screenH = this.cameras.main.height;  // 840

        this.cameras.main.setBackgroundColor('#2c3e50');

        // ภาพพื้นหลังหน้าต่อสู้ — ขนาดเท่าจอพอดี (640x840) วางไว้หลังสุดเสมอ (DEPTH_BACKGROUND)
        this.add.image(screenW / 2, screenH / 2, 'gameplay_bg').setDepth(DEPTH_BACKGROUND);

        // ศูนย์วิจัย (มุมซ้ายล่างของจอ) — spritesheet 5 เฟรม (512x220/เฟรม) เฟรมเปลี่ยนตามเลเวลฐานทัพจริง (เลเวล 1-5 -> เฟรม 0-4)
        const researchCenterFrame = SaveManager.getBaseLevel() - 1;
        this.add.sprite(0, screenH, 'research_center', researchCenterFrame).setOrigin(0, 1).setDepth(DEPTH_BASE_DECOR);

        // Stage ที่จะเล่น: มาจาก data ที่ BaseScene ส่งมาตอน scene.start('MapScene', { stage }) เป็นหลัก
        // fallback ไปที่ SaveManager.getCurrentStage() เผื่อเข้าฉากนี้โดยไม่ได้ส่ง data มา (เช่น debug ผ่าน console)
        this.stageNumber = (data && data.stage) || SaveManager.getCurrentStage();
        this.isInfiniteMode = !!(data && data.infinite); // true = Simulation Mode (โหมดจำลอง) — ไม่มีวันจบ ไม่แตะ SaveManager.currentStage
        this.channel = (data && data.channel) || 'battleStart'; // ช่องทางที่เริ่มศึกครั้งนี้ (สำหรับ TestLogger) — ไม่ระบุ = ถือว่าเป็นปุ่ม Battle Start ปกติ (เผื่อเรียกผ่าน console)

        // ==========================================
        // Reset สถานะเกม (สำคัญเวลาเข้า Scene นี้ซ้ำ)
        // ==========================================
        // Max HP ฐานทัพผันตามเลเวล Passive Skill ที่ผู้เล่นอัปไว้ (ดู UpgradeScene / SaveManager.getBaseLevel()) — สูตรอยู่ที่ baseStats.js (ใช้ร่วมกับ UpgradeScene)
        this.baseHP = getBaseMaxHp(SaveManager.getBaseLevel());
        this.baseMaxHP = this.baseHP; // เก็บค่าตั้งต้นไว้คำนวณ % ความเสียหายฐานตอนจบเกม (this.baseHP จะลดลงเรื่อยๆ ระหว่างเล่น)
        this.isGameOver = false;
        this.isPaused = false;
        this.gameSpeed = 1; // ตัวคูณความเร็วเกม (1/2/3/4/5x) — reset ทุกครั้งที่เข้าฉากนี้ใหม่ กันค่าจาก session ก่อนหน้าค้าง
        this.time.timeScale = 1;
        this.physics.world.timeScale = 1;
        this.tweens.timeScale = 1;
        this.turretTimers = [];
        this.activeSkillTimers = []; // ทวีนเมอร์ที่ยังทำงานอยู่ของสกิล (ไฟไหม้ระเบิด/รั้วพลาสม่า) เก็บไว้ pause/resume ได้
        this.enemyRangedTimers = []; // Timer ยิงของศัตรูระยะไกลแต่ละตัวที่หยุดยืนยิงอยู่ตอนนี้ (ดู updateRangedEnemies) เก็บไว้ pause/resume/ล้างตอนจบเกมเหมือน turretTimers
        this.baseRegenTimer = null; // Timer ฟื้นฟู HP ฐานทัพอัตโนมัติ (ปลดล็อกตั้งแต่เลเวล BASE_HP_REGEN_UNLOCK_LEVEL — ดู startBaseRegenTimer())
        this.killedEnemyCounts = {}; // นับจำนวนศัตรูที่กำจัดได้จริง แยกตาม typeId (นับเฉพาะที่ถูกยิง/สกิลฆ่า ไม่นับตัวที่หลุดไปชนฐาน) ใช้คำนวณเงินรางวัลจบเกม
        this.skillCharge = 0;
        this.skillKillCounter = 0; // นับสะสม kill รอครบ SKILL_KILLS_PER_CHARGE ถึงจะได้เกจ +1 ขั้น
        this.skillMenuState = 'closed'; // 'closed' | 'selectType' — สถานะเมนูเลือกสกิล (ปุ่มวงกลม) — ใช้ซ้ำได้ไม่จำกัดแล้ว ไม่มีขั้นเลือกเลเวลอีกต่อไป

        // ==========================================
        // สถานะสำหรับ TestLogger เพิ่มเติม (ไม่มีผลต่อ gameplay) — สะสมตลอดทั้งเซสชัน ไม่รีเซ็ตข้าม virtual stage ของ Simulation Mode
        // (ยกเว้น turretDamageCounts/turretKillCounts ที่รีเซ็ตพร้อม killedEnemyCounts ใน onStageClear เพราะผูกกับรางวัลรายช่วงเดียวกัน)
        // ==========================================
        this.battleStartWallClock = Date.now(); // ใช้เวลาจริง ไม่ใช่ this.time.now เพราะไม่อยากให้ผันตามปุ่มเร่งความเร็ว
        this.skillCastLog = []; // [{id, level, wave, hpPercent}] ต่อการร่าย 1 ครั้ง
        this.quizCorrectCount = 0;
        this.quizWrongCount = 0;
        this.turretDamageCounts = new Array(TURRET_COUNT).fill(0);
        this.turretKillCounts = new Array(TURRET_COUNT).fill(0);
        this.minBaseHPPercent = 100;
        this.maxGameSpeedUsed = 1;

        // ==========================================
        // สร้าง Texture จาก Graphics (ยังไม่มี Assets จริง)
        // ==========================================
        this.createPlaceholderTextures();

        // ==========================================
        // 1) Base (ฐานทัพหลัก) ขนาด 640x240 ชิดขอบล่างสุดของจอ
        // ==========================================
        const baseX = screenW / 2;
        const baseY = screenH - BASE_HEIGHT / 2; // จัดให้ขอบล่างของฐานชิดขอบล่างสุดของจอพอดี

        this.base = this.physics.add.staticImage(baseX, baseY, 'tex_base').setDepth(DEPTH_ENTITY_UI);
        this.base.alpha = 0;

        // เส้นที่ศัตรูระยะไกลจะหยุดเดินแล้วเริ่มยิง — วัดจากขอบบนฐานทัพย้อนขึ้นมา (ดู updateRangedEnemies)
        this.rangedStopY = (baseY - BASE_HEIGHT / 2) - ENEMY_RANGED_ATTACK_RANGE_PX;

        this.baseHpText = this.add.text(baseX-200, screenH - 53, `HP: ${this.baseHP}`, {
            fontFamily: FONT_FAMILY, fontSize: '16px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(DEPTH_ENTITY_UI+1);

        // เลเวลฐานทัพ — วางเหนือ HP text ตรงๆ (สไตล์เดียวกับ Lv.X ของป้อมปืน) ให้ผู้เล่นเห็นได้เลยว่าฐานอัปไปถึงไหนแล้วโดยไม่ต้องเข้า UpgradeScene
        this.add.text(baseX-200, screenH - 73, `Base Lv.${SaveManager.getBaseLevel()}`, {
            fontFamily: FONT_FAMILY,
            fontSize: '14px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(DEPTH_ENTITY_UI+1);

        this.createHpBar(26, 775);

        // ==========================================
        // 2) Turrets (ป้อมปืน 5 ป้อม เรียงแนวนอนเหนือฐานทัพ)
        // ==========================================
        const turretY = baseY - BASE_HEIGHT / 2 + TURRET_Y_OFFSET_FROM_BASE_TOP;
        const turretSpacing = (screenW - TURRET_MARGIN_X * 2) / (TURRET_COUNT - 1);

        this.turrets = [];
        for (let i = 0; i < TURRET_COUNT; i++) {
            const tx = TURRET_MARGIN_X + i * turretSpacing;
            const type = TURRET_TYPES[i]; // ป้อมคงที่ 1:1 กับตำแหน่ง (ดู src/data/turretTypes.js)
            const level = SaveManager.getTurretLevel(i); // เลเวลจริงตามที่ผู้เล่นอัปเกรดไว้ใน UpgradeScene

            // ภาพป้อมปืนจริง (type.sprite) หมุนทั้งภาพเป็นก้อนเดียวตามทิศศัตรู — origin กึ่งกลางภาพ (0.5, 0.5) ตามที่เตรียมภาพมาให้หมุนรอบจุดนี้
            const sprite = this.add.image(tx, turretY, type.sprite).setOrigin(0.5, 0.5).setDepth(DEPTH_ENTITY_UI);

            // ตัวเลขเลเวลที่ฐานป้อม — คงที่ไม่หมุนตามป้อม (แค่บอกข้อมูล ไม่ใช่ส่วนของป้อมที่เล็ง)
            // วางใกล้ขอบล่างสุดของภาพป้อม (สูง 160px, origin กลาง) เพราะช่องว่างจริงระหว่างขอบล่างป้อมกับแถวสกิลด้านล่างมีแค่ ~7px ไม่พอวางข้อความแยกเต็มๆ
            const levelText = this.add.text(tx, turretY + 62, `Lv.${level}`, {
                fontFamily: FONT_FAMILY,
                fontSize: '14px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5, 0.5).setDepth(DEPTH_ENTITY_UI);

            const turret = { x: tx, y: turretY, sprite, levelText, type, level, index: i }; // index ไว้ผูกกระสุนกลับมาที่ป้อมนี้ (ดู spawnBullet) สำหรับ log ดาเมจ/kill รายป้อม
            this.turrets.push(turret);
            this.updateTurretVisualScale(turret);
        }

        // ==========================================
        // กลุ่ม Physics: กระสุน และ ศัตรู
        // ==========================================
        this.bullets = this.physics.add.group({
            defaultKey: 'tex_bullet',
            allowGravity: false
        });

        this.enemies = this.physics.add.group({
            defaultKey: 'tex_enemy',
            allowGravity: false
        });

        // กระสุนของศัตรูระยะไกล (แยกกลุ่มจาก this.bullets ของป้อมปืน กันไปโดน overlap ผิดกลุ่มกับศัตรูตัวอื่น)
        this.enemyBullets = this.physics.add.group({
            defaultKey: 'tex_bullet',
            allowGravity: false
        });

        // ให้แต่ละป้อมปืนยิงกระสุนอัตโนมัติตามอัตรายิง (fireRate) ของตัวเอง + โบนัสอัตรายิงจากเลเวลอัปเกรด (ต่างกันไปตามป้อม)
        // (หน่วงเวลาเริ่มยิงต่างกันเล็กน้อยไม่ให้ยิงพร้อมกันหมด)
        this.turrets.forEach((turret, index) => {
            const fireDelay = getTurretFireDelay(turret.type, turret.level);
            const timer = this.time.addEvent({
                delay: fireDelay,
                startAt: index * TURRET_FIRE_STAGGER_MS,
                loop: true,
                callback: () => this.fireBullet(turret)
            });
            this.turretTimers.push(timer);
        });

        // Base Passive Skill: เริ่ม Timer ฟื้นฟู HP อัตโนมัติ (ถ้าเลเวลถึงเกณฑ์ปลดล็อก — ดู startBaseRegenTimer())
        this.startBaseRegenTimer();

        // ==========================================
        // 3) Collision: กระสุนชนศัตรู / ศัตรูชนฐานทัพ
        // ==========================================
        this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, null, this);
        this.physics.add.overlap(this.enemies, this.base, this.onEnemyHitBase, null, this);
        this.physics.add.overlap(this.enemyBullets, this.base, this.onEnemyBulletHitBase, null, this);

        // ==========================================
        // 4) Wave Manager: จัดการการเกิดศัตรูเป็น Wave ทั้งหมด (ดูรายละเอียดใน src/systems/WaveManager.js)
        // ==========================================
        this.waveManager = new WaveManager(this, {
            stageNumber: this.stageNumber,
            spawnEnemy: (typeId, elementId) => this.spawnEnemy(typeId, elementId),
            onStageComplete: (isFinalStage) => this.onStageClear(isFinalStage),
            infinite: this.isInfiniteMode
        });
        this.waveManager.createUI();
        this.waveManager.start();

        // ==========================================
        // 5) Skill UI: เกจสกิล + ปุ่มใช้สกิลฐานทัพ 3 แบบ
        // ==========================================
        this.createSkillUI();

        // ==========================================
        // 6) ปุ่ม Pause (มุมบนขวา)
        // ==========================================
        this.createPauseButton();

        // ==========================================
        // 7) ปุ่มเร่งความเร็วเกม (มุมบนซ้าย)
        // ==========================================
        this.createSpeedButtons();

        // บอทกำลังทำงานอยู่ -> ตั้งความเร็วสูงสุด + เริ่มประเมินนโยบายสกิลของโปรไฟล์นี้
        AutoPlayBot.onMapSceneReady(this);
    }

    // ทำงานทุกเฟรม: หมุนกระบอกปืนตามศัตรู (สมูทตามเวลาจริง) และล้างกระสุน/ศัตรูที่หลุดจอ
    update(time, delta) {
        if (this.isGameOver || this.isPaused) return;

        this.updateTurretAiming(delta);
        this.updateEnemyDepth();
        this.updateRangedEnemies();
        this.cleanupOffscreen();
    }

    // เช็คศัตรูระยะไกลที่ยังเดินอยู่ (isRanged แต่ยังไม่ rangedStopped) ว่าเดินถึงเส้นหยุดยิงหรือยัง (this.rangedStopY)
    // ถึงแล้ว -> หยุดเดิน (velocity 0) แล้วเริ่ม Timer ยิงฐานทัพเป็นระยะจนกว่าจะโดนป้อมฆ่า (ดู fireEnemyProjectile)
    updateRangedEnemies() {
        this.enemies.children.each((enemy) => {
            if (!enemy.active || !enemy.isRanged || enemy.rangedStopped) return;
            if (enemy.y < this.rangedStopY) return;

            enemy.rangedStopped = true;
            enemy.setVelocity(0, 0);

            const timer = this.time.addEvent({
                delay: ENEMY_RANGED_FIRE_INTERVAL_MS,
                loop: true,
                callback: () => this.fireEnemyProjectile(enemy)
            });
            enemy.rangedFireTimer = timer;
            this.enemyRangedTimers.push(timer);
        });
    }

    // ยิงกระสุน 1 นัดจากศัตรูระยะไกลที่หยุดยืนอยู่ ตรงลงไปที่ฐานทัพ (เป้าหมายเดียวคือฐาน ไม่ใช่ป้อมปืน)
    // ดาเมจ/นัด ใช้ enemy.baseDamage ค่าเดียวกับที่เดิมจะได้ตอนชนฐาน (ดู ENEMY_RANGED_FIRE_INTERVAL_MS ใน constants.js)
    fireEnemyProjectile(enemy) {
        if (this.isGameOver || this.isPaused) return;
        if (!enemy.active) return; // กัน race condition: Timer อาจยิงเฟรมเดียวกับที่ enemy เพิ่งโดนป้อมฆ่าตาย ก่อน remove() มีผลจริง

        const projectile = this.enemyBullets.get(enemy.x, enemy.y, 'tex_bullet');
        if (!projectile) return;

        projectile.setActive(true).setVisible(true);
        if (projectile.body) {
            projectile.body.enable = true;
        }

        projectile.setTint(ELEMENTS[enemy.element].color);
        projectile.damage = enemy.baseDamage * ENEMY_RANGED_DAMAGE_MULTIPLIER;
        projectile.setVelocity(0, ENEMY_RANGED_PROJECTILE_SPEED);
    }

    // ศัตรู y มาก (ใกล้ฐานทัพมากกว่า) ให้อยู่ depth บนสุด จำลองความลึกแบบมองจากด้านบน ตัวที่อยู่หน้าจะบังตัวที่อยู่หลัง
    // ทำ hpText ตามไปด้วยในลูปเดียวกัน (ประหยัดกว่าวนซ้ำอีกรอบ) ให้เลข HP ติดอยู่กลางตัวศัตรูเสมอไม่ว่าจะเดินไปไหน
    updateEnemyDepth() {
        this.enemies.children.each((enemy) => {
            if (!enemy.active) return;
            enemy.setDepth(enemy.y);
            if (enemy.hpText) {
                enemy.hpText.setPosition(enemy.x, enemy.y);
                enemy.hpText.setDepth(enemy.y + 0.5);
            }
        });
    }

    // เลือกสีตัวหนังสือ (ขาว/ดำ) ให้ตัดกับสีพื้นหลัง (hexColor) เสมอ ตามสูตร luminance มาตรฐาน (ITU-R BT.601)
    // ใช้กับเลข HP บนตัวศัตรู เพราะสี tint เปลี่ยนตามธาตุ (เหลือง/ฟ้า/แดง/เทา) สีขาวตายตัวอ่านไม่ออกเวลาเจอพื้นสว่าง (เช่นสายฟ้าเหลือง)
    getContrastColor(hexColor) {
        const r = (hexColor >> 16) & 0xff;
        const g = (hexColor >> 8) & 0xff;
        const b = hexColor & 0xff;
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        return luminance > 150 ? '#000000' : '#ffffff';
    }

    // สร้าง Texture รูปทรงเรขาคณิตง่ายๆ ไว้ล่วงหน้า (แทน Sprite Assets จริง)
    createPlaceholderTextures() {
        const g = this.add.graphics();

        // Base: สี่เหลี่ยมสีน้ำเงิน
        g.clear();
        g.fillStyle(COLOR_BASE, 1);
        g.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        g.generateTexture('tex_base', BASE_WIDTH, BASE_HEIGHT);

        // ป้อมปืนใช้ภาพจริง (gun_black/gun_yellow/gun_red/gun_blue/gun_colorful โหลดใน PreloadScene) ไม่มี placeholder texture แล้ว

        // Enemy: วงกลมสีขาวล้วน (ย้อมสีจริงตามธาตุตอน spawn ด้วย setTint())
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(16, 16, 16);
        g.generateTexture('tex_enemy', 32, 32);

        // Bullet: เส้นสีขาวล้วน (ย้อมสีจริงตามธาตุของป้อมที่ยิงออกมา ด้วย setTint())
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.fillRect(0, 0, 4, 16);
        g.generateTexture('tex_bullet', 4, 16);

        // Particle: วงกลมสีขาวล้วน ใช้กับเอฟเฟกต์ juice ตอนโดนยิง/ตาย (ย้อมสีตามธาตุศัตรู ดู spawnHitParticles/spawnKillParticles)
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(4, 4, 4);
        g.generateTexture('tex_particle', 8, 8);

        g.destroy();
    }

    // หมุนกระบอกปืนของทุกป้อมให้ค่อยๆ หันไปทางศัตรูที่อยู่ใกล้ที่สุด "ในระยะยิง" อย่างสมูท (ไม่สะบัดหันทันที)
    // ศัตรูที่อยู่นอกระยะ TURRET_RANGE_PX จะไม่ถูกเล็ง (ป้อมค้างมุมเดิมไว้เฉยๆ)
    updateTurretAiming(delta) {
        // ระยะมุมสูงสุดที่หมุนได้ในเฟรมนี้ (คำนวณจาก delta เพื่อให้ความเร็วหมุนคงที่ไม่ขึ้นกับ framerate)
        const maxRotationStep = TURRET_ROTATION_SPEED_RAD_PER_SEC * (delta / 1000);

        this.turrets.forEach((turret) => {
            const target = this.findNearestEnemy(turret.x, turret.y, TURRET_RANGE_PX);
            if (!target) return;

            // Texture กระบอกปืนวาดชี้ขึ้นเป็นค่าเริ่มต้น (rotation 0 = ขึ้นบน) จึงต้องบวก 90 องศา
            // เพื่อแปลงมุมมาตรฐาน (0 = ขวา) ให้ตรงกับทิศทางเริ่มต้นของกระบอกปืน
            const desiredRotation = Phaser.Math.Angle.Between(turret.x, turret.y, target.x, target.y) + Math.PI / 2;
            turret.sprite.rotation = Phaser.Math.Angle.RotateTo(turret.sprite.rotation, desiredRotation, maxRotationStep);
        });
    }

    // หาศัตรูที่อยู่ใกล้ตำแหน่ง (x, y) มากที่สุด ภายในระยะ maxRange (ค่าเริ่มต้น = ไม่จำกัดระยะ)
    // คืน null ถ้าไม่มีศัตรูเลย หรือตัวที่ใกล้สุดก็ยังไกลเกิน maxRange (ใช้เล็ง/ยิงป้อมปืน)
    findNearestEnemy(x, y, maxRange = Infinity) {
        let nearest = null;
        let nearestDist = Infinity;

        this.enemies.children.each((enemy) => {
            if (!enemy.active) return;
            const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        });

        if (nearest && nearestDist > maxRange) return null;
        return nearest;
    }

    // ยิงกระสุนจากป้อมปืนไปยังทิศทางที่กระบอกปืน "หันอยู่จริง" ณ ขณะนี้ (ตามการหมุนแบบสมูทใน updateTurretAiming)
    // ไม่ใช่มุมเล็งเป้าแบบแม่นยำทันที เพื่อให้กระสุนออกตรงกับทิศที่มองเห็นบนจอเสมอ
    // ยิงเฉพาะตอนมีศัตรูอยู่ในระยะจริงๆ เท่านั้น (ไม่ยิงเปล่าตอนไม่เห็นศัตรู)
    // ป้อมที่ spread:true จะยิงหลายนัดกระจายมุมรอบทิศทางนั้น แทนยิงนัดเดียวตรงเป้า
    fireBullet(turret) {
        if (this.isGameOver || this.isPaused) return;
        if (!this.findNearestEnemy(turret.x, turret.y, TURRET_RANGE_PX)) return; // ไม่เห็นศัตรูในระยะ ไม่ต้องยิง

        const aimAngle = turret.sprite.rotation - Math.PI / 2; // แปลงกลับจาก rotation ของภาพเป็นมุมยิงจริง

        if (turret.type.spread) {
            const bulletCount = turret.type.upgrade.bulletCountByLevel[turret.level - 1]; // จำนวนกระสุนผันตามเลเวล (บางป้อมคงที่ บางป้อมเพิ่มลำกล้อง)
            const totalAngle = Phaser.Math.DegToRad(TURRET_SPREAD_ANGLE_DEG);
            const step = totalAngle / (bulletCount - 1);
            const startAngle = aimAngle - totalAngle / 2;
            for (let i = 0; i < bulletCount; i++) {
                this.spawnBullet(turret, startAngle + step * i);
            }
        } else {
            this.spawnBullet(turret, aimAngle);
        }
    }

    // สร้างกระสุน 1 นัดจากปลายกระบอกปืน วิ่งไปตามมุมที่กำหนด พร้อมคุณสมบัติตามชนิดป้อม (ธาตุ/ดาเมจ/ทะลุ)
    // จุดเกิดกระสุน = จุดหมุนป้อม (center) + เวกเตอร์ปากกระบอกที่หมุนตามมุมยิงจริง (angle) แล้ว
    // เวกเตอร์ปากกระบอกในกรอบท้องถิ่น (ป้อมหันขึ้นตรง) คือ (muzzleOffsetX, -BARREL_LENGTH) — หมุนด้วยเมทริกซ์มาตรฐาน
    // แล้วแทน cos(rotation)=-sin(angle), sin(rotation)=cos(angle) (เพราะ rotation = angle + PI/2) ได้สูตรสุดท้าย:
    spawnBullet(turret, angle) {
        const muzzleOffsetX = turret.type.muzzleOffsetX || 0;
        const spawnX = turret.x + Math.cos(angle) * BARREL_LENGTH - Math.sin(angle) * muzzleOffsetX;
        const spawnY = turret.y + Math.sin(angle) * BARREL_LENGTH + Math.cos(angle) * muzzleOffsetX;

        const bullet = this.bullets.get(spawnX, spawnY, 'tex_bullet');
        if (!bullet) return;

        bullet.setActive(true).setVisible(true);
        if (bullet.body) {
            bullet.body.enable = true;
        }

        const type = turret.type;

        bullet.setTint(ELEMENTS[type.element].color);
        bullet.element = type.element;
        bullet.damage = getTurretDamage(type, turret.level);
        bullet.piercing = type.piercing;
        bullet.hitEnemies = type.piercing ? new Set() : null; // กันกระสุนทะลุโดนศัตรูตัวเดิมซ้ำหลายเฟรม
        bullet.turretIndex = turret.index; // สำหรับ attribute ดาเมจ/kill กลับไปที่ป้อมต้นทาง (TestLogger)

        bullet.setVelocity(Math.cos(angle) * BULLET_SPEED, Math.sin(angle) * BULLET_SPEED);
        bullet.rotation = angle + Math.PI / 2;
    }

    // ป้อมปืนไม่ขยายขนาดตามเลเวลแล้ว (ของเดิมขยาย scale ภาพเดียวกัน) — รอภาพครบทุกเลเวลค่อยเปลี่ยนไปสลับเฟรม spritesheet ตามเลเวลแทนตรงนี้
    updateTurretVisualScale(turret) {
        // no-op ชั่วคราว — เก็บฟังก์ชัน/จุดเรียกไว้ให้ spritesheet frame-swap มาแทนที่ในอนาคต
    }

    // ตั้งเลเวลป้อมปืน (1-TURRET_MAX_LEVEL) — ยังไม่มีหน้าอัปเกรดเรียกใช้จริง เตรียมไว้ให้ Phase ระบบอัปเกรดเรียกใช้
    setTurretLevel(turret, level) {
        turret.level = level;
        this.updateTurretVisualScale(turret);
    }

    // ปล่อยศัตรู 1 ตัวจากขอบจอด้านบน — typeId/elementId มาจาก spawn queue ของ Wave ปัจจุบัน (กำหนดตายตัวตามสเปก ดู WaveManager.startWave)
    // สถานะจริง (เลือด/ความเร็ว/ดาเมจ) มาจาก src/data/enemyTypes.js แปลงผ่านค่าคูณใน constants.js ล้วนๆ ไม่มีตัวคูณตาม Stage อีกต่อไป
    // (ความยากตาม Stage มาจากสเปกเลือกชนิด/จำนวนศัตรูเองอยู่แล้ว — ตัดตัวคูณ HP/ATK เดิมทิ้งกันนับความยากซ้อนสองชั้น)
    spawnEnemy(typeId, elementId) {
        if (this.isGameOver || this.isPaused) return;

        const type = getEnemyTypeById(typeId);
        const element = ELEMENTS[elementId];

        const screenW = this.cameras.main.width;
        const x = Phaser.Math.Between(ENEMY_SPAWN_MARGIN_X, screenW - ENEMY_SPAWN_MARGIN_X);

        const enemy = this.enemies.get(x, 0, 'tex_enemy');
        if (!enemy) return;

        enemy.setActive(true).setVisible(true);
        if (enemy.body) {
            enemy.body.enable = true;
        }

        enemy.setScale(type.sizeScale);
        enemy.baseScale = type.sizeScale; // ขนาดพักจริง ใช้อ้างอิงตอน flash กันสเกลบวมสะสมเมื่อโดนยิงถี่ๆ
        enemy.setTint(element.color);
        enemy.element = element.id;
        enemy.typeId = type.id;

        enemy.hp = getEnemyHp(type);
        enemy.maxHp = enemy.hp;
        enemy.baseDamage = getEnemyDamage(type);

        // เลข HP กลางตัวศัตรู อัปเดตทุกครั้งที่โดนดาเมจ (ดู damageEnemy) — ให้เห็นชัดว่าโดนดาเมจจริงแม้ตัวยังไม่ตาย
        // สีตัดกับสีธาตุของศัตรูตัวนั้นเสมอ (คำนวณจาก getContrastColor) กันปัญหาตัวเลขจมสีพื้น เช่น สีเหลืองฟ้าผ่าที่ขาวอ่านไม่ออก
        if (!enemy.hpText) {
            enemy.hpText = this.add.text(x, 0, '', {
                fontFamily: FONT_FAMILY, fontSize: '13px', fontStyle: 'bold'
            }).setOrigin(0.5);
        }
        enemy.hpText.setText(`${enemy.hp}`).setColor(this.getContrastColor(element.color)).setVisible(true);

        // ศัตรูระยะไกล: เดินลงมาปกติก่อน แล้วหยุดยืนยิงเองตอนถึง this.rangedStopY (ดู updateRangedEnemies) — ไม่เดินเข้าชนฐานแบบศัตรูทั่วไป
        enemy.isRanged = !!type.isRanged;
        enemy.rangedStopped = false;
        enemy.rangedFireTimer = null;

        enemy.setVelocity(0, type.moveSpeed * ENEMY_SPEED_PER_RANK);
    }

    // เอฟเฟกต์ตอนศัตรูโดนยิงแต่ยังไม่ตาย: Flash สีขาว + ยุบขยายสั้นๆ เพื่อให้ผู้เล่นรู้ว่าโดนแล้ว
    // ขยายตามสัดส่วนขนาดจริงของศัตรูตัวนั้น (enemy.baseScale ค่าคงที่ตั้งแต่ spawn ไม่ใช่ enemy.scale ปัจจุบัน)
    // ต้อง kill ทวีนเก่าก่อนเสมอ ไม่งั้นโดนยิงถี่ๆ ระหว่างทวีนก่อนหน้ายังไม่จบ จะเอาสเกลที่ยังบวมอยู่มาคูณต่อ ทำให้บวมสะสมไม่มีที่สิ้นสุด
    flashEnemyHit(enemy, hitX, hitY, particleColor) {
        // เดิมถ้าศัตรูกำลัง Flash อยู่แล้วจะข้ามไปเลย (กันบัคสเกลสะสม) แต่ทำให้โดนดาเมจถี่ๆ (เช่น พลาสม่า tick ทุก 100ms
        // ในขณะที่ tween ยาว 100ms x2 รอบ yoyo = 200ms) เอฟเฟคหายไปครึ่งหนึ่งเงียบๆ เหมือนสกิลไม่มีเอฟเฟคตอนโดน
        // แก้โดยยกเลิก tween เก่าทันทีแล้วเริ่มใหม่แทนการข้าม — ยังกันสเกลสะสมได้เหมือนเดิมเพราะ setScale กลับไป baseScale ก่อนเริ่มเสมอ
        this.tweens.killTweensOf(enemy);
        enemy.isFlashing = true;

        enemy.setScale(enemy.baseScale); //
        enemy.setTintFill(COLOR_ENEMY_HIT_FLASH); //

        // ดึงจุดชนให้แนบอยู่ที่ขอบตัวศัตรูเสมอ (ทิศทางเดียวกับจุดที่กระสุนชนจริง แต่ระยะห่างจาก enemy ไม่เกินรัศมีตัวศัตรู)
        // กระสุนเร็ว/จังหวะตรวจ overlap อาจทำให้ hitX/hitY ดิบๆ ห่างจากตัวศัตรูเกินไปเป็นบางครั้ง
        const dx = hitX - enemy.x;
        const dy = hitY - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = enemy.displayWidth / 2;
        const particleX = enemy.x + (dx / dist) * radius;
        const particleY = enemy.y + (dy / dist) * radius;
        const outwardAngleDeg = Phaser.Math.RadToDeg(Math.atan2(dy, dx)); // ทิศจาก center ออกไปหาจุดชน — ให้ particle พุ่งออกด้านนี้ ไม่ใช่พุ่งเข้า center
        // โดนกระสุนป้อมปืน = สีธาตุศัตรู (ค่าเดิม) / โดนสกิลฐานทัพ = สีของสกิลนั้นแทน (ผู้เรียกส่ง particleColor มา) ให้แยกแยะง่ายว่าโดนอะไร
        this.spawnHitParticles(particleX, particleY, particleColor ?? ELEMENTS[enemy.element].color, outwardAngleDeg);

        this.tweens.add({ //[cite: 1]
            targets: enemy, //[cite: 1]
            // 2. เปลี่ยนมาใช้ scaleX และ scaleY แทนการใช้ scale ตัวเดียว เพื่อให้ Engine คืนค่าได้ชัวร์กว่า
            scaleX: enemy.baseScale * ENEMY_HIT_FLASH_SCALE_MULTIPLIER, //[cite: 1]
            scaleY: enemy.baseScale * ENEMY_HIT_FLASH_SCALE_MULTIPLIER, //[cite: 1]
            duration: ENEMY_HIT_FLASH_DURATION_MS, //[cite: 1]
            yoyo: true, //[cite: 1]
            onComplete: () => { //[cite: 1]
                if (enemy.active) { //[cite: 1]
                    enemy.isFlashing = false; // 3. เคลียร์สถานะเมื่อเอฟเฟกต์แสดงจบ
                    enemy.setScale(enemy.baseScale); //[cite: 1]
                    enemy.setTint(ELEMENTS[enemy.element].color); //[cite: 1]
                }
            }
        });
    }

    // Juice ตอนโดนยิง (ยังไม่ตาย): พ่นอนุภาคเล็กๆ ไม่กี่จุด สั้นๆ — เบากว่าตอนตายมาก เพราะยิงโดนถี่กว่าตายเยอะ (5 ป้อมยิงพร้อมกันได้)
    // angleDeg (ถ้าระบุ) = ทิศพุ่งออกจาก center ของศัตรู — ไม่ระบุจะพุ่งกระจายรอบทิศ (360°) ตามค่า default ของ Phaser
    spawnHitParticles(x, y, color, angleDeg) {
        const config = {
            speed: { min: 30, max: 70 },
            scale: { start: 0.6, end: 0 },
            lifespan: 150,
            quantity: 3,
            tint: color
        };
        if (angleDeg !== undefined) {
            config.angle = { min: angleDeg - 30, max: angleDeg + 30 }; // กระจายเป็นพัดแคบๆ รอบทิศพุ่งออก ไม่ใช่เส้นตรงเดียว
        }

        const emitter = this.add.particles(x, y, 'tex_particle', config).setDepth(DEPTH_ENTITY_UI); // ต้องอยู่เหนือศัตรู (depth ผันตาม y) ไม่งั้นโดนตัวศัตรูที่ยังไม่ตายบังไว้ทั้งหมด
        emitter.explode(3);
        this.time.delayedCall(250, () => emitter.destroy());
    }

    // Juice ตอนฆ่าศัตรูตาย: ระเบิดอนุภาคใหญ่กว่า/เยอะกว่า/นานกว่าตอนแค่โดนยิง ให้รู้สึกถึง "จบ" ของศัตรูตัวนั้นจริงๆ
    spawnKillParticles(x, y, color) {
        const emitter = this.add.particles(x, y, 'tex_particle', {
            speed: { min: 100, max: 220 },
            scale: { start: 1.2, end: 0 },
            lifespan: 350,
            quantity: 12,
            tint: color,
            blendMode: 'ADD'
        }).setDepth(DEPTH_ENTITY_UI); // เผื่อกรณีมีศัตรูตัวอื่นที่ยังไม่ตายอยู่ใกล้ๆ depth สูงกว่ามาบังได้เหมือนกัน
        emitter.explode(12);
        this.time.delayedCall(450, () => emitter.destroy());
    }

    // กระสุนชนศัตรู: ลดเลือดตามดาเมจของกระสุน (คูณโบนัสถ้าธาตุตรงกับศัตรู)
    // กระสุนทะลุ (piercing) จะไม่ดับ แต่ต้องกันไม่ให้โดนศัตรูตัวเดิมซ้ำหลายเฟรมระหว่างที่ overlap ยังไม่หลุด
    onBulletHitEnemy(bullet, enemy) {
        if (bullet.hitEnemies) {
            if (bullet.hitEnemies.has(enemy)) return;
            bullet.hitEnemies.add(enemy);
        }

        const isElementMatch = bullet.element === enemy.element;
        const damage = bullet.damage * (isElementMatch ? ELEMENT_MATCH_DAMAGE_MULTIPLIER : 1);
        const hitX = bullet.x; // เก็บจุดชนจริงไว้ก่อน — ถ้ากระสุนไม่ทะลุจะโดน destroy() บรรทัดถัดไป อ่าน x/y ต่อจากนั้นไม่ปลอดภัย
        const hitY = bullet.y;

        if (!bullet.piercing) {
            bullet.destroy();
        }

        this.damageEnemy(enemy, damage, hitX, hitY, bullet.turretIndex);
    }

    // ทำดาเมจให้ศัตรู 1 ตัว (ใช้ร่วมกันทั้งกระสุนป้อมปืนและสกิลฐานทัพ) — ถ้าตายให้แจ้ง Wave Manager และเติมเกจสกิล
    // (ฆ่าด้วยสกิลก็นับเป็น kill ได้เกจคืนเหมือนยิงเองปกติ)
    // hitX/hitY = จุดที่โดนจริง ใช้วาด particle ตอนไม่ตาย — ไม่ระบุ (เช่นดาเมจจากสกิล AOE) จะ fallback ไปที่ตำแหน่งศัตรูเอง
    // turretIndex = ป้อมต้นทาง (เฉพาะดาเมจจากกระสุน) ไว้สรุปดาเมจ/kill รายป้อมให้ TestLogger — undefined เมื่อมาจากสกิล AOE (ไม่มีป้อมต้นทาง)
    // particleColor = สีอนุภาคตอนโดน (ไม่ตาย) เฉพาะดาเมจจากสกิล — ไม่ระบุ (กระสุนป้อมปืนปกติ) จะใช้สีธาตุศัตรูตามเดิม
    damageEnemy(enemy, damage, hitX = enemy.x, hitY = enemy.y, turretIndex, particleColor) {
        if (!enemy.active) return;

        enemy.hp -= damage;
        if (turretIndex !== undefined) {
            this.turretDamageCounts[turretIndex] += damage;
        }
        this.showDamageNumber(hitX, hitY, damage); // เลขดาเมจลอยขึ้น ให้เห็นชัดว่าโดนดาเมจจริงเท่าไหร่ทุกครั้งที่โดน ไม่ว่าจะตายหรือไม่

        if (enemy.hp <= 0) {
            if (enemy.rangedFireTimer) enemy.rangedFireTimer.remove(); // หยุดยิงทันทีที่ตาย กัน Timer ยิงซ้ำเข้า object ที่ destroy() ไปแล้ว
            this.killedEnemyCounts[enemy.typeId] = (this.killedEnemyCounts[enemy.typeId] || 0) + 1;
            if (turretIndex !== undefined) {
                this.turretKillCounts[turretIndex] += 1;
            }
            this.spawnKillParticles(enemy.x, enemy.y, ELEMENTS[enemy.element].color); // เก็บตำแหน่ง/ธาตุไว้ก่อน destroy()
            if (enemy.hpText) enemy.hpText.destroy();
            enemy.destroy();
            this.waveManager.resolveEnemy();
            this.addSkillCharge();
        } else {
            if (enemy.hpText) enemy.hpText.setText(`${Math.ceil(enemy.hp)}`);
            this.flashEnemyHit(enemy, hitX, hitY, particleColor);
        }
    }

    // เลขดาเมจลอยขึ้นแล้วจางหาย ณ จุดที่โดนจริง — แยกจาก flashEnemyHit เพราะต้องโชว์ทุกครั้งที่โดน (รวมนัดที่ฆ่าด้วย) ไม่ใช่แค่ตอนไม่ตาย
    showDamageNumber(x, y, damage) {
        const text = this.add.text(x, y, `-${Math.round(damage)}`, {
            fontFamily: FONT_FAMILY, fontSize: '16px', fill: '#ffe066', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(DEPTH_ENTITY_UI - 1); // ต่ำกว่า UI/ป้อมปืนนิดหน่อย แต่สูงกว่าศัตรูทุกตัวเสมอ (ศัตรู depth สูงสุด ~870)

        this.tweens.add({
            targets: text,
            y: y - 40,
            alpha: 0,
            duration: 600,
            onComplete: () => text.destroy()
        });
    }

    // ศัตรูชนฐานทัพ: ทำลายศัตรู ลด HP ฐานทัพตามค่า atk ของศัตรูชนิดนั้น
    //
    // Arcade Physics overlap() ระหว่าง Group (this.enemies) กับ Static Body เดี่ยว (this.base) ไม่รับประกันลำดับ
    // argument ที่ส่งเข้า callback เสมอไป — บางครั้ง Phaser เรียกเป็น (enemy, base) บางครั้งเป็น (base, enemy) สลับกัน
    // (ยืนยันด้วยการทดสอบจริง: enemy.baseDamage อ่านค่าจาก object ที่แท้จริงคือ this.base ทำให้ได้ undefined -> NaN สะสมถาวร)
    // จึงต้องเช็คจาก reference ตรงๆ ว่าตัวไหนคือ this.base แทนที่จะเชื่อลำดับ parameter
    // ฐานทัพโดนดาเมจ — ใช้ร่วมกันทั้งศัตรูชนฐานแบบเดิม (onEnemyHitBase) และกระสุนศัตรูระยะไกลแบบใหม่ (onEnemyBulletHitBase)
    // สั่นจอ + ลด HP + อัปเดต UI + เช็คแพ้ ส่วนที่ไม่เหมือนกัน (resolveEnemy/destroy ตัวไหน) ให้ผู้เรียกจัดการเอง
    applyBaseDamage(damage) {
        this.cameras.main.shake(BASE_HIT_SHAKE_DURATION_MS, BASE_HIT_SHAKE_INTENSITY);

        this.baseHP = Math.max(0, Math.round(this.baseHP - damage));
        this.baseHpText.setText(`HP: ${this.baseHP}`);
        this.updateHpBar();
        this.minBaseHPPercent = Math.min(this.minBaseHPPercent, Math.round((this.baseHP / this.baseMaxHP) * 100)); // จุดต่ำสุดที่เคยเหลือ ไว้ดูว่าเฉียดตายแค่ไหน (สำหรับ TestLogger)

        if (this.baseHP <= 0 && !this.isGameOver) {
            this.gameOver();
        }
    }

    onEnemyHitBase(a, b) {
        const enemy = (a === this.base) ? b : a;
        if (!enemy.active) return;

        const damage = enemy.baseDamage;
        if (enemy.hpText) enemy.hpText.destroy();
        enemy.destroy();
        this.applyBaseDamage(damage);
        if (this.isGameOver) return;

        this.waveManager.resolveEnemy();
    }

    // กระสุนศัตรูระยะไกลชนฐานทัพ: ต่างจาก onEnemyHitBase ตรงที่ตัวศัตรูยังไม่ตาย (แค่กระสุนหมดฤทธิ์) จึงไม่เรียก resolveEnemy() —
    // เวฟจะยังไม่จบจนกว่าป้อมปืนจะฆ่าศัตรูตัวนี้ได้จริง (ผ่าน damageEnemy ตามปกติ)
    onEnemyBulletHitBase(a, b) {
        const bullet = (a === this.base) ? b : a;
        if (!bullet.active) return;

        const damage = bullet.damage;
        bullet.destroy();
        this.applyBaseDamage(damage);
    }

    // Base Passive Skill: % HP ที่ฟื้นต่อวินาที ณ เลเวลปัจจุบัน — สูตรจริงอยู่ที่ baseStats.js (ใช้ backloaded curve เดียวกับ Max HP)
    getBaseRegenPercent() {
        return calcBaseRegenPercent(SaveManager.getBaseLevel());
    }

    // เริ่ม Timer ฟื้นฟู HP ฐานทัพ — ไม่สร้างเลยถ้าเลเวลยังไม่ปลดล็อก Regen (กันเปลือง Timer เปล่าๆ)
    startBaseRegenTimer() {
        if (this.getBaseRegenPercent() <= 0) return;
        this.baseRegenTimer = this.time.addEvent({
            delay: BASE_HP_REGEN_TICK_MS,
            loop: true,
            callback: () => this.regenBaseHP()
        });
    }

    // ฟื้น HP ฐานทัพตามอัตรา Regen ของเลเวลปัจจุบัน ไม่เกิน Max HP
    regenBaseHP() {
        if (this.isGameOver || this.isPaused) return;

        const regenPercent = this.getBaseRegenPercent();
        if (regenPercent <= 0) return;

        const regenAmount = this.baseMaxHP * regenPercent * (BASE_HP_REGEN_TICK_MS / 1000);
        this.baseHP = Math.min(this.baseMaxHP, Math.round(this.baseHP + regenAmount));
        this.baseHpText.setText(`HP: ${this.baseHP}`);
        this.updateHpBar();
    }

    // ==========================================
    // แถบ HP ฐานทัพ (ภาพจริง): base_hp_frame (กรอบ, บนสุด) + base_hp_minus (พื้นหลังแถบ, HP ที่หายไป) + base_hp_fill (แถบ HP ปัจจุบัน, ตัด mask ตาม % HP)
    // เลเยอร์ minus/fill ขนาด 184x19 เว้นระยะจากกรอบ 190x25 ด้านละ 3px พอดี (วัดจากไฟล์จริง)
    // ==========================================
    createHpBar(x, y) {
        const innerX = x + 3;
        const innerY = y + 3;
        this.hpBarInnerX = innerX;
        this.hpBarInnerY = innerY;
        this.hpBarInnerW = 184;
        this.hpBarInnerH = 19;

        this.add.image(innerX, innerY, 'base_hp_minus').setOrigin(0, 0).setDepth(DEPTH_ENTITY_UI);

        this.hpBarFillImg = this.add.image(innerX, innerY, 'base_hp_fill').setOrigin(0, 0).setDepth(DEPTH_ENTITY_UI);
        this.hpBarFillMaskGfx = this.make.graphics({}, false); // ไม่ต้อง add เข้าฉาก ใช้แค่เป็นเรขาคณิตของ mask
        this.hpBarFillImg.setMask(new Phaser.Display.Masks.GeometryMask(this, this.hpBarFillMaskGfx));

        this.add.image(x, y, 'base_hp_frame').setOrigin(0, 0).setDepth(DEPTH_ENTITY_UI); // กรอบทับบนสุด ปิดขอบ minus/fill ให้เนียน

        this.hpBarState = { fillWidth: this.hpBarInnerW }; // ค่าที่ tween จริง — เริ่มที่เต็มแถบตรงกับ HP เต็มตอนเริ่มเกม
        this.updateHpBar(); // วาด mask ครั้งแรกตาม HP เริ่มต้น
    }

    // ตัด mask ของ base_hp_fill ให้กว้างตาม % HP ปัจจุบัน (ซ้าย->ขวา) กันภาพยืด/บีบผิดสัดส่วนแบบ setScale
    // tween ความกว้างเข้าเป้าหมายใหม่แบบสมูท ไม่ใช่กระโดดทันที (เหมือนแถบเกจสกิล)
    updateHpBar() {
        if (!this.hpBarFillMaskGfx) return;

        const percent = Phaser.Math.Clamp(this.baseHP / this.baseMaxHP, 0, 1);
        const targetFillWidth = this.hpBarInnerW * percent;

        this.tweens.killTweensOf(this.hpBarState);
        this.tweens.add({
            targets: this.hpBarState,
            fillWidth: targetFillWidth,
            duration: 300,
            ease: 'Sine.easeOut',
            onUpdate: () => this.drawHpBarFill()
        });
    }

    // วาด mask จริงตามค่า hpBarState.fillWidth ปัจจุบัน (เรียกทุกเฟรมระหว่าง tween กำลังวิ่ง)
    drawHpBarFill() {
        const gfx = this.hpBarFillMaskGfx;
        gfx.clear();
        gfx.fillStyle(0xffffff);
        gfx.fillRect(this.hpBarInnerX, this.hpBarInnerY, this.hpBarState.fillWidth, this.hpBarInnerH);
    }

    // ทำลายกระสุน/ศัตรูที่หลุดออกนอกขอบจอเพื่อคืนทรัพยากร (ศัตรูที่หลุดถือว่า "จบชีวิต" เช่นกัน เพื่อไม่ให้ Wave ค้าง)
    cleanupOffscreen() {
        if (this.isGameOver) return;

        this.bullets.children.each((bullet) => {
            if (bullet.active && bullet.y < BULLET_CLEANUP_Y) {
                bullet.destroy();
            }
        });

        this.enemies.children.each((enemy) => {
            if (enemy.active && enemy.y > ENEMY_CLEANUP_Y) {
                if (enemy.hpText) enemy.hpText.destroy();
                enemy.destroy();
                this.waveManager.resolveEnemy();
            }
        });
    }

    // ==========================================
    // ระบบสกิลฐานทัพ (Phase 7) — เกจสะสมจากการกำจัดศัตรู + สกิล 3 แบบ ใช้ได้ชนิดละ 1 ครั้งต่อการเล่น 1 รอบ
    // ยังไม่ผูก Quiz Gate (จะทำใน Phase ถัดไป) — ตอนนี้กดใช้ได้ทันทีถ้าเกจพอ
    // ==========================================

    // สร้าง UI เกจสกิล + ปุ่มวงกลมเปิดเมนูสกิล (วางไว้ในพื้นที่ฐานทัพ ใต้แนวป้อมปืน เหนือข้อความ HP)
    // ปุ่มวงกลมแตะแล้วกาง "ช่อง" 3 ช่องข้างๆ ออกมา — เนื้อหาในช่องเปลี่ยนไปตาม skillMenuState (เลือกชนิด -> เลือกระดับ)
    // ไม่ใช่ปุ่ม 3 ปุ่มตายตัวแบบเดิม เพื่อคงพื้นที่หน้าจอเท่าเดิมทั้งที่ตอนนี้มี 2 ขั้นตอนให้เลือก
    createSkillUI() {
        const screenW = this.cameras.main.width;
        const chargeTextY = 658;
        const rowY = 664; // เดิม 650 — เลื่อนลง 14px กันบังตัวเลข Lv.X ใต้ป้อมปืน (levelText อยู่ที่ turretY+62 ~y=647)
        const rowHeight = 44;
        const slotWidth = 156;
        const slotGap = 12;
        const slotStartX = 75;

        this.skillChargeText = this.add.text(screenW / 2+240, chargeTextY+80, `Skill Charge: 0/${SKILL_MAX_CHARGE}`, {
            fontFamily: FONT_FAMILY, fontSize: '16px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(DEPTH_ENTITY_UI+1);

        this.createSkillGaugeBar(580, 490);
        this.createSkillMonitorButton();

        // 3 ช่อง (slot) เอนกประสงค์ — ความหมายเปลี่ยนไปตาม skillMenuState ไม่ใช่ปุ่มตายตัวทีละชนิด
        this.skillSlots = [];
        for (let i = 0; i < 3; i++) {
            const sx = slotStartX + i * (slotWidth + slotGap);
            const gfx = this.add.graphics().setDepth(DEPTH_ENTITY_UI);
            const text = this.add.text(sx + slotWidth / 2, rowY + rowHeight / 2, '', {
                fontFamily: FONT_FAMILY, fontSize: '16px',
                fill: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(DEPTH_ENTITY_UI);

            gfx.setInteractive(new Phaser.Geom.Rectangle(sx, rowY, slotWidth, rowHeight), Phaser.Geom.Rectangle.Contains);
            gfx.on('pointerdown', () => this.onSkillSlotTap(i));

            this.skillSlots.push({ gfx, text, x: sx, y: rowY, width: slotWidth, height: rowHeight });
        }

        this.updateSkillUI();
    }

    // แถบเกจสกิล (ภาพจริง แนวตั้ง) — โครงสร้างเดียวกับแถบ HP/Enemies Left (frame + minus + fill ตัด mask)
    // frame 54x272, minus/fill 32x256 เว้นขอบ 11px แนวนอน / 8px แนวตั้ง (วัดจากไฟล์จริง)
    // เติมจากล่างขึ้นบน (bottom-up) — 1/3 ของความสูงแถบ = สกิล 1 level ตรงกับ SKILL_MAX_CHARGE=3 พอดี
    createSkillGaugeBar(x, y) {
        const innerX = x + 11;
        const innerY = y + 8;
        this.skillGaugeInnerX = innerX;
        this.skillGaugeInnerY = innerY;
        this.skillGaugeInnerW = 32;
        this.skillGaugeInnerH = 256;

        this.add.image(innerX, innerY, 'skill_minus').setOrigin(0, 0).setDepth(DEPTH_ENTITY_UI);

        this.skillGaugeFillImg = this.add.image(innerX, innerY, 'skill_fill').setOrigin(0, 0).setDepth(DEPTH_ENTITY_UI);
        this.skillGaugeMaskGfx = this.make.graphics({}, false); // ไม่ add เข้าฉาก ใช้แค่เป็นเรขาคณิตของ mask
        this.skillGaugeFillImg.setMask(new Phaser.Display.Masks.GeometryMask(this, this.skillGaugeMaskGfx));

        this.add.image(x, y, 'skill_frame').setOrigin(0, 0).setDepth(DEPTH_ENTITY_UI); // กรอบทับบนสุด ปิดขอบ minus/fill ให้เนียน

        this.skillGaugeState = { fillHeight: 0 }; // ค่าที่ tween จริง (ไม่ใช่ค่าเป้าหมาย) ไว้ animate การเพิ่ม/ลดให้สมูท
    }

    // ตัด mask ของ skill_fill ให้สูงตามสัดส่วน skillCharge/SKILL_MAX_CHARGE เติมจากขอบล่างของแถบขึ้นไป
    // เติมแบบต่อเนื่อง (ไม่ใช่กระโดดทีละ 1/3) — รวมความคืบหน้าจาก skillKillCounter ที่สะสมระหว่างรอครบ SKILL_KILLS_PER_CHARGE ด้วย
    // ให้เห็นว่ากำลังสะสมอยู่ทุกครั้งที่ฆ่าศัตรู ไม่ใช่นิ่งค้าง 19 ครั้งแล้วกระโดดทีเดียวตอนครบ 20
    // ไม่วาด mask ตรงๆ ทันที — tween ค่า skillGaugeState.fillHeight เข้าเป้าหมายใหม่แบบสมูท ทั้งตอนเพิ่ม (สะสม kill) และลด (ใช้สกิล)
    updateSkillGaugeBar() {
        if (!this.skillGaugeMaskGfx) return;

        const fractionalCharge = this.skillCharge + this.skillKillCounter / SKILL_KILLS_PER_CHARGE;
        const percent = Phaser.Math.Clamp(fractionalCharge / SKILL_MAX_CHARGE, 0, 1);
        const targetFillHeight = this.skillGaugeInnerH * percent;

        this.tweens.killTweensOf(this.skillGaugeState); // กันซ้อนทับกันถ้าเรียกถี่ๆ (เช่นฆ่าหลายตัวติดกัน)
        this.tweens.add({
            targets: this.skillGaugeState,
            fillHeight: targetFillHeight,
            duration: 300,
            ease: 'Sine.easeOut',
            onUpdate: () => this.drawSkillGaugeFill()
        });
    }

    // วาด mask จริงตามค่า skillGaugeState.fillHeight ปัจจุบัน (เรียกทุกเฟรมระหว่าง tween กำลังวิ่ง)
    drawSkillGaugeFill() {
        const fillHeight = this.skillGaugeState.fillHeight;

        const gfx = this.skillGaugeMaskGfx;
        gfx.clear();
        gfx.fillStyle(0xffffff);
        gfx.fillRect(this.skillGaugeInnerX, this.skillGaugeInnerY + (this.skillGaugeInnerH - fillHeight), this.skillGaugeInnerW, fillHeight);
    }

    // ปุ่มกดใช้สกิล (ภาพจริง) — แทนปุ่มวงกลมเดิม มุมขวาล่างของจอ ยังใช้ handler onSkillCircleTap() เดิม (เปิด/ปิดเมนูเลือกสกิล)
    // ย้อมสีแดงตอนเมนูเปิดอยู่ (สื่อว่าแตะซ้ำ = ยกเลิก) เหมือนที่ปุ่มวงกลมเดิมเปลี่ยนสีตอนเปิด/ปิด
    createSkillMonitorButton() {
        const screenW = this.cameras.main.width;
        const screenH = this.cameras.main.height;

        this.skillMonitorBtn = this.add.image(screenW, screenH, 'skill_monitor').setOrigin(1, 1).setDepth(DEPTH_ENTITY_UI); // ชิดมุมขวาล่างเป๊ะ ไม่เว้นระยะ
        this.skillMonitorBtn.setInteractive({ useHandCursor: true });
        this.skillMonitorBtn.on('pointerdown', () => this.onSkillCircleTap());

        // ข้อความ "PRESS HERE" เดิมฝังอยู่ในไฟล์ skill_monitor.png เอง แก้ผ่านโค้ดตรงๆ ไม่ได้ — ปิดทับด้วยกล่องสีจอเดิม
        // แล้ววางข้อความภาษาญี่ปุ่นทับแทน (ตำแหน่ง/สีจอประมาณจากภาพ ไม่ใช่ค่าพิกเซลแม่นยำจากไฟล์จริง)
        const btnLeft = screenW - 146; // ความกว้างจริงของ skill_monitor.png (native, ไม่ scale)
        const btnTop = screenH - 130;
        // ตำแหน่ง/ขนาดวัดจริงจากพิกเซลไฟล์ skill_monitor.png (สแกนหาขอบเขตสีจอกรมท่า 30,41,85 กับตัวหนังสือ cyan 43,213,252 ตรงๆ
        // ไม่ใช่ประมาณด้วยตา) พื้นที่จอจริงกว้าง x:[10,129] สูง y:[29,103] — 116x62 คือกล่องตรงกลางเผื่อขอบโค้งมุมจอไว้เล็กน้อย ไม่ล้นขอบ
        const coverPatch = this.add.graphics().setDepth(DEPTH_ENTITY_UI);
        coverPatch.fillStyle(0x16233f, 1);
        coverPatch.fillRoundedRect(btnLeft + 12, btnTop + 35, 116, 62, 6);
        this.add.text(btnLeft + 70, btnTop + 66, '基地\nスキル', {
            fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#4dd8ff', fontStyle: 'bold', align: 'center', lineSpacing: 4
        }).setOrigin(0.5).setDepth(DEPTH_ENTITY_UI);
    }

    // แตะปุ่มวงกลม: ปิดอยู่ -> เปิดขั้นเลือกชนิด, เปิดอยู่ (ไม่ว่าขั้นไหน) -> ปิดกลับ (ใช้เป็นปุ่มยกเลิกในตัว)
    onSkillCircleTap() {
        if (this.isGameOver || this.isPaused) return;

        this.skillMenuState = (this.skillMenuState === 'closed') ? 'selectType' : 'closed';
        this.updateSkillUI();
    }

    // แตะช่องที่ i (0-2) — เลือกชนิดสกิลแล้วร่ายทันที (เดิมมีขั้นเลือกเลเวลต่ออีกชั้น ตอนนี้ล็อกเลเวลไว้ที่ 1 เสมอ ไม่มีให้เลือกแล้ว)
    onSkillSlotTap(i) {
        if (this.isGameOver || this.isPaused) return;
        if (this.skillMenuState !== 'selectType') return;

        const id = ['bomb', 'laser', 'plasma'][i];
        if (this.skillCharge < 1) return; // เกจไม่พอ (ใช้ซ้ำได้ไม่จำกัดครั้งแล้ว เช็คแค่เกจพอมั้ย)
        this.closeSkillMenu();
        this.updateSkillUI();
        requestQuizGate(this, 'play', () => this.castSkill(id, this.getSkillLevel()), (correct) => {
            if (correct) this.quizCorrectCount++; else this.quizWrongCount++; // สำหรับ TestLogger
        }); // ต้องตอบถูกก่อนถึงจะร่ายจริง (ดู QuizGate)
    }

    // เลเวลของสกิลตอนร่ายจริง — ล็อกไว้ที่ 1 เสมอตอนนี้ตามที่ลูกค้าแจ้ง (เดิมผู้เล่นเลือกเองได้ 1-3 ตามเกจที่มี)
    // แยกเป็นฟังก์ชันเดียวไว้ตรงนี้ เผื่ออนาคตจะผูกเลเวลกับการอัปเกรดฐานแทน (จะได้แก้จุดเดียว ไม่ต้องไล่หา 1 ที่ hardcode ไว้)
    getSkillLevel() {
        return 1;
    }

    closeSkillMenu() {
        this.skillMenuState = 'closed';
    }

    // อัปเดตข้อความเกจ + แถบเกจ + ปุ่มวงกลม + ช่องทั้ง 3 ให้ตรงกับสถานะปัจจุบัน (ชนิด/ระดับ/ใช้ได้/ใช้ไปแล้ว)
    updateSkillUI() {
        this.skillChargeText.setText(`${this.skillCharge}/${SKILL_MAX_CHARGE}`);
        this.updateSkillGaugeBar();

        const menuOpen = this.skillMenuState !== 'closed';
        if (menuOpen) {
            this.skillMonitorBtn.setTint(0xe74c3c); // เมนูเปิดอยู่ -> ย้อมแดง สื่อว่าแตะซ้ำ = ยกเลิก
        } else {
            this.skillMonitorBtn.clearTint();
        }

        const skillLabels = { bomb: 'Incendiary Bomb', laser: 'Laser', plasma: 'Plasma' };
        // ไม่มี "used" อีกต่อไป (ใช้ซ้ำได้ไม่จำกัด) — enabled อิงจากเกจอย่างเดียว เหมือนกันทั้ง 3 ช่อง
        let items = null; // null = ปิดอยู่ ไม่ต้องแสดงช่องเลย
        if (this.skillMenuState === 'selectType') {
            items = ['bomb', 'laser', 'plasma'].map((id) => ({
                label: skillLabels[id],
                enabled: this.skillCharge >= 1
            }));
        }

        this.skillSlots.forEach((slot, i) => {
            slot.gfx.clear();
            if (!items) {
                slot.text.setText('');
                slot.gfx.disableInteractive();
                return;
            }

            const item = items[i];
            const color = item.enabled ? 0x9b59b6 : 0x7f8c8d;
            slot.gfx.fillStyle(color, 0.9);
            slot.gfx.fillRoundedRect(slot.x, slot.y, slot.width, slot.height, 8);
            // กรอบดำรอบปุ่ม กันดูกลืนกับพื้นหลังฉากอวกาศที่ลวดลายรก (ของเดิมมีแค่ fill โปร่งแสง ไม่มีขอบ)
            slot.gfx.lineStyle(3, 0x000000, 0.9);
            slot.gfx.strokeRoundedRect(slot.x, slot.y, slot.width, slot.height, 8);
            slot.gfx.setInteractive(new Phaser.Geom.Rectangle(slot.x, slot.y, slot.width, slot.height), Phaser.Geom.Rectangle.Contains);
            slot.text.setText(item.label);
        });
    }

    // สกิลเป็น "ไม้ตายก้นหีบ" ไม่ใช่ตัวช่วยที่กดได้บ่อยๆ — ต้องฆ่าศัตรูครบ SKILL_KILLS_PER_CHARGE ตัวถึงจะได้เกจ +1 ขั้น
    // (นับสะสมทุกการฆ่า ไม่ว่าจะด้วยกระสุนหรือสกิล เก็บเศษที่เกินไว้ ไม่ทิ้ง)
    addSkillCharge() {
        if (this.isGameOver || this.isPaused) return;
        // เกจเต็มแล้ว ไม่ต้องนับสะสมต่อ — กันไม่ให้ skillKillCounter ค้างเป็นเศษ (ทำให้เกจไม่เคลียร์จนสุดตอนใช้สกิลเต็มเลเวลแล้ว)
        if (this.skillCharge >= SKILL_MAX_CHARGE) return;

        this.skillKillCounter += 1;
        if (this.skillKillCounter < SKILL_KILLS_PER_CHARGE) {
            this.updateSkillGaugeBar(); // แถบขยับขึ้นทีละนิดทุกครั้งที่ฆ่า แม้ยังไม่ครบเกจเต็มขั้น
            return;
        }

        this.skillKillCounter -= SKILL_KILLS_PER_CHARGE;
        this.skillCharge += 1; // การันตี < SKILL_MAX_CHARGE เสมอ ณ จุดนี้ (เช็คไปแล้วตอนต้นฟังก์ชัน)
        this.updateSkillUI(); // เรียก updateSkillGaugeBar() ต่ออยู่แล้วในนี้
    }

    // ใช้สกิลตาม id ('bomb' | 'laser' | 'plasma') — ใช้ซ้ำได้ไม่จำกัดจำนวนครั้งแล้ว หักเกจตายตัว 1 ขั้นต่อครั้งเสมอ
    // (เดิมแต่ละชนิดใช้ได้แค่ครั้งเดียวต่อด่าน เลือกหักเกจ 1-3 ขั้นตามเลเวลที่เลือกเอง — เปลี่ยนตามที่ลูกค้าแจ้ง 2026-08-26)
    castSkill(skillId, level) {
        if (this.isGameOver || this.isPaused) return;
        if (level < 1 || level > this.skillCharge) return;

        this.skillCharge -= level;
        this.closeSkillMenu();
        this.updateSkillUI();

        this.skillCastLog.push({
            id: skillId,
            level,
            wave: this.waveManager.currentWaveIndex + 1,
            hpPercent: Math.round((this.baseHP / this.baseMaxHP) * 100)
        }); // สำหรับ TestLogger — บันทึกเลเวล/จังหวะที่ร่ายจริง ไม่ใช่แค่ชื่อสกิล

        if (skillId === 'bomb') this.castIncendiaryBomb(level);
        else if (skillId === 'laser') this.castLaserCannon(level);
        else if (skillId === 'plasma') this.castPlasmaDefender(level);
    }

    // ทำดาเมจให้ศัตรูทุกตัวที่อยู่ในรัศมี radius จากจุด (x, y) — คืนลิสต์ก่อนแล้วค่อยวนดาเมจ กันปัญหาโครงสร้างข้อมูลเปลี่ยนระหว่างวนลูป
    damageEnemiesInRadius(x, y, radius, damage, particleColor) {
        const hitList = [];
        this.enemies.children.each((enemy) => {
            if (enemy.active && Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= radius) {
                hitList.push(enemy);
            }
        });
        hitList.forEach((enemy) => this.damageEnemy(enemy, damage, undefined, undefined, undefined, particleColor));
    }

    // ทำดาเมจให้ศัตรูทุกตัวในแนวนอน (แถบ Y แคบๆ) — ใช้กับพลาสม่าดีเฟนเดอร์
    damageEnemiesInHorizontalBand(y, halfHeight, damage, particleColor) {
        const hitList = [];
        this.enemies.children.each((enemy) => {
            if (enemy.active && Math.abs(enemy.y - y) <= halfHeight) {
                hitList.push(enemy);
            }
        });
        hitList.forEach((enemy) => this.damageEnemy(enemy, damage, undefined, undefined, undefined, particleColor));
    }

    // ทำดาเมจให้ศัตรูทุกตัวในแนวตั้ง (แถบ X แคบๆ แต่สูงเต็มจอ) — ใช้กับเลเซอร์
    damageEnemiesInVerticalBand(x, halfWidth, damage, particleColor) {
        const hitList = [];
        this.enemies.children.each((enemy) => {
            if (enemy.active && Math.abs(enemy.x - x) <= halfWidth) {
                hitList.push(enemy);
            }
        });
        hitList.forEach((enemy) => this.damageEnemy(enemy, damage, undefined, undefined, undefined, particleColor));
    }

    // ระเบิดเพลิง: ระเบิดกลางจอเสมอ (ไม่เล็งเป้า — ใช้ตอนฉุกเฉินศัตรูรุมเยอะ) แล้วทิ้งพื้นที่ไฟไหม้ทำดาเมจต่อเนื่อง เลเวลสูง = รัศมีกว้างขึ้น
    castIncendiaryBomb(level) {
        // จุดตกอยู่กึ่งกลางระหว่างขอบบนของจอ (y=0) กับขอบบนของฐานทัพ (แทนกึ่งกลางจอทั้งหมดแบบเดิม)
        const baseTopY = this.cameras.main.height - BASE_HEIGHT;
        const impact = { x: this.cameras.main.centerX, y: baseTopY / 2 };
        const radius = SKILL_BOMB_BASE_RADIUS + level * SKILL_BOMB_RADIUS_PER_LEVEL;
        const burstDamage = SKILL_BOMB_BASE_DAMAGE + level * SKILL_BOMB_DAMAGE_PER_LEVEL;
        const fireTickDamage = SKILL_BOMB_FIRE_TICK_DAMAGE + level * SKILL_BOMB_FIRE_TICK_DAMAGE_PER_LEVEL;

        this.damageEnemiesInRadius(impact.x, impact.y, radius, burstDamage, 0xe67e22);
        this.showBombBurstVisual(impact.x, impact.y, radius);
        this.startBombFireZone(impact.x, impact.y, radius, fireTickDamage);
    }

    showBombBurstVisual(x, y, radius) {
        const gfx = this.add.graphics();
        gfx.fillStyle(0xe67e22, 0.6);
        gfx.fillCircle(x, y, radius);

        this.tweens.add({
            targets: gfx,
            alpha: 0,
            duration: SKILL_BOMB_BURST_VISUAL_MS,
            onComplete: () => gfx.destroy()
        });
    }

    // พื้นที่ไฟไหม้ค้างอยู่ระยะหนึ่ง ทำดาเมจเป็นช่วงๆ ให้ศัตรูที่ยังอยู่ในรัศมี แล้วหายไปเอง
    startBombFireZone(x, y, radius, tickDamage) {
        const zoneGfx = this.add.graphics();
        zoneGfx.fillStyle(0xe74c3c, 0.25);
        zoneGfx.fillCircle(x, y, radius);

        const tickTimer = this.time.addEvent({
            delay: SKILL_BOMB_FIRE_TICK_MS,
            loop: true,
            callback: () => {
                if (this.isGameOver) return;
                this.damageEnemiesInRadius(x, y, radius, tickDamage, 0xe67e22);
            }
        });
        this.activeSkillTimers.push(tickTimer);

        this.time.delayedCall(SKILL_BOMB_FIRE_DURATION_MS, () => {
            tickTimer.remove();
            zoneGfx.destroy();
        });
    }

    // เลเซอร์: ยิงลำแสงแนวตั้งคงที่ 2 เส้นเสมอ (ซ้าย 25% / ขวา 75% ของความกว้างจอ) เว้นช่องกลางจอไว้ ทำดาเมจก้อนเดียวกับศัตรูในแนว
    // เดิมจำนวนเส้นผันตาม level (1-3 เส้น) แต่ตอนนี้เลเวลล็อกที่ 1 เสมอ (ดู MapScene.getSkillLevel()) ทำให้เหลือแค่เส้นเดียวกลางจอโดยไม่ตั้งใจ — แก้กลับเป็น 2 เส้นคงที่แทน ไม่ผูกกับ level อีกต่อไป
    // ปรับ 2026-08-27: เปลี่ยนจากฆ่าทันทีเป็นดาเมจตัวเลข (SKILL_LASER_BASE_DAMAGE) ให้เทียบกับระเบิด/พลาสม่าได้ ตามที่ลูกค้าต้องการให้ 3 สกิลแรงพอๆ กัน
    castLaserCannon(level) {
        const screenW = this.cameras.main.width;
        const laserXs = this.getLaserPositions(screenW);
        const damage = SKILL_LASER_BASE_DAMAGE + level * SKILL_LASER_DAMAGE_PER_LEVEL;

        laserXs.forEach((x) => {
            this.damageEnemiesInVerticalBand(x, SKILL_LASER_WIDTH, damage, 0x00e5ff);
            this.showLaserVisual(x);
        });
    }

    // ตำแหน่งเส้นเลเซอร์คงที่ 2 เส้น: 25% และ 75% ของความกว้างจอ — เว้นแถบกลางจอ (25%-75%) ไว้ไม่โดนเลย
    getLaserPositions(screenW) {
        return [screenW * 0.25, screenW * 0.75];
    }

    showLaserVisual(x) {
        const gfx = this.add.graphics();
        gfx.fillStyle(0x00e5ff, 0.8);
        gfx.fillRect(x - SKILL_LASER_WIDTH, 0, SKILL_LASER_WIDTH * 2, this.turrets[0].y);

        this.tweens.add({
            targets: gfx,
            alpha: 0,
            duration: SKILL_LASER_VISUAL_MS,
            onComplete: () => gfx.destroy()
        });
    }

    // พลาสม่าดีเฟนเดอร์: กางรั้วพลังงานแนวนอน N แนวตามเลเวล ค้างอยู่ 30 วิ ทำดาเมจต่อเนื่องตลอดช่วงนั้น
    castPlasmaDefender(level) {
        const barrierYs = this.getPlasmaBarrierPositions(level);
        const tickDamage = SKILL_PLASMA_TICK_DAMAGE_BASE + level * SKILL_PLASMA_TICK_DAMAGE_PER_LEVEL;

        barrierYs.forEach((y) => this.startPlasmaBarrier(y, tickDamage));
    }

    // เรียงแนวรั้วซ้อนขึ้นไปเหนือแนวป้อมปืนทีละระยะห่างคงที่ ตามจำนวนเลเวล
    getPlasmaBarrierPositions(count) {
        const spacing = 80;
        const baseY = this.turrets[0].y - 60 - spacing; // เลื่อนขึ้นอีก 1 step ตามที่ขอ (เดิม -60 อย่างเดียว) แนวล่างสุดตอนนี้เท่ากับแนวบนของ level 2 เดิมพอดี
        return Array.from({ length: count }, (_, i) => baseY - i * spacing);
    }

    // สร้างรั้วพลาสม่า 1 แนว ค้างอยู่ SKILL_PLASMA_DURATION_MS (30 วิ) ทำดาเมจเป็นช่วงๆ ให้ศัตรูที่อยู่ในแนวตอนนั้น แล้วหายไปเอง
    startPlasmaBarrier(y, tickDamage) {
        const gfx = this.add.graphics();
        gfx.fillStyle(0x9b59b6, 0.5);
        gfx.fillRect(0, y - SKILL_PLASMA_WIDTH, this.cameras.main.width, SKILL_PLASMA_WIDTH * 2);

        const tickTimer = this.time.addEvent({
            delay: SKILL_PLASMA_TICK_MS,
            loop: true,
            callback: () => {
                if (this.isGameOver) return;
                this.damageEnemiesInHorizontalBand(y, SKILL_PLASMA_WIDTH, tickDamage, 0x9b59b6);
            }
        });
        this.activeSkillTimers.push(tickTimer);

        this.time.delayedCall(SKILL_PLASMA_DURATION_MS, () => {
            tickTimer.remove();
            gfx.destroy();
        });
    }

    // ==========================================
    // ระบบ Pause: ปุ่มมุมบนขวา กดแล้วหยุดเกมทั้งหมด (physics/timer ป้อมปืน/wave/สกิลที่ค้างอยู่/ทวีน)
    // แล้วโชว์ popup 2 ปุ่ม (เล่นต่อ / กลับฐานทัพ) — ไม่ใช้ this.scene.pause() ตรงๆ เพราะจะทำให้ปุ่มใน popup
    // กดไม่ได้ไปด้วย (Scene ที่ pause แล้ว Input จะหยุดตามด้วย) จึงหยุดแต่ละระบบเองแทน เหมือนแพทเทิร์น showEndOverlay
    // ==========================================

    // สร้างปุ่ม Pause ไอคอน 2 แท่งมุมบนขวา
    createPauseButton() {
        const screenW = this.cameras.main.width;
        const margin = 18; // ห่างจากขอบมุมบนขวา 18px ทั้งแนวตั้ง/แนวนอน

        const btn = this.add.image(screenW - margin, margin, 'btn_pause').setOrigin(1, 0).setDepth(DEPTH_ENTITY_UI);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => this.togglePause());
    }

    // สร้างปุ่มเร่งความเร็วมุมบนซ้าย — กดปุ่มที่กำลัง active อยู่ซ้ำเพื่อกลับไป 1x ปกติ
    // 10x/20x ปลอดภัยกับฟิสิกส์: Arcade ตั้ง fixedStep=true ก้าวละ 1/60 วินาทีคงที่เสมอ เร่งความเร็ว = "เพิ่มจำนวนก้าวต่อเฟรม" ไม่ใช่ "ขยายขนาดก้าว"
    // (ยืนยันด้วยการวัดจริง: ที่ 5x และ 20x ขนาดก้าวเท่ากันเป๊ะ 0.016667 ทั้งคู่ ต่างกันแค่จำนวนก้าว) จึงไม่มีปัญหากระสุนทะลุศัตรู
    createSpeedButtons() {
        this.speedButtons = {};
        // ปิดได้ด้วย SHOW_SPEED_BUTTONS (ดู constants.js) ก่อนส่งบิลด์ให้ลูกค้าดู — แค่ไม่วาดปุ่ม setGameSpeed() ยังเรียกได้ปกติ
        // (บอทยังเร่ง 20x ตรงๆ ได้เหมือนเดิม ดู AutoPlayBot.js, updateSpeedButtonsUI วนบน object ว่างเฉยๆ ไม่พังด้วย)
        if (!SHOW_SPEED_BUTTONS) return;

        const speeds = [2, 5, 10, 20];
        const btnSize = 32;
        const gap = 4;
        const startX = 20;
        const startY = 70; // ขยับลงจาก 4 กันชนกับแถบ Enemies Left มุมบนซ้าย (x=20,y=20 ดู WaveManager.createEnemiesLeftBar)

        speeds.forEach((speed, i) => {
            const bx = startX + i * (btnSize + gap);
            const gfx = this.add.graphics().setDepth(DEPTH_ENTITY_UI);
            const text = this.add.text(bx + btnSize / 2, startY + btnSize / 2, `${speed}x`, {
                fontFamily: FONT_FAMILY, fontSize: '13px',
                fill: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(DEPTH_ENTITY_UI);

            gfx.setInteractive(new Phaser.Geom.Rectangle(bx, startY, btnSize, btnSize), Phaser.Geom.Rectangle.Contains);
            gfx.on('pointerdown', () => this.setGameSpeed(speed));

            this.speedButtons[speed] = { gfx, x: bx, y: startY, size: btnSize };
        });

        this.updateSpeedButtonsUI();
    }

    // ตั้งความเร็วเกม (ปรับ Timer ทั้งฉาก + Physics + Tween พร้อมกันให้เร็ว/ช้าสอดคล้องกันหมด) กดซ้ำที่ปุ่มเดิม = กลับ 1x
    setGameSpeed(speed) {
        if (this.isGameOver || this.isPaused) return;

        this.gameSpeed = (this.gameSpeed === speed) ? 1 : speed;
        this.time.timeScale = this.gameSpeed;
        this.physics.world.timeScale = 1 / this.gameSpeed; // Arcade Physics World.timeScale กลับด้านจาก time/tweens.timeScale — ยิ่งค่าสูงยิ่ง "ช้าลง" (ยืนยันด้วยการวัดจริง ไม่ใช่ตามสัญชาตญาณ) จึงต้องหารแทนคูณ
        this.tweens.timeScale = this.gameSpeed;
        this.maxGameSpeedUsed = Math.max(this.maxGameSpeedUsed, this.gameSpeed); // สูงสุดที่เคยกดใช้จริงตลอดศึกนี้ (สำหรับ TestLogger)

        this.updateSpeedButtonsUI();
    }

    // ไฮไลท์ปุ่มความเร็วที่ active อยู่ตอนนี้ (เขียว) ที่เหลือเป็นสีปกติ
    updateSpeedButtonsUI() {
        Object.entries(this.speedButtons).forEach(([speed, btn]) => {
            const active = this.gameSpeed === Number(speed);

            btn.gfx.clear();
            btn.gfx.fillStyle(active ? 0x2ecc71 : 0x2c3e50, 0.9);
            btn.gfx.fillRoundedRect(btn.x, btn.y, btn.size, btn.size, 6);
        });
    }

    togglePause() {
        if (this.isGameOver) return;
        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    pauseGame() {
        this.isPaused = true;

        this.physics.pause();
        this.turretTimers.forEach((timer) => { timer.paused = true; });
        this.activeSkillTimers.forEach((timer) => { timer.paused = true; });
        this.enemyRangedTimers.forEach((timer) => { timer.paused = true; });
        if (this.baseRegenTimer) this.baseRegenTimer.paused = true;
        this.waveManager.pause();
        this.tweens.pauseAll();

        this.showPauseOverlay();
    }

    resumeGame() {
        this.isPaused = false;

        this.physics.resume();
        this.turretTimers.forEach((timer) => { timer.paused = false; });
        this.activeSkillTimers.forEach((timer) => { timer.paused = false; });
        this.enemyRangedTimers.forEach((timer) => { timer.paused = false; });
        if (this.baseRegenTimer) this.baseRegenTimer.paused = false;
        this.waveManager.resume();
        this.tweens.resumeAll();

        this.hidePauseOverlay();
    }

    // popup กลางจอ: หัวข้อ PAUSED + ปุ่มเล่นต่อ + ปุ่มกลับฐานทัพ
    showPauseOverlay() {
        const cx = this.cameras.main.centerX;
        const cy = this.cameras.main.centerY;

        const overlay = this.add.graphics().setDepth(DEPTH_OVERLAY);
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const title = this.add.text(cx, cy - 110, 'PAUSED', {
            fontFamily: FONT_FAMILY, fontSize: '44px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);

        const resumeBtn = this.add.graphics().setDepth(DEPTH_OVERLAY);
        resumeBtn.fillStyle(0x2ecc71, 1);
        resumeBtn.fillRoundedRect(cx - 150, cy - 40, 300, 70, 15);
        resumeBtn.setInteractive(new Phaser.Geom.Rectangle(cx - 150, cy - 40, 300, 70), Phaser.Geom.Rectangle.Contains);
        const resumeText = this.add.text(cx, cy - 5, 'Resume', { fontFamily: FONT_FAMILY, fontSize: '28px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);
        resumeBtn.on('pointerdown', () => this.resumeGame());

        const baseBtn = this.add.graphics().setDepth(DEPTH_OVERLAY);
        baseBtn.fillStyle(0xe74c3c, 1);
        baseBtn.fillRoundedRect(cx - 150, cy + 50, 300, 70, 15);
        baseBtn.setInteractive(new Phaser.Geom.Rectangle(cx - 150, cy + 50, 300, 70), Phaser.Geom.Rectangle.Contains);
        const baseText = this.add.text(cx, cy + 85, 'Back to Base', { fontFamily: FONT_FAMILY, fontSize: '28px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);
        baseBtn.on('pointerdown', () => {
            this.scene.start('BaseScene');
        });

        this.pauseOverlayElements = [overlay, title, resumeBtn, resumeText, baseBtn, baseText];
    }

    hidePauseOverlay() {
        if (!this.pauseOverlayElements) return;
        this.pauseOverlayElements.forEach((el) => el.destroy());
        this.pauseOverlayElements = null;
    }

    // คำนวณเงินรางวัลจบเกม (ใช้ร่วมกันทั้งแพ้/ชนะ) = ผลรวม coinValue x จำนวนที่กำจัดได้จริงตามชนิด + โบนัสตามความเสียหายฐาน (เสียหายน้อย = โบนัสเยอะ เป็นเส้นตรง)
    computeReward() {
        let killCoins = 0;
        Object.entries(this.killedEnemyCounts).forEach(([typeId, count]) => {
            const type = getEnemyTypeById(typeId);
            if (type) killCoins += type.coinValue * count;
        });

        const damagePercent = Math.round(Phaser.Math.Clamp(1 - this.baseHP / this.baseMaxHP, 0, 1) * 100);
        const damageBonus = Math.round(REWARD_BASE_DAMAGE_BONUS_MAX * (1 - damagePercent / 100));

        // คูณตัวคูณรายได้รวมท้ายสุด (ดู REWARD_MULTIPLIER ใน constants.js) — จุดปรับจูนเศรษฐกิจจุดเดียว
        const total = Math.round((killCoins + damageBonus) * REWARD_MULTIPLIER);

        return { total, damagePercent };
    }

    // แสดงหน้าจอจบเกม (ใช้ร่วมกันทั้ง GAME OVER และ YOU WIN) — สรุปจำนวนศัตรูที่กำจัดแยกตามชนิด + ความเสียหายฐาน (เฉพาะตอนชนะ) + เงินรางวัล + ปุ่มกลับฐานทัพ
    showEndOverlay(titleText, titleColor, { reward, showBaseDamage, damagePercent, stageReached, bestStage, isNewRecord }) {
        AutoPlayBot.onBattleEnd(this, titleText); // เรียกก่อนอย่างอื่นเสมอ — ให้บอทตัดสินใจก้าวต่อไปจากผลของศึกนี้ (ไม่มีผลถ้าบอทไม่ได้ทำงานอยู่)

        this.isGameOver = true;

        // หยุดการยิงและการปล่อยศัตรูเพิ่ม
        this.turretTimers.forEach((timer) => timer.remove());
        this.enemyRangedTimers.forEach((timer) => timer.remove());
        if (this.baseRegenTimer) this.baseRegenTimer.remove();
        this.waveManager.stop();

        // หยุดระบบ Physics ทั้งหมด
        this.physics.pause();

        // คืนความเร็วเกมกลับ 1x กันเอฟเฟกต์หน้าจอจบเกม (fade/tween) เล่นเร็ว/ช้าผิดปกติถ้าค้างความเร็วสูงไว้ตอนจบเกม
        this.time.timeScale = 1;
        this.physics.world.timeScale = 1;
        this.tweens.timeScale = 1;

        const cx = this.cameras.main.centerX;
        const screenW = this.cameras.main.width;

        // ฉากมืดครึ่งโปร่งใสด้านหลังข้อความ
        const overlay = this.add.graphics().setDepth(DEPTH_OVERLAY);
        overlay.fillStyle(0x000000, 0.75);
        overlay.fillRect(0, 0, screenW, this.cameras.main.height);

        let y = 60;
        this.add.text(cx, y, titleText, { fontFamily: FONT_FAMILY, fontSize: '44px', fill: titleColor, fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);
        y += 60;

        this.add.text(cx, y, '撃破数', { fontFamily: FONT_FAMILY, fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);
        y += 34;

        // สรุปจำนวนศัตรูที่กำจัดได้ แยกตามชนิด (แสดงเฉพาะชนิดที่กำจัดได้จริง >0 ตัว เรียงตามลำดับใน ENEMY_TYPES) เป็นตาราง 2 คอลัมน์
        const killedEntries = ENEMY_TYPES
            .map((type) => ({ type, count: this.killedEnemyCounts[type.id] || 0 }))
            .filter((entry) => entry.count > 0);

        const rowHeight = 34;
        const col0X = cx - 150;
        const col1X = cx + 30;

        killedEntries.forEach((entry, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const rowY = y + row * rowHeight;
            const iconX = col === 0 ? col0X : col1X;

            this.add.image(iconX, rowY, 'tex_enemy').setTint(entry.type.iconColor).setScale(entry.type.sizeScale * 0.4).setDepth(DEPTH_OVERLAY);
            this.add.text(iconX + 22, rowY, `x ${entry.count}`, { fontFamily: FONT_FAMILY, fontSize: '16px', fill: '#ffffff' }).setOrigin(0, 0.5).setDepth(DEPTH_OVERLAY);
        });

        const numRows = Math.max(1, Math.ceil(killedEntries.length / 2));
        y += numRows * rowHeight + 16;

        if (showBaseDamage) {
            this.add.text(cx, y, `基地の損害   ${damagePercent}%`, { fontFamily: FONT_FAMILY, fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);
            y += 34;
        }

        if (stageReached !== undefined) {
            this.add.text(cx, y, `Stage Reached   ${stageReached}`, { fontFamily: FONT_FAMILY, fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);
            y += 34;

            this.add.text(cx, y, `Best   ${bestStage}`, { fontFamily: FONT_FAMILY, fontSize: '18px', fill: '#bdc3c7', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);
            y += 30;

            if (isNewRecord) {
                this.add.text(cx, y, 'NEW RECORD!', { fontFamily: FONT_FAMILY, fontSize: '22px', fill: '#f1c40f', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);
                y += 36;
            }
        }

        this.add.text(cx, y, `獲得賞金   ${reward}`, { fontFamily: FONT_FAMILY, fontSize: '22px', fill: '#f1c40f', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);
        y += 50;

        const backBtn = this.add.graphics().setDepth(DEPTH_OVERLAY);
        backBtn.fillStyle(0x2ecc71, 1);
        backBtn.fillRoundedRect(cx - 150, y, 300, 70, 15);
        backBtn.setInteractive(new Phaser.Geom.Rectangle(cx - 150, y, 300, 70), Phaser.Geom.Rectangle.Contains);
        this.add.text(cx, y + 35, '次へ', { fontFamily: FONT_FAMILY, fontSize: '28px', fill: '#ffffff' }).setOrigin(0.5).setDepth(DEPTH_OVERLAY);

        backBtn.on('pointerdown', () => {
            this.scene.start('BaseScene');
        });
    }

    // เก็บ Log ผลการรบ 1 รอบ สำหรับวิเคราะห์สมดุลเกม (ดู src/systems/TestLogger.js) — ไม่มีผลต่อ gameplay
    // เรียกหลัง SaveManager.addCoins() แล้วเสมอ เพื่อให้ goldBalance เป็นยอดหลังรับรางวัลจริง
    logBattleResult(result, reward) {
        TestLogger.recordBattle({
            stage: this.stageNumber,
            result,
            // เคลียร์สำเร็จ = ผ่านครบทุก wave เสมอ (ระบุตรงๆ ไม่อ่านจาก index กัน log ให้ตัวเลขกำกวมตอนวิเคราะห์)
            waveReached: result === 'clear' ? this.waveManager.waves.length : this.waveManager.currentWaveIndex + 1,
            baseDamagePercent: reward.damagePercent,
            goldEarned: reward.total,
            goldBalance: SaveManager.getCoins(),
            turretLevels: this.turrets.map((t) => t.level),
            baseLevel: SaveManager.getBaseLevel(),
            skillCasts: this.skillCastLog,
            enemyKillBreakdown: this.killedEnemyCounts, // อ่านก่อนถูกรีเซ็ต (ถ้าเป็น Simulation Mode การรีเซ็ตเกิดหลังเรียกฟังก์ชันนี้เสมอ — ดู onStageClear)
            turretDamage: this.turretDamageCounts,
            turretKills: this.turretKillCounts,
            quizCorrect: this.quizCorrectCount,
            quizWrong: this.quizWrongCount,
            minBaseHPPercent: this.minBaseHPPercent,
            maxGameSpeed: this.maxGameSpeedUsed,
            channel: this.channel,
            durationSec: Math.round((Date.now() - this.battleStartWallClock) / 1000),
            botProfile: AutoPlayBot.isActive ? AutoPlayBot.currentProfileName() : '-'
        });
    }

    // จบเกม (แพ้): HP ฐานทัพหมด — ได้เงินรางวัลด้วย (ไม่ใช่แค่ตอนชนะแล้ว)
    gameOver() {
        const reward = this.computeReward();
        SaveManager.addCoins(reward.total);
        this.logBattleResult('dead', reward);

        if (this.isInfiniteMode) {
            // อัปเดต High Score (Stage ไกลสุดที่เคยไปถึงในโหมดจำลอง) ก่อนโชว์หน้าสรุปผล
            const isNewRecord = this.stageNumber > SaveManager.getBestSimulationStage();
            if (isNewRecord) SaveManager.setBestSimulationStage(this.stageNumber);

            this.showEndOverlay('SIMULATION OVER', '#e74c3c', {
                reward: reward.total,
                showBaseDamage: false,
                stageReached: this.stageNumber,
                bestStage: SaveManager.getBestSimulationStage(),
                isNewRecord
            });
        } else {
            this.showEndOverlay('敗北', '#e74c3c', { reward: reward.total, showBaseDamage: false });
        }
    }

    // (เฉพาะ Simulation Mode) ข้อความคั่นสั้นๆ ตอนเคลียร์ Stage ระหว่างทาง ไม่บล็อกเกม — เกมยังเล่นต่อได้ระหว่างที่ข้อความค้างอยู่
    // ต่างจาก showEndOverlay ตรงที่ไม่ pause physics/isGameOver เพื่อให้ Simulation Mode ต่อเนื่องไม่สะดุด
    showInfiniteStageTransition(rewardTotal) {
        const cx = this.cameras.main.centerX;
        const cy = this.cameras.main.centerY;

        const text = this.add.text(cx, cy, `STAGE ${this.stageNumber} CLEAR!  +${rewardTotal}`, {
            fontFamily: FONT_FAMILY, fontSize: '32px',
            fill: '#2ecc71',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(DEPTH_ENTITY_UI);

        this.time.delayedCall(WAVE_COMPLETE_DELAY_MS, () => text.destroy());
    }

    // เคลียร์ Wave ที่ 10 (Wave สุดท้าย) ของ Stage นี้สำเร็จ — ถ้าเป็น Stage สุดท้ายที่มีข้อมูลจริงตอนนี้ให้ถือว่าจบเกม (VICTORY เต็มรูปแบบ)
    // ถ้าไม่ใช่ ให้ปลดล็อค Stage ถัดไปใน SaveManager แล้วโชว์หน้าสรุปผล "STAGE X CLEAR" — ผู้เล่นต้องกลับไปกด Battle Start ที่หน้า Base ใหม่ถึงจะไป Stage ถัดไป (ไม่ต่ออัตโนมัติในเซสชันเดียวกันแล้ว)
    onStageClear(isFinalStage) {
        const reward = this.computeReward();
        SaveManager.addCoins(reward.total);
        this.logBattleResult('clear', reward);

        // Simulation Mode: ไม่กลับ Base ระหว่างทาง ต่อ Stage ถัดไปในเซสชันเดียวกันทันที ไม่แตะ SaveManager.currentStage เลย
        if (this.isInfiniteMode) {
            this.killedEnemyCounts = {}; // กันนับคะแนนซ้ำข้าม virtual stage ถัดไป (computeReward() ครั้งหน้าจะนับใหม่จากศูนย์)
            this.turretDamageCounts = new Array(TURRET_COUNT).fill(0); // รีเซ็ตพร้อมกัน — ผูกกับรางวัลรายช่วงเดียวกัน (TestLogger)
            this.turretKillCounts = new Array(TURRET_COUNT).fill(0);
            this.showInfiniteStageTransition(reward.total);
            this.stageNumber += 1;
            this.waveManager.advanceToStage(this.stageNumber);
            return;
        }

        // เก็บสถิติ % เสียหายต่ำสุดของ Stage นี้ไว้โชว์ในหน้า Battle History (ดู SaveManager.recordStageClear) — เก็บทุกครั้งที่เคลียร์จริง
        // ไม่ว่าจะเป็นการเล่นครั้งแรกหรือเล่นซ้ำจากหน้า Battle List ก็ตาม เก็บเฉพาะสถิติที่ดีกว่าเดิมเท่านั้น
        SaveManager.recordStageClear(this.stageNumber, reward.damagePercent);

        if (isFinalStage) {
            this.showEndOverlay('勝利!!', '#2ecc71', { reward: reward.total, showBaseDamage: true, damagePercent: reward.damagePercent });
        } else {
            // เช็คก่อนเลื่อน currentStage — กันไม่ให้เล่นด่านเก่าซ้ำผ่าน Battle List แล้วโปรเกรสถอยหลัง
            if (this.stageNumber >= SaveManager.getCurrentStage()) {
                SaveManager.setCurrentStage(this.stageNumber + 1);
            }
            this.showEndOverlay(`ステージ ${this.stageNumber} クリア!`, '#2ecc71', { reward: reward.total, showBaseDamage: true, damagePercent: reward.damagePercent });
        }
    }
}
