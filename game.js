const { Engine, Bodies, Body, Composite, Events } = Matter;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const DROP_Y = 48;
const GAME_OVER_Y = 65;
const DROP_INTERVAL = 450;

let engine;
let score = 0;
let currentId = 0;
let nextId = 0;
let pointerX = WIDTH / 2;
let lastDropTime = 0;
let gameOver = false;
let lastFrameTime = 0;

let pendingMerges = [];
let charactersById = new Map();

function getCharacter(id) {
  return charactersById.get(id);
}

function randomSmallCharacter() {
  // 最初の3種類からランダムに選ぶ
  return Math.floor(Math.random() * 3);
}

function createCharacterBody(id, x, y) {
  const character = getCharacter(id);

  const body = Bodies.circle(
    x,
    y,
    character.radius,
    {
      restitution: 0.05,
      friction: 0.45,
      frictionStatic: 0.8,
      density: 0.001,
      slop: 0.02
    }
  );

  body.characterId = id;
  body.createdAt = performance.now();
  body.isMerging = false;

  return body;
}

function setupPhysics() {
  engine = Engine.create();
  engine.gravity.y = 1;

  const wallThickness = 40;

  const floor = Bodies.rectangle(
    WIDTH / 2,
    HEIGHT + wallThickness / 2,
    WIDTH,
    wallThickness,
    { isStatic: true }
  );

  const leftWall = Bodies.rectangle(
    -wallThickness / 2,
    HEIGHT / 2,
    wallThickness,
    HEIGHT * 2,
    { isStatic: true }
  );

  const rightWall = Bodies.rectangle(
    WIDTH + wallThickness / 2,
    HEIGHT / 2,
    wallThickness,
    HEIGHT * 2,
    { isStatic: true }
  );

  Composite.add(engine.world, [
    floor,
    leftWall,
    rightWall
  ]);

  Events.on(engine, "collisionStart", handleCollisions);
}

function handleCollisions(event) {
  for (const pair of event.pairs) {
    const a = pair.bodyA;
    const b = pair.bodyB;

    if (
      a.characterId === undefined ||
      b.characterId === undefined
    ) {
      continue;
    }

    if (a.characterId !== b.characterId) {
      continue;
    }

    if (a.isMerging || b.isMerging) {
      continue;
    }

    const character = getCharacter(a.characterId);

    // 最終段階はそれ以上合体しない
    if (character.next === null) {
      continue;
    }

    // 同じ衝突を重複処理しない
    a.isMerging = true;
    b.isMerging = true;

    pendingMerges.push({ a, b });
  }
}

function processMerges() {
  const bodies = new Set(
    Composite.allBodies(engine.world)
  );

  while (pendingMerges.length > 0) {
    const { a, b } = pendingMerges.shift();

    if (!bodies.has(a) || !bodies.has(b)) {
      continue;
    }

    const character = getCharacter(a.characterId);

    if (character.next === null) {
      continue;
    }

    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;

    // 2体を消してから次のキャラを生成
    Composite.remove(engine.world, a);
    Composite.remove(engine.world, b);

    bodies.delete(a);
    bodies.delete(b);

    const merged = createCharacterBody(
      character.next,
      x,
      y
    );

    Composite.add(engine.world, merged);
    bodies.add(merged);

    score += getCharacter(character.next).score;
    updateScore();
  }
}

function dropCharacter() {
  if (gameOver) return;

  const now = performance.now();

  if (now - lastDropTime < DROP_INTERVAL) {
    return;
  }

  const character = getCharacter(currentId);

  const x = Math.max(
    character.radius,
    Math.min(
      WIDTH - character.radius,
      pointerX
    )
  );

  const body = createCharacterBody(
    currentId,
    x,
    DROP_Y
  );

  Composite.add(engine.world, body);

  lastDropTime = now;

  currentId = nextId;
  nextId = randomSmallCharacter();

  updatePreview();
}

function updateScore() {
  document.getElementById("score").textContent = score;
}

function updatePreview() {
  document.getElementById("next-character").textContent =
    getCharacter(nextId).emoji;
}

