const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYFIELD = { left: 0, right: WIDTH, bottom: HEIGHT };
const DROP_Y = 48;
const GAME_OVER_Y = 65;
const DROP_INTERVAL = 450;
const SMALL_CHARACTER_COUNT = 5;

const charactersById = new Map(characters.map((c) => [c.id, c]));

let score = 0;
let currentId = 0;
let nextId = 0;
let pointerX = WIDTH / 2;
let lastDropTime = 0;
let gameOver = false;
let lastFrameTime = 0;
let debugShapes = false; // D キーで当たり判定を一時表示
let mergeEffects = [];

/* =========================
   画像の読み込み
========================= */

const imageCache = new Map();
const shapes = new Map(); // id → 円のリスト
let dropperImage = null;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn("画像を読み込めません:", src);
      resolve(null);
    };
    img.src = src;
  });
}

async function loadAssets() {
  await Promise.all(
    characters.map(async (character) => {
      try {
        const img = await loadImage(character.image);
        if (!img) return;
        imageCache.set(character.id, img);

        // 形を解析（もしセキュリティ制限で失敗しても、フォールバックで通常の丸を生成する）
        const circles = Shape.fromImage(img, character.radius * 2);
        if (circles) {
          shapes.set(character.id, circles);
        } else {
          // 【安全対策】解析に失敗した場合は、キャラクターの半径の円を1つだけ登録して続行させる
          shapes.set(character.id, [{ x: 0, y: 0, r: character.radius }]);
        }
      } catch (e) {
        // 万が一エラーが出てもゲームを止めない
        shapes.set(character.id, [{ x: 0, y: 0, r: character.radius }]);
      }
    })
  );

  dropperImage = await loadImage("images/shizuoka-3.png");
  if (dropperImage) {
    // 白背景だけを外側から透明化し、キャラクター内の白い目は残す
    const temp = document.createElement("canvas");
    temp.width = dropperImage.naturalWidth;
    temp.height = dropperImage.naturalHeight;
    const tempContext = temp.getContext("2d", { willReadFrequently: true });
    tempContext.drawImage(dropperImage, 0, 0);
    const pixels = tempContext.getImageData(0, 0, temp.width, temp.height);
    const { data, width, height } = pixels;
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    const addIfBackground = (index) => {
      const offset = index * 4;
      if (data[offset + 3] && data[offset] > 247 && data[offset + 1] > 247 && data[offset + 2] > 247) {
        data[offset + 3] = 0;
        queue[tail++] = index;
      }
    };
    for (let x = 0; x < width; x++) {
      addIfBackground(x);
      addIfBackground((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y++) {
      addIfBackground(y * width);
      addIfBackground(y * width + width - 1);
    }
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      if (x > 0) addIfBackground(index - 1);
      if (x < width - 1) addIfBackground(index + 1);
      if (index >= width) addIfBackground(index - width);
      if (index < width * (height - 1)) addIfBackground(index + width);
    }
    tempContext.putImageData(pixels, 0, 0);
    dropperImage = await loadImage(temp.toDataURL("image/png"));
  }
}

/* =========================
   進化一覧に円つきプレビュー
========================= */

function addShapePreviews() {
  const items = document.querySelectorAll(".evolution-item");
  characters.forEach((character, i) => {
    const item = items[i];
    const img = imageCache.get(character.id);
    if (!item || !img) return;

    const S = 96;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const g = c.getContext("2d");
    const k = S / (character.radius * 2);
    const off = shapes.get(character.id)?.imageOffset ?? { x: 0, y: 0 };

    g.translate(S / 2 - off.x * k, S / 2 - off.y * k); // 画像中心が中央に来るよう移動
    const s = Math.min(S / img.width, S / img.height);
    const w = img.width * s, h = img.height * s;
    g.drawImage(img, -w / 2 + off.x * k, -h / 2 + off.y * k, w, h);

    // 円は重心基準なので、重心が原点になるよう戻して描く
    g.setTransform(1, 0, 0, 1, S / 2 - off.x * k, S / 2 - off.y * k);
    drawShapeCircles(g, shapes.get(character.id), k);
    item.appendChild(c);
  });
}

/* =========================
   ゲーム進行
========================= */

function getCharacter(id) {
  return charactersById.get(id);
}

function randomSmallCharacterId() {
  return characters[Math.floor(Math.random() * SMALL_CHARACTER_COUNT)].id;
}

function handleMerge(newCharacter, x, y) {
  score += newCharacter.score ?? newCharacter.stage;
  updateScore();
  createMergeEffect(x, y, newCharacter.stage);
}

function createMergeEffect(x, y, stage) {
  const colors = ["#ffd166", "#ff9f43", "#8bcf7a", "#ffffff"];
  const now = performance.now();
  const particles = Array.from({ length: 14 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 14 + Math.random() * 0.18;
    const speed = 35 + Math.random() * 75;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 18,
      size: 2.5 + Math.random() * 3.5,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  });

  mergeEffects.push({ x, y, stage, startedAt: now, particles });
}

function dropCharacter() {
  if (gameOver) return;

  const now = performance.now();
  if (now - lastDropTime < DROP_INTERVAL) return;

  Physics.spawn(currentId, pointerX, DROP_Y);
  lastDropTime = now;

  currentId = nextId;
  nextId = randomSmallCharacterId();
  updatePreview();
}

function checkGameOver() {
  if (Physics.hasBodyAboveLine(GAME_OVER_Y)) endGame();
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  document.getElementById("final-score").textContent = score;
  document.getElementById("game-over").classList.remove("hidden");
}

/* =========================
   UI更新
========================= */

function updateScore() {
  document.getElementById("score").textContent = score;
}

function updatePreview() {
  document.getElementById("next-character").textContent = getCharacter(nextId).name;
}

/* =========================
   描画
========================= */

function clampX(x, radius) {
  return Math.max(PLAYFIELD.left + radius, Math.min(PLAYFIELD.right - radius, x));
}

function drawShapeCircles(g, circles, scale = 1) {
  if (!circles) return;
  g.save();
  g.lineWidth = 1;
  g.strokeStyle = "rgba(255, 0, 0, 0.9)";
  g.fillStyle = "rgba(255, 0, 0, 0.18)";
  for (const c of circles) {
    g.beginPath();
    g.arc(c.x * scale, c.y * scale, c.r * scale, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // 重心(=ボディの位置)
  g.fillStyle = "rgba(0, 0, 255, 0.9)";
  g.beginPath();
  g.arc(0, 0, 2, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = "#e18b83";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GAME_OVER_Y);
  ctx.lineTo(WIDTH, GAME_OVER_Y);
  ctx.stroke();
  ctx.restore();

  if (!gameOver) {
    const character = getCharacter(currentId);
    const x = clampX(pointerX, character.radius);

    ctx.save();
    ctx.strokeStyle = "#8aa7b2";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(x, DROP_Y + character.radius + 18);
    ctx.lineTo(x, HEIGHT - 5);
    ctx.stroke();
    ctx.restore();

    if (dropperImage) {
      ctx.drawImage(dropperImage, x - 28, 3, 56, 56);
    }
    drawCharacter(character, x, DROP_Y + 10, 0.65);
  }

  for (const s of Physics.getCharacterStates()) {
    drawCharacter(getCharacter(s.id), s.x, s.y, 1, s.angle);
  }

  drawMergeEffects(performance.now());

}

function drawMergeEffects(now) {
  mergeEffects = mergeEffects.filter((effect) => now - effect.startedAt < 620);

  for (const effect of mergeEffects) {
    const elapsed = now - effect.startedAt;
    const progress = elapsed / 620;
    const alpha = 1 - progress;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.strokeStyle = effect.stage >= 8 ? "#fff2a6" : "#ffffff";
    ctx.lineWidth = 3 - progress * 1.5;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, 8 + progress * 34, 0, Math.PI * 2);
    ctx.stroke();

    for (const particle of effect.particles) {
      const px = effect.x + particle.vx * progress * 0.62;
      const py = effect.y + particle.vy * progress * 0.62 + 24 * progress * progress;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(px, py, particle.size * (1 - progress * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }

    if (elapsed < 300) {
      ctx.fillStyle = "#fff8d9";
      ctx.strokeStyle = "#e2a83d";
      ctx.lineWidth = 1.5;
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText("合体！", effect.x, effect.y - 26 - progress * 8);
      ctx.fillText("合体！", effect.x, effect.y - 26 - progress * 8);
    }
    ctx.restore();
  }
}

// x, y はボディの位置(= 円の重心)
function drawCharacter(character, x, y, scale = 1, angle = 0) {
  const r = character.radius * scale;
  const img = imageCache.get(character.id);
  const circles = shapes.get(character.id);
  const off = circles?.imageOffset ?? { x: 0, y: 0 };

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (img) {
    // 長辺が 2r になるよう縦横比を保って縮小(shape.js と同じ)
    const s = Math.min((r * 2) / img.width, (r * 2) / img.height);
    const w = img.width * s;
    const h = img.height * s;
    // 画像の中心は重心から imageOffset だけずれた位置
    ctx.drawImage(img, off.x * scale - w / 2, off.y * scale - h / 2, w, h);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#b7d5c2";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#35443a";
    ctx.font = `bold ${r * 0.9}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(character.name[0], 0, 1);
  }

  if (debugShapes) {
    if (circles) {
      drawShapeCircles(ctx, circles, scale);
    } else {
      // 円の生成に失敗したキャラは、オレンジの点線の円で目印を出す
      ctx.save();
      ctx.strokeStyle = "orange";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

/* =========================
   入力
========================= */

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (WIDTH / rect.width);
  pointerX = clampX(x, getCharacter(currentId).radius);
}

canvas.addEventListener("pointermove", updatePointer);

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  updatePointer(event);
  dropCharacter();
});

document.getElementById("restart-button").addEventListener("click", startGame);

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyD") debugShapes = !debugShapes;
});

/* =========================
   メインループ
========================= */

function gameLoop(time) {
  const delta = lastFrameTime ? Math.min(time - lastFrameTime, 33.333) : 1000 / 60;
  lastFrameTime = time;

  if (!gameOver) {
    Physics.update(delta);
    checkGameOver();
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  score = 0;
  gameOver = false;
  mergeEffects = [];
  lastDropTime = 0;
  lastFrameTime = 0;
  pointerX = WIDTH / 2;

  currentId = randomSmallCharacterId();
  nextId = randomSmallCharacterId();

  document.getElementById("game-over").classList.add("hidden");

  updateScore();
  updatePreview();
  document.dispatchEvent(new Event("shizuoka:new-game"));

  Physics.init({
    width: WIDTH,
    height: HEIGHT,
    playfield: PLAYFIELD,
    characters,
    shapes,
    onMerge: handleMerge
  });
}

window.startShizuokaGame = startGame;

// 起動は画像の読み込み後に1回だけ
window.addEventListener("load", () => {
  loadAssets()
    .catch((e) => console.error(e))
    .finally(() => {
      addShapePreviews();
      startGame();
      requestAnimationFrame(gameLoop);
    });
});



