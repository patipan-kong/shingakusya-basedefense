import { FONT_FAMILY } from '../config/constants.js';

// วาดโจทย์ + ตัวเลือก 4 ข้อ (ตำแหน่ง/ขนาด/สไตล์) — ใช้ร่วมกันทั้ง QuizScene จริงตอนเล่นเกมส์ (quiz.js)
// และ QuizPreviewScene เครื่องมือ QA (quizPreview.js) เพื่อการันตีว่าสองที่นี้แสดงผลตรงกันเป๊ะเสมอ
// ห้ามคัดลอกโค้ดนี้ไปวางซ้ำที่ไฟล์ใดไฟล์หนึ่ง — ถ้าจะปรับตำแหน่ง/ขนาด/สไตล์ ให้แก้ที่นี่ที่เดียว มีผลทั้งสองจุดทันที
//
const IMG_BOX_W = 550;
const IMG_BOX_NORMAL_H = 520; // กรอบปกติ (ใช้คู่กับปุ่มตัวเลือกสี่เหลี่ยม 2x2)
const IMG_BOX_LONG_H = 650;   // กรอบภาพยาว (ใช้คู่กับปุ่มตัวเลือกวงกลม 1 แถว — เหลือพื้นที่ล่างมากกว่าเพราะแถวเดียวเตี้ยกว่า)
const IMG_BOX_TOP_Y = 60;     // ขอบบนกรอบภาพเมื่อไม่มีข้อความโจทย์ล้นพื้นที่ (ค่าตั้งต้น/พื้นที่ขั้นต่ำ) — ดู textOverflow ด้านล่างที่อาจดันลงมากกว่านี้
const QUESTION_TEXT_TOP_Y = 76; // จุดเริ่มข้อความโจทย์ — เผื่อพ้นแถบปุ่ม Close/BASE/PREV/NEXT ของ QuizPreviewScene (y=20-70, ดู quizPreview.js createChrome())

// ไฟล์ข้อมูล quiz จากลูกค้าใส่นามสกุลปนมาในค่า imagefile ไม่ตรงกันทุกไฟล์ (บางไฟล์มี .png ต่อท้ายเลย บางไฟล์ไม่มี)
// ตัดนามสกุลที่อาจติดมาออกก่อนเสมอ กันเผลอโหลดเป็น "english1-1.png.png" (ดู PreloadScene/quizRender ที่เรียกใช้ร่วมกัน)
export function stripImageExt(fileName) {
    return fileName.replace(/\.(png|jpe?g)$/i, '');
}

// path จริงของไฟล์รูป quiz — แยกโฟลเดอร์ตาม bank ('base'/'play') เพราะรูปย้ายมาอยู่รวมกับ json รายวิชาแล้ว (assets/quiz_base/, assets/quiz_play/)
function quizImagePath(bank, fileName) {
    return `assets/quiz_${bank}/${stripImageExt(fileName)}.png`;
}