function checkGameOver() {
  const now = performance.now();

  const bodies = Composite.allBodies(engine.world);

  for (const body of bodies) {
    if (body.characterId === undefined) {
      continue;
    }

    if (now - body.createdAt < 1500) {
      continue;
    }

    if (body.bounds.min.y < GAME_OVER_Y) {
      endGame();
      return;
    }
  }
}

function endGame() {
  if (gameOver) return;

  gameOver = true;

  document.getElementById("final-score").textContent =
    score;

  document.getElementById("game-over")
    .classList.remove("hidden");
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // 背景
  ctx.fillStyle = "#e7f4fa";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ゲームオーバー判定ライン
  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = "#e18b83";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GAME_OVER_Y);
  ctx.lineTo(WIDTH, GAME_OVER_Y);
  ctx.stroke();
  ctx.restore();

  // 落下位置のガイド
  if (!gameOver) {
    const character = getCharacter(currentId);

    const x = Math.max(
      character.radius,
      Math.min(
        WIDTH - character.radius,
        pointerX
      )
    );

    ctx.strokeStyle = "#8aa7b2";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(x, DROP_Y + character.radius);
    ctx.lineTo(x, HEIGHT - 5);
    ctx.stroke();
    ctx.setLineDash([]);

    drawEmoji(
      character,
      x,
      DROP_Y,
      0.75
    );
  }

  // キャラクターを描画
  for (const body of Composite.allBodies(engine.world)) {
    if (body.characterId === undefined) {
      continue;
    }

    const character = getCharacter(body.characterId);

    drawEmoji(
      character,
      body.position.x,
      body.position.y,
      1
    );
  }
}

function drawEmoji(character, x, y, scale = 1) {
  ctx.save();

  ctx.beginPath();
  ctx.arc(
    x,
    y,
    character.radius * scale,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.strokeStyle = "#b7d5c2";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font =
    `${character.radius * 1.45 * scale}px sans-serif`;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    character.emoji,
    x,
    y + 1
  );

  ctx.restore();
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();

  pointerX =
    (event.clientX - rect.left) *
    (WIDTH / rect.width);

  const character = getCharacter(currentId);

  pointerX = Math.max(
    character.radius,
    Math.min(
      WIDTH - character.radius,
      pointerX
    )
  );
}

function renderEvolutionList() {
  const list = document.getElementById("evolution-list");

  list.innerHTML = CHARACTERS.map(character => {
    const next = character.next === null
      ? null
      : getCharacter(character.next);

    return `
      <div class="evolution-item">
        <div class="icons">
          ${character.emoji}
          ${next ? `→ ${next.emoji}` : "★"}
        </div>
        <div>${character.name}</div>
        <div>
          ${next ? "2体で合体すると進化" : "最終段階"}
        </div>
      </div>
    `;
  }).join("");
}

function gameLoop(time) {
  if (!engine) return;

  const delta = lastFrameTime
    ? Math.min(time - lastFrameTime, 33.333)
    : 1000 / 60;

  lastFrameTime = time;

  if (!gameOver) {
    Engine.update(engine, delta);
    processMerges();
    checkGameOver();
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  if (engine) {
    Events.off(engine, "collisionStart", handleCollisions);
    Engine.clear(engine);
  }

  charactersById = new Map(
    CHARACTERS.map(character => [
      character.id,
      character
    ])
  );

  score = 0;
  gameOver = false;
  pendingMerges = [];
  lastDropTime = 0;
  lastFrameTime = 0;
  pointerX = WIDTH / 2;

  currentId = randomSmallCharacter();
  nextId = randomSmallCharacter();

  document.getElementById("game-over")
    .classList.add("hidden");

  updateScore();
  updatePreview();
  renderEvolutionList();

  setupPhysics();
}

canvas.addEventListener("pointermove", updatePointer);

canvas.addEventListener("pointerdown", event => {
  event.preventDefault();
  updatePointer(event);
  dropCharacter();
});

document.getElementById("restart").addEventListener(
  "click",
  startGame
);

startGame();
requestAnimationFrame(gameLoop);