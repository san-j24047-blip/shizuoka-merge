/* =========================================================
   精度の設定(ここだけ変えれば調整できます)
========================================================= */

// マス分割数 (大きすぎると細かくなりすぎて物理重算が重くなり暴走しやすくなります)
const SHAPE_GRID_CELLS = 36; // 例: 6×6 程度に設定

// マス内の不透明ピクセルの割合閾値
const SHAPE_FILL_THRESHOLD = 0.25;

// 不透明度の基準
const SHAPE_ALPHA_THRESHOLD = 0.8;

// 円のスケール (★1.0より少し小さく(0.70〜0.80)にすることでパーツ同士の過度な重なりを防ぎます)
const SHAPE_CIRCLE_SCALE = 0.75;

// 中心を重心に寄せる
const SHAPE_USE_CENTROID = true;

const SHAPE_READ_SIZE = 256;
const SHAPE_LOG = true;

/* =========================================================
   本体
   返す座標は「画像の中心を原点」とした px 単位。
========================================================= */
const Shape = (() => {
  function rasterize(img, readSize, alphaMin) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = readSize / Math.max(iw, ih);
    const gw = Math.max(1, Math.round(iw * scale));
    const gh = Math.max(1, Math.round(ih * scale));

    const canvas = document.createElement("canvas");
    canvas.width = gw;
    canvas.height = gh;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, gw, gh);

    let data;
    try {
      data = g.getImageData(0, 0, gw, gh).data;
    } catch (e) {
      console.warn("画像を読み取れませんでした(file:// で開いていませんか?)", e);
      return null;
    }

    const solid = new Uint8Array(gw * gh);
    let count = 0;
    for (let i = 0; i < solid.length; i++) {
      if (data[i * 4 + 3] >= alphaMin) { solid[i] = 1; count++; }
    }

    // 透明部分がほぼ無い画像 → 四隅の色を背景として外周から除去
    if (count > gw * gh * 0.98) removeBackground(data, solid, gw, gh);

    return { solid, gw, gh };
  }

  function removeBackground(data, solid, gw, gh) {
    const px = (x, y) => {
      const i = (y * gw + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const diff = (a, b) =>
      Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const corners = [px(0, 0), px(gw - 1, 0), px(0, gh - 1), px(gw - 1, gh - 1)];
    const bg = corners[0];
    if (corners.some((c) => diff(c, bg) > 40)) return;

    const TOL = 60;
    const visited = new Uint8Array(gw * gh);
    const stack = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= gw || y >= gh) return;
      const i = y * gw + x;
      if (visited[i]) return;
      visited[i] = 1;
      if (diff(px(x, y), bg) <= TOL) stack.push(i);
    };
    for (let x = 0; x < gw; x++) { push(x, 0); push(x, gh - 1); }
    for (let y = 0; y < gh; y++) { push(0, y); push(gw - 1, y); }
    while (stack.length) {
      const i = stack.pop();
      solid[i] = 0;
      const x = i % gw, y = (i / gw) | 0;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
  }

  // img: 読み込み済みの画像 / size: 画像の「長辺」の長さ(px)
  function fromImage(img, size, options = {}) {
    const cfg = {
      gridCells: SHAPE_GRID_CELLS,
      fillThreshold: SHAPE_FILL_THRESHOLD,
      alphaThreshold: SHAPE_ALPHA_THRESHOLD,
      circleScale: SHAPE_CIRCLE_SCALE,
      useCentroid: SHAPE_USE_CENTROID,
      readSize: SHAPE_READ_SIZE,
      ...options
    };

    const raster = rasterize(img, cfg.readSize, Math.round(cfg.alphaThreshold * 255));
    if (!raster) return null;
    const { solid, gw, gh } = raster;

    // 正方形に近いマスで、画像全体をちょうど割り切る
    const cell = Math.sqrt((gw * gh) / cfg.gridCells);
    const cols = Math.max(1, Math.round(gw / cell));
    const rows = Math.max(1, Math.round(gh / cell));
    const cellW = gw / cols;
    const cellH = gh / rows;
    const radius = (Math.min(cellW, cellH) / 2) * cfg.circleScale;

    const circles = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x0 = Math.round(col * cellW), x1 = Math.round((col + 1) * cellW);
        const y0 = Math.round(row * cellH), y1 = Math.round((row + 1) * cellH);
        const area = (x1 - x0) * (y1 - y0);
        if (area <= 0) continue;

        let count = 0, sx = 0, sy = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            if (solid[y * gw + x]) { count++; sx += x + 0.5; sy += y + 0.5; }
          }
        }
        if (count / area < cfg.fillThreshold) continue;

        circles.push({
          cx: cfg.useCentroid ? sx / count : (x0 + x1) / 2,
          cy: cfg.useCentroid ? sy / count : (y0 + y1) / 2
        });
      }
    }

    if (circles.length === 0) return null;

    if (SHAPE_LOG) {
      console.log(`[Shape] ${cols}×${rows} マス → 円 ${circles.length}個`);
    }

    // 読み取り座標 → 画像中心を原点とした px 座標(長辺 = size)
    const k = size / Math.max(gw, gh);
    return circles.map((c) => ({
      x: (c.cx - gw / 2) * k,
      y: (c.cy - gh / 2) * k,
      r: radius * k
    }));
  }

  return { fromImage };
})();