// onChoiceClick(choiceNum) — choiceNum เป็นเลข 1-4 (ตรงกับ right_answer ในข้อมูล)
// คืนค่า { objects, choiceButtons } — objects: ของทั้งหมดที่สร้าง (ไว้ destroy() ตอนเปลี่ยนข้อ/ปิด)
//                                     choiceButtons: [{ gfx, shape, ... }] ต่อปุ่ม (ไว้ระบายสีซ้ำ เช่นตอนเฉลยคำตอบ — ดู shape ก่อนว่าเป็น 'rect' หรือ 'circle')
export function renderQuizQuestion(scene, quiz, onChoiceClick) {
    const objects = [];
    const screenW = scene.cameras.main.width;
    const screenH = scene.cameras.main.height;
    const cx = screenW / 2;

    // พื้นที่โจทย์ (ด้านบน) — ข้อมูลจริงบางข้อมี quiz_text เป็นคำสั่งยาวทั้งย่อหน้าอยู่คู่กับ quiz_imagefile ด้วย (ไม่ใช่ว่างเสมอไปตามที่เคยสมมติไว้)
    // และบางภาพ (เช่น quiz_base อังกฤษข้อ 3/5 ที่สเกลแล้วสูง ~528-531px ใกล้เพดานกรอบปกติ 520) แทบวางชิดขอบบนกรอบรูปพอดี ถ้าปล่อยกรอบรูปไว้
    // ตำแหน่งตายตัวโดยไม่สนใจความสูงข้อความจริง รูป (ซึ่งวาดทีหลัง จึงอยู่บนสุด) จะทับข้อความเงียบๆ โดยไม่มี error ใดๆ ให้เห็น
    // แก้ด้วยการวัดความสูงข้อความจริงหลังสร้างแล้ว แล้วบังคับให้กรอบรูปเริ่มไม่สูงกว่าขอบล่างข้อความ+ระยะห่างเสมอ (ไม่ใช่แค่ตอน "ล้นงบ" เท่านั้น
    // เพราะภาพที่สูงใกล้เพดานอย่างข้อ 3 ชนกับข้อความสั้นๆ ธรรมดาได้เหมือนกัน ไม่ต้องรอข้อความยาวขนาดข้อ 5) พร้อมหดความสูงกรอบรูปลงเท่ากัน
    // เพื่อให้ขอบล่างกรอบรูปอยู่ตำแหน่งเดิมเป๊ะเสมอ ไม่กระทบพื้นที่ปุ่มตัวเลือกด้านล่าง
    const questionText = scene.add.text(cx, QUESTION_TEXT_TOP_Y, quiz.quiz_text, {
        fontFamily: FONT_FAMILY, fontSize: '20px',
        fill: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: screenW - 80, useAdvancedWrap: true }
    }).setOrigin(0.5, 0);
    objects.push(questionText);

    const IMG_GAP_BELOW_TEXT = 16;
    const minImgTopY = Math.max(IMG_BOX_TOP_Y, QUESTION_TEXT_TOP_Y + questionText.height + IMG_GAP_BELOW_TEXT);
    const imgTopOverflow = minImgTopY - IMG_BOX_TOP_Y;

    // "ภาพยาว" คือภาพที่พอสเกลตามความกว้างกรอบ (550) แล้วสูงเกินกรอบปกติ (520) — ต้องรู้ก่อนตัดสินใจว่าจะใช้ UI ตัวเลือกแบบไหน
    // (สี่เหลี่ยม 2x2 มีข้อความจริง VS วงกลม 1 แถว ア/イ/ウ/エ ไว้กดเฉยๆ เพราะตัวเลือกจริงพิมพ์อยู่ในภาพเองแล้ว)
    // เช็คได้แบบ synchronous ก็ต่อเมื่อภาพถูก preload ไว้ล่วงหน้าแล้วเท่านั้น (ดู PreloadScene) ถ้ายังไม่เคยโหลดจะถือว่า "ไม่ใช่ภาพยาว"
    // ไปก่อนแบบปลอดภัยไว้ก่อน (กรณีนี้ไม่ควรเกิดในเกมจริงถ้า preload ครบ)
    // quiz._bank ('base'/'play') ถูกแปะไว้ตอนรวมไฟล์รายวิชาใน PreloadScene — บอกว่าต้องโหลดรูปจากโฟลเดอร์ไหน
    const bank = quiz._bank;
    const isLongImage = checkIsLongImage(scene, bank, quiz.quiz_imagefile, IMG_BOX_W, IMG_BOX_NORMAL_H);
    const imgBoxH = Math.max(300, (isLongImage ? IMG_BOX_LONG_H : IMG_BOX_NORMAL_H) - imgTopOverflow);
    const imgCenterY = minImgTopY + imgBoxH / 2;

    tryShowScrollableImage(scene, objects, bank, quiz.quiz_imagefile, cx, imgCenterY, IMG_BOX_W, imgBoxH);

    const choiceButtons = isLongImage
        ? renderCircleChoices(scene, objects, screenH, onChoiceClick)
        : renderRectChoices(scene, objects, quiz, bank, cx, screenH, onChoiceClick);

    return { objects, choiceButtons };
}

// ระบายสีปุ่มตัวเลือก 1 ปุ่มซ้ำ (เขียว=ตอบถูก/แดง=ตอบผิด/ฟ้า=ปกติ ฯลฯ) รองรับทั้ง 2 ทรง (rect/circle จาก choiceButtons)
// ใช้ตอนตอบจริง (quiz.js — ระบายปุ่มที่กด) และตอนเฉลยคำตอบในหน้าพรีวิว (quizPreview.js — ระบายปุ่มที่เป็นเฉลยจริง)
export function recolorChoiceButton(btn, color) {
    btn.gfx.clear();
    btn.gfx.fillStyle(color, 1);
    if (btn.shape === 'circle') {
        btn.gfx.fillCircle(btn.cx, btn.cy, btn.radius);
        btn.gfx.lineStyle(3, 0xffffff, 1);
        btn.gfx.strokeCircle(btn.cx, btn.cy, btn.radius);
    } else {
        btn.gfx.fillRoundedRect(btn.bx, btn.by, btn.btnW, btn.btnH, 12);
    }
}

