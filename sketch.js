// ===============================
// 一、全局状态与数据容器
// 管理场景中的主要对象：建筑层、石头、涟漪、文字
// ===============================
let layers = [[], [], []];   // 三层背景建筑
let stones = [];             // 已释放的石头
let ripples = [];            // 水面扩散的涟漪
let floatingWords = [];      // 浮在水面上排版后的文字
let FRAME = 0;   // ← 新增：手动帧计数器

// 鲁迅文本（作为被“抛掷”的思想内容）
let luXunText =
  "假如一间铁屋子，是绝无窗户而万难破毁的，里面有许多熟睡的人，不久都要闷死了；然而现在还没有觉醒的可能。你大嚷起来，惊起了较为清醒的几个人，使这不幸的少数者来受无可挽救的临终苦楚。你倒以为对得起他们么？然而几个人既然起来，你不能说决没有毁坏这铁屋的希望。你要知道，铁屋子是可以打破的。假如有一个人，能够在屋外用力地敲打铁屋子，虽然他不能立刻把它打破，然而总有一天，他的力量会使铁屋子震动得支离破碎的。有时候仍不免呐喊几声，聊以慰藉那在寂寞里奔驰的猛士，使他不惮于前驱。我便觉得医学并非一件紧要事，凡是愚弱的国民，即使体格如何健全，如何茁壮，也只能做毫无意义的示众的材料和看客，病死多少是不必以为不幸的。说到希望，却是不能抹杀的，因为希望是在于将来，决不能以我之必无的证明，来折服了他之所谓可有。";

// 当前正在蓄力的石头
let chargingStone = null;

// 全局文字索引（保证文字顺序不重复）
let globalTextIndex = 0;

// 海平面基础高度
const SEA_BASE_Y = 180;


// ===============================
// 二、文字排版与时间控制参数
// 控制水面文字的排列、停留时间和淡入淡出
// ===============================
const CHAR_SPACING = 30;
const LINE_HEIGHT = 45;
const MARGIN_X = 80;

const DISPLAY_DURATION = 10000; // 文字在水面停留 10 秒
const FADE_TIME = 1000;         // 前后各 1 秒淡入淡出


// ===============================
// 九、Building & Ripple 类
// 环境系统：城市背景 + 水波反馈
// ===============================
class Building {
  constructor(x, layerIndex) {
    this.baseX = x;
    this.type = random(["office", "home", "school"]);
    this.w = random(30, 86);
    this.h = random(220, 340);
    this.glowIntensity = 0;
    this.y = 0;
  }

  update(l, ripples, stones) {
    let t = FRAME * 0.02;

    // 1. 浪头推进（向岸）
    let waveSpeed = 0.6;
    let waveLength = 420;
    let waveFront =
      (t * waveSpeed * waveLength) % (width + waveLength) - waveLength;

    let dToFront = this.baseX - waveFront;

    // 2. 拍岸浪
    let shoreWave = 0;
    if (dToFront > 0 && dToFront < waveLength) {
      let p = dToFront / waveLength;
      let crest = sin(p * PI);
      let impact = pow(crest, 1.6);
      let shoreBoost = map(l, 0, 2, 1.2, 0.6);
      shoreWave = impact * 28 * shoreBoost;
    }

    // 3. 退潮回落
    let retreat = sin(t * 0.6 + this.baseX * 0.015) * 6;

    // 4. 石头涟漪（保留原逻辑）
    let rippleShift = 0;
    this.glowIntensity = 0;

    for (let r of ripples) {
      let d = abs(this.baseX - r.x);
      let distToWave = abs(d - r.r);
      if (distToWave < 120) {
        let weight = map(distToWave, 0, 120, 1, 0);
        rippleShift +=
          sin(distToWave * 0.1 - PI / 2) *
          r.strength *
          weight;
        this.glowIntensity +=
          weight * (r.strength / 100) * 255;
      }
    }

    this.y =
      height -
      SEA_BASE_Y +
      l * 55 -
      shoreWave +
      retreat +
      rippleShift;
  }


