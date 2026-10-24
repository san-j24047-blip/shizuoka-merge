// 物理演算を担当する。描画・スコア・DOMには一切触れない。

/* =========================================================
   物理の調整用(ここだけ変えれば調整できます)
========================================================= */
const BODY_RESTITUTION = 0.0;      // 反発。0 = 跳ねない。上げても 0.05 くらいまで
const BODY_FRICTION = 0.8;         // 摩擦
const BODY_FRICTION_STATIC = 1.5;  // 静止摩擦
const BODY_FRICTION_AIR = 0.02;    // 空気抵抗(無駄な回転・暴走を抑える)
const BODY_DENSITY = 0.001;        // 密度
const BODY_SLOP = 0.05;            // 微小なめり込みの許容(ガタガタ防止)
const MAX_SPEED = 14;              // 1ステップの最大速度(px)。小さいほど着地が穏やか
const STEP_MS = 1000 / 60;         // 物理の固定刻み

const Physics = (() => {
  const { Engine, Bodies, Body, Composite, Events } = Matter;

  let engine = null;
  let width = 0;
  let characterMap = new Map();
  let shapeMap = new Map();   // id → 円のリスト(画像の中心が原点)
  let pendingMerges = [];
  let onMerge = null;
  let accumulator = 0;        // 固定刻みで進めるための持ち越し時間

  function init(options) {
    width = options.width;
    onMerge = options.onMerge;
    characterMap = new Map(options.characters.map((c) => [c.id, c]));
    shapeMap = options.shapes ?? new Map();
    pendingMerges = [];
    accumulator = 0;

    if (engine) {
      Events.off(engine, "collisionStart", handleCollisions);
      Engine.clear(engine);
    }

    // 反復回数を増やして、複数の円を持つボディの接触を安定させる
    engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
    engine.gravity.y = 1;

    addWalls(options.width, options.height);
    Events.on(engine, "collisionStart", handleCollisions);
  }

  function addWalls(w, h) {
    const t = 40;
    const wallOptions = { isStatic: true, friction: BODY_FRICTION };
    Composite.add(engine.world, [
      Bodies.rectangle(w / 2, h + t / 2, w, t, wallOptions),
      Bodies.rectangle(-t / 2, h / 2, t, h * 2, wallOptions),
      Bodies.rectangle(w + t / 2, h / 2, t, h * 2, wallOptions)
    ]);
  }

  const MIN_FRICTION = 0.05;  
  // (x, y) に「画像の中心」が来るように、複数の円をまとめた1つのボディを作る
  function createBody(id, x, y) {
    const character = characterMap.get(id);
    const circles = shapeMap.get(id) ?? [{ x: 0, y: 0, r: character.radius }];
    const n = circles.length; // 円の数

    // 摩擦は円(パーツ)ごとの接触でそれぞれ働いて足し合わさるので、円の数で割る
    const friction = Math.max(MIN_FRICTION, BODY_FRICTION / n);
    const frictionStatic = Math.max(MIN_FRICTION, BODY_FRICTION_STATIC / n);

    const options = {
      restitution: BODY_RESTITUTION,
      friction,
      frictionStatic,
      density: BODY_DENSITY,
      slop: BODY_SLOP,
      frictionAir: BODY_FRICTION_AIR
    };

    // 画像の中心を原点として、円パーツを配置する
    const parts = circles.map((c) => Bodies.circle(c.x, c.y, c.r, options));

    // 摩擦や反発は親ボディの値で決まるので、親にも同じ設定を渡す
    const body =
      parts.length === 1 ? parts[0] : Body.create({ parts, ...options });

    // ボディの position は「重心」になる。画像の中心との差を覚えておく
    const local = { x: body.position.x, y: body.position.y };
    body.imageOffset = { x: -local.x, y: -local.y };

    Body.setPosition(body, { x: x + local.x, y: y + local.y });

    body.characterId = id;
    body.createdAt = performance.now();
    body.isMerging = false;

    return body;
  }

  // 重心ではなく、画像の中心の現在位置を返す(回転も考慮)
  function imageCenter(body) {
    const cos = Math.cos(body.angle);
    const sin = Math.sin(body.angle);
    const o = body.imageOffset;
    return {
      x: body.position.x + o.x * cos - o.y * sin,
      y: body.position.y + o.x * sin + o.y * cos
    };
  }

  function handleCollisions(event) {
    for (const pair of event.pairs) {
      // 衝突するのはパーツ(小さい円)なので、親ボディに直す
      const a = pair.bodyA.parent;
      const b = pair.bodyB.parent;

      if (a.characterId === undefined || b.characterId === undefined) continue;
      if (a.characterId !== b.characterId) continue;
      if (a.isMerging || b.isMerging) continue;

      // 最終段階はそれ以上合体しない
      if (characterMap.get(a.characterId).nextId === null) continue;

      // 同じ組が複数のパーツで同時に接触しても、1回だけ処理する
      a.isMerging = true;
      b.isMerging = true;
      pendingMerges.push({ a, b });
    }
  }

  function processMerges() {
    if (pendingMerges.length === 0) return;

    const bodies = new Set(Composite.allBodies(engine.world));

    for (const { a, b } of pendingMerges) {
      if (!bodies.has(a) || !bodies.has(b)) continue;

      const current = characterMap.get(a.characterId);
      const ca = imageCenter(a);
      const cb = imageCenter(b);
      const x = (ca.x + cb.x) / 2;
      const y = (ca.y + cb.y) / 2;

      Composite.remove(engine.world, a);
      Composite.remove(engine.world, b);
      bodies.delete(a);
      bodies.delete(b);

      const merged = createBody(current.nextId, x, y);

      // 合体後の速度をゼロ(静止)にして弾け飛びを防止
      Body.setVelocity(merged, { x: 0, y: 0 });
      Body.setAngularVelocity(merged, 0);

      Composite.add(engine.world, merged);
      bodies.add(merged);

      if (onMerge) onMerge(characterMap.get(current.nextId));
    }

    pendingMerges = [];
  }

  // キャラを指定位置にスポーンさせる(壁からはみ出さないよう補正)
  function spawn(id, x, y) {
    const { radius } = characterMap.get(id);
    const clampedX = Math.max(radius, Math.min(width - radius, x));
    Composite.add(engine.world, createBody(id, clampedX, y));
  }

  // 速度に上限をかけて、着地時のめり込みと跳ね返りを抑える
  function clampSpeeds() {
    for (const body of getCharacterBodies()) {
      const v = body.velocity;
      const speed = Math.hypot(v.x, v.y);
      if (speed > MAX_SPEED) {
        const s = MAX_SPEED / speed;
        Body.setVelocity(body, { x: v.x * s, y: v.y * s });
      }
    }
  }

  // 画面の更新間隔に関わらず、一定の刻み(1/60秒)で物理を進める
  function update(delta) {
    accumulator = Math.min(accumulator + delta, STEP_MS * 4);
    while (accumulator >= STEP_MS) {
      Engine.update(engine, STEP_MS);
      clampSpeeds();
      processMerges();
      accumulator -= STEP_MS;
    }
  }

  // キャラクターのボディだけを返す(壁は含まない)
  function getCharacterBodies() {
    return Composite.allBodies(engine.world).filter(
      (body) => body.characterId !== undefined
    );
  }

  // 描画用: 画像の中心位置と回転角だけを返す(Matter のボディは見せない)
  function getCharacterStates() {
    return getCharacterBodies().map((body) => {
      const c = imageCenter(body);
      return { id: body.characterId, x: c.x, y: c.y, angle: body.angle };
    });
  }

  // ラインより上に、生成から graceMs 以上たったボディがあるか
  function hasBodyAboveLine(lineY, graceMs = 1500) {
    const now = performance.now();
    return getCharacterBodies().some(
      (body) => now - body.createdAt >= graceMs && body.bounds.min.y < lineY
    );
  }

  return {
    init, spawn, update,
    getCharacterBodies, getCharacterStates, hasBodyAboveLine
  };
})();