// ปุ่มตัวเลือกแบบเดิม: สี่เหลี่ยม 4 ปุ่ม เรียง 2x2 ด้านล่างจอ พร้อมข้อความจริงจาก choice_textN
function renderRectChoices(scene, objects, quiz, bank, cx, screenH, onChoiceClick) {
    const btnW = 260;
    const btnH = 90;
    const gapX = 20;
    const gapY = 18;
    const startX = cx - btnW - gapX / 2;
    const startY = screenH - 2 * btnH - gapY - 40;

    const choiceButtons = [];
    for (let i = 0; i < 4; i++) {
        // บางข้อ (เช่นวิชาวิทยาศาสตร์บางข้อ) มีแค่ 2-3 ตัวเลือก ไม่ครบ 4 — ข้ามช่องที่ไม่มีทั้งข้อความและรูปไปเลย
        // กันปุ่มว่างเปล่าโผล่มาโดยไม่มีอะไรให้กด (ก่อนหน้านี้ Phaser จะแปลง undefined เป็นสตริงว่างเงียบๆ แต่ปุ่มก็ยังโผล่อยู่ดี)
        if (quiz['choice_text' + (i + 1)] === undefined && !quiz['choice_imagefile' + (i + 1)]) continue;

        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = startX + col * (btnW + gapX);
        const by = startY + row * (btnH + gapY);

        const gfx = scene.add.graphics();
        gfx.fillStyle(0x3498db, 1);
        gfx.fillRoundedRect(bx, by, btnW, btnH, 12);
        gfx.setInteractive(new Phaser.Geom.Rectangle(bx, by, btnW, btnH), Phaser.Geom.Rectangle.Contains);

        const text = scene.add.text(bx + btnW / 2, by + btnH / 2, quiz['choice_text' + (i + 1)], {
            fontFamily: FONT_FAMILY, fontSize: '20px',
            fill: '#ffffff',
            fontStyle: 'bold',
            align: 'center',
            // useAdvancedWrap: true — ตัวเลือกภาษาไทยมักไม่มีช่องว่างคั่นคำ wordWrap ปกติของ Phaser จะตัดบรรทัดแค่ตรงช่องว่าง
            // (มองว่าทั้งข้อความเป็น "คำเดียว" ยาวๆ) จึงล้นออกนอกปุ่มแทนที่จะตัดบรรทัด ต้องเปิดโหมดนี้ให้ตัดกลางคำได้ด้วย
            wordWrap: { width: btnW - 20, useAdvancedWrap: true }
        }).setOrigin(0.5);

        objects.push(gfx, text);
        choiceButtons.push({ gfx, shape: 'rect', bx, by, btnW, btnH, choiceNum: i + 1 });

        // รูปประกอบตัวเลือก (ถ้ามี) ยังใช้แบบย่อพอดีกรอบเฉยๆ ไม่ต้อง scroll เพราะพื้นที่ในปุ่มเล็กมาก
        tryShowImage(scene, objects, bank, quiz['choice_imagefile' + (i + 1)], bx + btnW / 2, by + btnH / 2 - 10, btnW - 40, btnH - 40);

        gfx.on('pointerdown', () => onChoiceClick(i + 1));
    }

    return choiceButtons;
}