  display(col) {
    push();
    translate(this.baseX, this.y);
    noStroke();
    fill(col);
    rect(0, 0, this.w, this.h);

    let g = constrain(this.glowIntensity, 10, 255);
    if (g > 30) {
      drawingContext.shadowBlur = g / 12;
      drawingContext.shadowColor = `rgba(255,255,180,${g / 255})`;
      fill(255, 255, 200, g);
    } else {
      fill(15, 30, 50);
    }

    if (this.type === "office") {
      for (let i = -this.w / 2 + 7; i < this.w / 2; i += 10)
        for (let j = -this.h / 2 + 8; j < this.h / 2; j += 12)
          rect(i, j, 5, 7);
    } else if (this.type === "home") {
      rect(0, -this.h / 4, this.w / 2, 18);
      rect(0, this.h / 4, this.w / 2, 18);
    } else if (this.type === "school") {
      for (let j = -this.h / 3; j <= this.h / 3; j += 30)
        for (let i = -this.w / 2 + 12; i < this.w / 2; i += 18)
          rect(i, j, 12, 8);
    }
    pop();
  }
}

class Ripple {
  constructor(x, size) {
    this.x = x;
    this.r = 0;
    this.maxR = width * 1.5;
    this.strength = map(size, 15, 80, 20, 100);
    this.speed = 2.8;
  }
  update() {
    this.r += this.speed;
    this.strength *= 0.99;
  }
  finished() {
    return this.strength < 0.2 || this.r > this.maxR;
  }
}

// 三、初始化场景
// 创建画布并生成三层建筑
// ===============================
function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  textFont("serif");

  // 初始化三层建筑背景
  for (let l = 0; l < 3; l++) {
    let count = 25;
    let spacing = width / count;
    for (let i = 0; i < count + 5; i++) {
      layers[l].push(new Building(i * spacing, l));
    }
  }
}


// ===============================
// 四、主循环 draw()
// 控制所有动态元素的更新与绘制顺序
// ===============================
function draw() {
  FRAME++;                 // ← 新增这一行
  background(5, 12, 24);


  // 1. 更新并清理水面涟漪
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].update();
    if (ripples[i].finished()) ripples.splice(i, 1);
  }

  // 2. 绘制并更新三层建筑（受涟漪影响）
  let layerColors = [color(10, 25, 50), color(25, 50, 90), color(50, 80, 130)];
  for (let l = 0; l < 3; l++) {
    for (let b of layers[l]) {
      b.update(l, ripples, stones);
      b.display(layerColors[l]);
    }
  }

  // 3. 鼠标按住时：蓄力生成石头并吸附文字
  if (mouseIsPressed) {
    if (!chargingStone) chargingStone = new Stone(mouseX, mouseY);
    chargingStone.grow();
    chargingStone.update();
    chargingStone.display();
  }

  // 4. 更新已释放的石头（下落、入水、触发涟漪）
  for (let i = stones.length - 1; i >= 0; i--) {
    stones[i].update();
    stones[i].display();

    let surfaceY = getSeaSurfaceY(stones[i].pos.x);

    // 石头首次触水
    if (!stones[i].hitWater && stones[i].pos.y > surfaceY) {
      stones[i].hitWater = true;

      // 生成涟漪
      ripples.push(new Ripple(stones[i].pos.x, stones[i].size));

      // 将文字转移到水面排版系统
      for (let w of stones[i].words) {
        w.initFloating(surfaceY);
        floatingWords.push(w);
      }
      stones[i].words = [];
    }

    if (stones[i].isOffScreen()) stones.splice(i, 1);
  }

  // 5. 更新水面排版文字（位置 + 淡入淡出 + 生命周期）
  for (let i = floatingWords.length - 1; i >= 0; i--) {
    floatingWords[i].updateFloating();
    floatingWords[i].display();

    if (floatingWords[i].isDead()) {
      floatingWords.splice(i, 1);
    }
  }
}


// ===============================
// 五、交互控制
// 鼠标释放时正式抛出石头
// ===============================
function mouseReleased() {
  if (chargingStone) {
    chargingStone.release();
    stones.push(chargingStone);
    chargingStone = null;
  }
}


// ===============================
// 六、辅助函数
// 根据 x 坐标获取当前海面高度
// ===============================
function getSeaSurfaceY(x) {
  let nearest = null;
  let minDist = Infinity;
  for (let b of layers[0]) {
    let d = abs(b.baseX - x);
    if (d < minDist) {
      minDist = d;
      nearest = b;
    }
  }
  return nearest ? nearest.y - nearest.h / 2 - 20 : height - SEA_BASE_Y;
}