// ปุ่มตัวเลือกแบบภาพยาว: วงกลม 4 ปุ่มเรียงแถวเดียว ป้าย ア/イ/ウ/エ ตายตัว (ตัวเลือกจริงพิมพ์อยู่ในภาพโจทย์เองแล้ว
// ไม่ต้องมีข้อความจริงต่อปุ่ม) วางใต้กรอบภาพยาว (ซึ่งกินพื้นที่ถึง y=710) เว้นระยะพอประมาณก่อนถึงขอบจอล่างสุด
const CIRCLE_LABELS = ['ア', 'イ', 'ウ', 'エ'];
function renderCircleChoices(scene, objects, screenH, onChoiceClick) {
    const screenW = scene.cameras.main.width;
    const cx = screenW / 2;
    const diameter = 90;
    const gap = 26;
    const totalW = diameter * 4 + gap * 3;
    const rowStartX = cx - totalW / 2;
    const boxBottom = IMG_BOX_TOP_Y + IMG_BOX_LONG_H;
    const rowY = boxBottom + (screenH - boxBottom) / 2; // กึ่งกลางช่องว่างใต้กรอบภาพยาวพอดี (ไม่ใช่กึ่งกลาง - รัศมี แบบเดิมที่คำนวณผิด)

    const choiceButtons = [];
    for (let i = 0; i < 4; i++) {
        const ccx = rowStartX + diameter / 2 + i * (diameter + gap);

        const gfx = scene.add.graphics();
        gfx.fillStyle(0x3498db, 1);
        gfx.fillCircle(ccx, rowY, diameter / 2);
        gfx.lineStyle(3, 0xffffff, 1);
        gfx.strokeCircle(ccx, rowY, diameter / 2);
        gfx.setInteractive(new Phaser.Geom.Circle(ccx, rowY, diameter / 2), Phaser.Geom.Circle.Contains);

        const text = scene.add.text(ccx, rowY, CIRCLE_LABELS[i], {
            fontFamily: FONT_FAMILY, fontSize: '32px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        objects.push(gfx, text);
        choiceButtons.push({ gfx, shape: 'circle', cx: ccx, cy: rowY, radius: diameter / 2, choiceNum: i + 1 });

        gfx.on('pointerdown', () => onChoiceClick(i + 1));
    }

    return choiceButtons;
}

// เช็คว่าภาพนี้ "ยาว" กว่ากรอบปกติไหม (สเกลตามความกว้าง boxW แล้วสูงเกิน thresholdH) — ต้อง preload ภาพไว้ก่อนแล้วเท่านั้น
// ถึงจะเช็คได้จริงแบบ synchronous (ดู PreloadScene ที่โหลดภาพ Quiz ทั้งหมดล่วงหน้าไว้ตั้งแต่หน้า Loading)
function checkIsLongImage(scene, bank, fileName, boxW, thresholdH) {
    if (!fileName) return false;

    const key = 'quizimg_' + stripImageExt(fileName);
    if (!scene.textures.exists(key)) return false; // ยังไม่เคย preload — ถือว่าไม่ใช่ภาพยาวไปก่อน (ไม่ควรเกิดถ้า preload ครบ)

    const src = scene.textures.get(key).getSourceImage();
    const scale = boxW / src.width;
    return src.height * scale > thresholdH;
}

// แสดงรูปโจทย์หลักในกรอบขนาดตายตัว (boxW x boxH) — ต่างจาก tryShowImage ทั่วไปตรงที่ไม่ย่อภาพให้พอดีทั้งใบ
// (ภาพโจทย์จากลูกค้าบางใบสูงมากและมีตัวอักษรแน่น ย่อจนพอดีกรอบจะอ่านไม่ออก) แทนที่จะย่อ จะสเกลตามความกว้างเท่านั้น
// (scale = boxW / ความกว้างจริงของภาพ) แล้วครอปด้วย mask ให้พอดีกรอบ ถ้าสูงเกิน boxH ให้ลาก (pointer drag) เลื่อนดูส่วนที่เกินในแนวตั้งได้
function tryShowScrollableImage(scene, objects, bank, fileName, centerX, centerY, boxW, boxH) {
    if (!fileName) return;

    const key = 'quizimg_' + stripImageExt(fileName);
    if (scene.textures.exists(key)) {
        objects.push(...placeScrollableImage(scene, key, centerX, centerY, boxW, boxH));
        return;
    }

    scene.load.image(key, quizImagePath(bank, fileName));
    scene.load.once('filecomplete-image-' + key, () => objects.push(...placeScrollableImage(scene, key, centerX, centerY, boxW, boxH)));
    scene.load.once('loaderror', () => { /* ไม่มีไฟล์จริง/โหลดพลาด: ข้ามไปเงียบๆ */ });
    scene.load.start();
}

function placeScrollableImage(scene, key, centerX, centerY, boxW, boxH) {
    const boxX = centerX - boxW / 2;
    const boxY = centerY - boxH / 2;

    const scale = boxW / scene.textures.get(key).getSourceImage().width;
    const img = scene.add.image(boxX, boxY, key).setOrigin(0, 0).setScale(scale);
    const scaledHeight = img.height * scale;

    // กรอบตัดขอบภาพ (mask) ไม่ให้ล้นออกนอกกรอบที่กำหนดไว้ ไม่ว่าจะเลื่อนไปตรงไหนก็ตาม
    const maskShape = scene.make.graphics();
    maskShape.fillRect(boxX, boxY, boxW, boxH);
    img.setMask(maskShape.createGeometryMask());

    const created = [img, maskShape];

    if (scaledHeight <= boxH) {
        // ภาพเตี้ยกว่ากรอบพอดี -> จัดกึ่งกลางแนวตั้งเฉยๆ ไม่ต้องลากดู
        img.y = boxY + (boxH - scaledHeight) / 2;
        return created;
    }

    // ภาพสูงเกินกรอบ -> ลาก (pointer drag) เลื่อนดูส่วนที่เกินในแนวตั้งได้ clamp ไม่ให้ลากเกินขอบภาพจริง
    const minY = boxY - (scaledHeight - boxH); // ลากขึ้นสุด (เห็นส่วนล่างสุดของภาพ)
    const maxY = boxY; // อยู่ตำแหน่งเริ่มต้น (เห็นส่วนบนสุดของภาพ)

    // แถบสกรอลบาร์ วางไว้ในช่องว่างระหว่างขอบรูปกับขอบจอ (ไม่ทับรูป) กึ่งกลางของช่องว่างนั้นพอดี
    // thumb สั้นกว่าสัดส่วนจริงครึ่งหนึ่ง (ดูคล่องตา ไม่ยาวจนดูเทอะทะ) และลากจาก thumb ได้โดยตรงเหมือนสกรอลบาร์ทั่วไป
    // สีเข้ม + thumb สีส้มเข้มมี stroke ดำ ตั้งใจให้ตัดกับพื้นภาพได้ทั้งภาพโทนสว่างและโทนเข้ม (ภาพจริงจากลูกค้าเดาสีพื้นล่วงหน้าไม่ได้)
    const screenW = scene.cameras.main.width;
    const scrollBarW = 8;
    const marginRight = screenW - (boxX + boxW);
    const scrollBarX = boxX + boxW + Math.max(4, (marginRight - scrollBarW) / 2);
    const thumbHeight = Math.max(24, (boxH * (boxH / scaledHeight)) / 2);
    const trackRange = boxH - thumbHeight;

    const track = scene.add.rectangle(scrollBarX, boxY, scrollBarW, boxH, 0x000000, 0.3).setOrigin(0, 0);
    const thumb = scene.add.rectangle(scrollBarX, boxY, scrollBarW, thumbHeight, 0xf39c12, 0.95)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x000000, 0.6)
        .setInteractive();

    // คำใบ้ "ลากเพื่อดูเพิ่มเติม" กลางล่างกรอบ เด้งขึ้นลงเบาๆ ให้สังเกตง่าย จางหายไปทันทีที่ผู้เล่นเริ่มลากครั้งแรก (ไม่ต้องบังภาพตลอด)
    // ใส่ stroke ดำหนาให้อ่านออกแม้ภาพพื้นหลังตรงนั้นเป็นโทนสว่าง (ตัวอักษรขาวล้วนจมกับพื้นสว่างได้ง่ายมาก)
    const hintText = scene.add.text(boxX + boxW / 2, boxY + boxH - 26, '↕ Drag to see more', {
        fontFamily: FONT_FAMILY, fontSize: '16px', fill: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0.9);
    const hintTween = scene.tweens.add({
        targets: hintText, y: hintText.y - 8, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    const hideHint = () => {
        if (!hintText.active) return;
        hintTween.stop();
        scene.tweens.add({ targets: hintText, alpha: 0, duration: 200, onComplete: () => hintText.destroy() });
    };

    const hitZone = scene.add.zone(boxX, boxY, boxW, boxH).setOrigin(0, 0).setInteractive();
    let isDragging = false; // ลากบนตัวรูปโดยตรง
    let isDraggingThumb = false; // ลากจากแท่งสกรอลบาร์
    let dragStartY = 0;
    let imgStartY = 0;
    let coastVelocity = 0; // px/วินาที ที่ยังไถลต่อเนื่องอยู่หลังปล่อยมือ (แรงเสียดทานหน่วงให้ช้าลงเรื่อยๆ ใน onUpdate ด้านล่าง)

    hitZone.on('pointerdown', (pointer) => {
        coastVelocity = 0; // จับรูปใหม่ระหว่างไถลอยู่ -> หยุดไถลทันที เหมือนสกรอลจริง
        isDragging = true;
        dragStartY = pointer.y;
        imgStartY = img.y;
        hideHint();
    });

    thumb.on('pointerdown', (pointer) => {
        coastVelocity = 0;
        isDraggingThumb = true;
        dragStartY = pointer.y;
        imgStartY = img.y;
        hideHint();
    });

    const onMove = (pointer) => {
        if (isDragging) {
            img.y = Phaser.Math.Clamp(imgStartY + (pointer.y - dragStartY), minY, maxY);
        } else if (isDraggingThumb) {
            // ลากบนแท่งสกรอลบาร์ 1px ต้องขยับรูปมากกว่านั้นมาก (ทางเดินของ thumb สั้นกว่าทางเดินของรูปเยอะ) จึงคูณกลับด้วยอัตราส่วน
            const ratio = trackRange > 0 ? (maxY - minY) / trackRange : 0;
            img.y = Phaser.Math.Clamp(imgStartY - (pointer.y - dragStartY) * ratio, minY, maxY);
        }
    };

    // ปล่อยมือ: ถ้ามีความเร็วตอนปล่อย (ลากแบบ "สะบัด") ให้ไถลต่อแบบมีแรงเสียดทานหน่วงลงเรื่อยๆ (ไม่ใช่ tween ปลายทางตายตัว)
    // ให้ความรู้สึกลื่นไหลกว่าเดิม เพราะระยะที่ไถลต่อแปรผันตามความแรงที่สะบัดจริง ไม่ใช่ระยะ/เวลาคงที่เสมอ
    // Phaser คำนวณ pointer.velocity (px/วินาที) ให้อัตโนมัติอยู่แล้ว ไม่ต้องมาไล่จับความเร็วเอง — เฉพาะลากบนรูปเท่านั้น (ลาก thumb ควบคุมตรงๆ ไม่มีไถลต่อ)
    const onUp = (pointer) => {
        if (isDragging) {
            isDragging = false;
            const velocity = pointer.velocity.y;
            if (Math.abs(velocity) > 40) coastVelocity = velocity;
        }
        isDraggingThumb = false;
    };

    // ทำงานทุกเฟรม: (1) ไถลต่อแบบมีแรงเสียดทานถ้ากำลัง coast อยู่ (2) ขยับ thumb ให้ตรงกับตำแหน่งรูปปัจจุบันเสมอ
    const FRICTION_PER_SEC = 0.05; // เหลือความเร็ว 5% ทุกๆ 1 วินาที (ยิ่งน้อยยิ่งหน่วงเร็ว/ยิ่งมากยิ่งไถลนาน)
    const onUpdate = (time, delta) => {
        if (coastVelocity !== 0) {
            const dt = delta / 1000;
            const next = img.y + coastVelocity * dt;
            if (next <= minY || next >= maxY) {
                img.y = Phaser.Math.Clamp(next, minY, maxY);
                coastVelocity = 0; // ชนขอบภาพจริง -> หยุดไถลทันที ไม่เด้งกลับ
            } else {
                img.y = next;
                coastVelocity *= Math.pow(FRICTION_PER_SEC, dt);
                if (Math.abs(coastVelocity) < 10) coastVelocity = 0;
            }
        }

        const t = (maxY - img.y) / (maxY - minY); // 0=บนสุด, 1=ล่างสุด
        thumb.y = boxY + t * trackRange;
    };
    onUpdate(0, 0);
    scene.events.on('update', onUpdate);

    // ผูก listener ระดับ scene แทนตัว hitZone/thumb เอง กันเคสลากเร็วจนพอยน์เตอร์หลุดออกนอกกรอบระหว่างลาก (ยังต้องลากต่อได้)
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.input.on('pointerupoutside', onUp);
    // เลิกฟัง listener ระดับ scene + update ทันทีที่ภาพนี้ถูกทำลาย (เปลี่ยนข้อ/ปิดหน้า) กัน listener ค้างสะสมทุกครั้งที่ re-render
    img.once('destroy', () => {
        scene.input.off('pointermove', onMove);
        scene.input.off('pointerup', onUp);
        scene.input.off('pointerupoutside', onUp);
        scene.events.off('update', onUpdate);
    });

    created.push(hitZone, track, thumb, hintText);
    return created;
}

// ลองโหลด+แสดงรูปแบบไดนามิก ถ้ามีชื่อไฟล์ระบุมา — ไฟล์ภาพโจทย์จริงอยู่ที่ assets/quiz_<bank>/<ชื่อ>.png (ดู quizImagePath ด้านบน)
// best-effort: ไม่ทำอะไรเลยถ้าไม่มีชื่อไฟล์ และไม่ทำให้พังถ้าโหลดไม่สำเร็จ — ใช้กับรูปตัวเลือก (เล็ก ย่อพอดีกรอบเสมอ ไม่ scroll)
function tryShowImage(scene, objects, bank, fileName, x, y, maxW, maxH) {
    if (!fileName) return;

    const key = 'quizimg_' + stripImageExt(fileName);
    if (scene.textures.exists(key)) {
        objects.push(placeImage(scene, key, x, y, maxW, maxH));
        return;
    }

    scene.load.image(key, quizImagePath(bank, fileName));
    scene.load.once('filecomplete-image-' + key, () => objects.push(placeImage(scene, key, x, y, maxW, maxH)));
    scene.load.once('loaderror', () => { /* ไม่มีไฟล์จริง/โหลดพลาด: ข้ามไปเงียบๆ */ });
    scene.load.start();
}

function placeImage(scene, key, x, y, maxW, maxH) {
    const img = scene.add.image(x, y, key);
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    img.setScale(scale);
    return img;
}

// ป๊อปอัปคำอธิบาย (kaisetu) — โผล่หลังตอบคำถามของ quiz_base เสร็จ (ไม่ว่าตอบถูกหรือผิด ดู quiz.js) แสดง kaisetu_text
// และ kaisetu_imagefile (ถ้ามี) เนื้อหาอาจยาว (บางข้อเป็นย่อหน้าหลายบรรทัด) จึงลากเลื่อนดูได้ถ้าล้นกรอบ ปิดได้ด้วยปุ่ม Continue เท่านั้น
// (ไม่ auto-close เอง เพราะเนื้อหายาวเกินจะอ่านทันในเวลาสั้นๆ) — คืนค่า array ของ object ทั้งหมดที่สร้าง เผื่อ caller อยาก destroy เอง
// นอกเหนือจากตอนกด Continue (ปกติไม่จำเป็น เพราะกด Continue จะ destroy ให้เองแล้วค่อยเรียก onContinue)
export function showExplanationPopup(scene, quiz, onContinue) {
    if (!quiz.kaisetu_text) { onContinue(); return []; } // ไม่มีคำอธิบาย (เช่นข้อจาก quiz_play) — ข้ามป๊อปอัปนี้ไปเลย

    const objects = [];
    const screenW = scene.cameras.main.width;
    const screenH = scene.cameras.main.height;
    const cx = screenW / 2;

    const overlay = scene.add.rectangle(0, 0, screenW, screenH, 0x000000, 0.85).setOrigin(0, 0).setInteractive();
    objects.push(overlay);

    const panelX = 30;
    const panelY = 60;
    const panelW = screenW - 60;
    const panelH = screenH - 190;
    const panelBg = scene.add.graphics();
    panelBg.fillStyle(0x2c3e50, 1);
    panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    panelBg.lineStyle(2, 0xffffff, 0.25);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);
    objects.push(panelBg);

    const title = scene.add.text(cx, panelY + 28, 'Explanation', {
        fontFamily: FONT_FAMILY, fontSize: '22px', fill: '#f39c12', fontStyle: 'bold'
    }).setOrigin(0.5);
    objects.push(title);

    // พื้นที่เนื้อหา (รูปคำอธิบาย ถ้ามี + ข้อความ) ครอปด้วย mask แล้วลากเลื่อนได้ถ้าล้น — ใช้ container เดียวคุมทั้งรูป+ข้อความไปด้วยกัน
    const contentX = panelX + 24;
    const contentY = panelY + 56;
    const contentW = panelW - 48;
    const contentH = panelH - 56 - 16;

    const maskShape = scene.make.graphics();
    maskShape.fillRect(contentX, contentY, contentW, contentH);
    objects.push(maskShape);

    const container = scene.add.container(contentX, contentY);
    container.setMask(maskShape.createGeometryMask());
    objects.push(container);

    let cursorY = 0;
    if (quiz.kaisetu_imagefile) {
        const key = 'quizimg_' + stripImageExt(quiz.kaisetu_imagefile);
        if (scene.textures.exists(key)) {
            const srcH = scene.textures.get(key).getSourceImage().height;
            const srcW = scene.textures.get(key).getSourceImage().width;
            const scale = Math.min(contentW / srcW, 1);
            const img = scene.add.image(contentW / 2, (srcH * scale) / 2, key).setScale(scale);
            container.add(img);
            cursorY = srcH * scale + 16;
        }
        // ไม่มี texture (ยังไม่ preload/โหลดพลาด) — ข้ามรูปไปเงียบๆ เหมือนจุดอื่นๆ ของไฟล์นี้ ยังคงแสดง kaisetu_text ต่อได้ปกติ
    }

    const text = scene.add.text(0, cursorY, quiz.kaisetu_text, {
        fontFamily: FONT_FAMILY, fontSize: '16px', fill: '#ffffff',
        wordWrap: { width: contentW, useAdvancedWrap: true },
        lineSpacing: 6
    });
    container.add(text);
    const totalContentH = cursorY + text.height;

    // ลากเลื่อนดูเนื้อหาที่ล้นกรอบ — เวอร์ชันย่อของ placeScrollableImage (ลากตรงๆ ไม่มีแรงเฉื่อย/momentum เพราะเป็นข้อความอ่าน ไม่ใช่ภาพสำรวจ)
    if (totalContentH > contentH) {
        const minY = contentY - (totalContentH - contentH);
        const maxY = contentY;
        const hitZone = scene.add.zone(contentX, contentY, contentW, contentH).setOrigin(0, 0).setInteractive();
        objects.push(hitZone);

        const scrollBarW = 6;
        const scrollBarX = contentX + contentW + 8;
        const thumbHeight = Math.max(24, contentH * (contentH / totalContentH));
        const trackRange = contentH - thumbHeight;
        const track = scene.add.rectangle(scrollBarX, contentY, scrollBarW, contentH, 0x000000, 0.3).setOrigin(0, 0);
        const thumb = scene.add.rectangle(scrollBarX, contentY, scrollBarW, thumbHeight, 0xf39c12, 0.95).setOrigin(0, 0);
        objects.push(track, thumb);

        let isDragging = false;
        let dragStartY = 0;
        let containerStartY = 0;
        const onDown = (pointer) => { isDragging = true; dragStartY = pointer.y; containerStartY = container.y; };
        const onMove = (pointer) => {
            if (!isDragging) return;
            container.y = Phaser.Math.Clamp(containerStartY + (pointer.y - dragStartY), minY, maxY);
            thumb.y = contentY + ((maxY - container.y) / (maxY - minY)) * trackRange;
        };
        const onUp = () => { isDragging = false; };
        hitZone.on('pointerdown', onDown);
        scene.input.on('pointermove', onMove);
        scene.input.on('pointerup', onUp);
        scene.input.on('pointerupoutside', onUp);
        container.once('destroy', () => {
            scene.input.off('pointermove', onMove);
            scene.input.off('pointerup', onUp);
            scene.input.off('pointerupoutside', onUp);
        });
    }

    // ปุ่ม Continue — ปิดป๊อปอัป (ทำลาย object ทั้งหมด) แล้วค่อยเรียก callback บอกให้ QuizScene ไปต่อ (ปิดหน้า Quiz)
    const btnW = 220;
    const btnH = 60;
    const btnX = cx - btnW / 2;
    const btnY = panelY + panelH + 16;
    const btnGfx = scene.add.graphics();
    btnGfx.fillStyle(0x2ecc71, 1);
    btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 12);
    btnGfx.setInteractive(new Phaser.Geom.Rectangle(btnX, btnY, btnW, btnH), Phaser.Geom.Rectangle.Contains);
    const btnText = scene.add.text(cx, btnY + btnH / 2, 'Continue', {
        fontFamily: FONT_FAMILY, fontSize: '22px', fill: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    objects.push(btnGfx, btnText);

    btnGfx.on('pointerdown', () => {
        objects.forEach((o) => o.destroy());
        onContinue();
    });

    return objects;
}