// ===============================
// 七、Word 类
// 单个文字：围绕石头旋转 → 入水 → 水面排版 → 消失
// ===============================
class Word {
  constructor(char, stoneSize, orderIndex) {
    this.char = char;
    this.orderIndex = orderIndex;

    this.angle = random(TWO_PI);
    this.dist = stoneSize * 1.2;
    this.rotSpeed = random(0.04, 0.1);

    this.textSize = random(18, 24);
    this.pos = createVector(0, 0);

    this.isFloating = false;
    this.targetPos = createVector(0, 0);
    this.lerpProgress = 0;
    this.noiseOffset = random(1000);

    this.startTime = 0;
    this.alpha = 0;
  }

  // 跟随石头旋转
  updateWithStone(stonePos, stoneSize) {
    this.angle += this.rotSpeed;
    this.dist = lerp(this.dist, stoneSize * 1.1, 0.1);
    this.pos.x = stonePos.x + cos(this.angle) * this.dist;
    this.pos.y = stonePos.y + sin(this.angle) * this.dist;
  }

  // 入水后计算排版目标位置
  initFloating(surfaceY) {
    this.isFloating = true;
    this.startTime = millis();
    this.lerpProgress = 0;

    let availableWidth = width - MARGIN_X * 2;
    let charsPerLine = floor(availableWidth / CHAR_SPACING);

    let col = this.orderIndex % charsPerLine;
    let row = floor(this.orderIndex / charsPerLine);

    this.targetPos.x = MARGIN_X + col * CHAR_SPACING;
    this.targetPos.y = surfaceY - 50 - row * LINE_HEIGHT;
  }

  // 水面状态更新（移动 + 透明度）
  updateFloating() {
    let elapsed = millis() - this.startTime;

    if (elapsed < FADE_TIME) {
      this.alpha = map(elapsed, 0, FADE_TIME, 0, 255);
    } else if (elapsed > DISPLAY_DURATION - FADE_TIME) {
      this.alpha = map(elapsed, DISPLAY_DURATION - FADE_TIME, DISPLAY_DURATION, 255, 0);
    } else {
      this.alpha = 255;
    }

    if (this.lerpProgress < 1.0) this.lerpProgress += 0.015;

    let moveX = lerp(this.pos.x, this.targetPos.x, this.lerpProgress);
    let moveY = lerp(this.pos.y, this.targetPos.y, this.lerpProgress);

    this.pos.x = moveX + cos(FRAME * 0.02 + this.noiseOffset) * 2;
    this.pos.y = moveY + sin(FRAME * 0.03 + this.noiseOffset) * 4;

  }

  isDead() {
    return millis() - this.startTime > DISPLAY_DURATION;
  }

  display() {
    push();
    let glow = map(this.alpha, 0, 255, 0, 15);
    drawingContext.shadowBlur = glow;
    drawingContext.shadowColor = "rgba(255,255,255," + this.alpha / 255 + ")";
    fill(255, this.alpha);
    noStroke();
    textSize(this.textSize);
    text(this.char, this.pos.x, this.pos.y);
    pop();
  }
}


// ===============================
// 八、Stone 类
// 思想的“载体”：蓄力生成、下落、触水、释放文字
// ===============================
class Stone {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0.25);

    this.size = 15;
    this.released = false;
    this.hitWater = false;

    this.words = [];
    this.verts = [];

    let vCount = floor(random(5, 10));
    for (let i = 0; i < vCount; i++) {
      let ang = (TWO_PI / vCount) * i;
      let r = random(0.8, 1.2);
      this.verts.push(createVector(cos(ang) * r, sin(ang) * r));
    }
  }

  // 蓄力增长并吸附文字
  grow() {
    this.size = constrain(this.size + 0.8, 15, 80);
    this.pos.set(mouseX, mouseY);

    if (FRAME % 5 === 0 && globalTextIndex < luXunText.length) {
      let char = luXunText.charAt(globalTextIndex);
      this.words.push(new Word(char, this.size, globalTextIndex));
      globalTextIndex++;
    }
  }

  release() {
    this.released = true;
    this.vel.y = 1;
  }

  update() {
    if (this.released) {
      this.vel.add(this.acc);
      this.pos.add(this.vel);
    }
    for (let w of this.words) {
      w.updateWithStone(this.pos, this.size);
    }
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    fill(60);
    stroke(100);
    beginShape();
    for (let v of this.verts) vertex(v.x * this.size, v.y * this.size);
    endShape(CLOSE);
    pop();

    // 未入水的文字直接跟随显示
    for (let w of this.words) {
      fill(255);
      textSize(w.textSize);
      text(w.char, w.pos.x, w.pos.y);
    }
  }

  isOffScreen() {
    return this.pos.y > height + 200;
  }
}


// ===============================


// ===============================
// 十、窗口适配
// ===============================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
