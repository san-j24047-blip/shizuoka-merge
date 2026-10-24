// 1. canvas とコンテキストの準備を先に行う
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = 1920;
canvas.height = 1080;

let parts = [];

// Part クラスの定義
class Part {
    // 引数の順番を揃える（weightを追加、あるいは今回は使わないので削除でもOK）
    constructor(x, y, radius, speedX, speedY, weight, type) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speedX = speedX;
        this.speedY = speedY;
        this.weight = weight; // スペルミスを修正 (tihs → this)
        this.type = type;

        this.gravity = 0.5;
        this.bounce = 0.7;
        this.friction = 0.99;
        this.setupTypeProperties();
    }

    setupTypeProperties() {
        const colors = ["#ff6b6b", "#4dabf7", "#69db7c"];
        this.color = colors[this.type % colors.length];
    }

    update() {
        this.speedY += this.gravity;

        this.x += this.speedX;
        this.y += this.speedY;

        this.speedX *= this.friction;

        // 床
        if (this.y + this.radius > canvas.height) {
            this.y = canvas.height - this.radius;
            this.speedY = -this.speedY * this.bounce;
        }

        // 左右の壁
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.speedX = -this.speedX * this.bounce;
        } else if (this.x + this.radius > canvas.width) {
            this.x = canvas.width - this.radius;
            this.speedX = -this.speedX * this.bounce;
        }

        // 天井
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.speedY = -this.speedY * this.bounce;
        }
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

// ボタンのイベント設定
const dropBtn = document.getElementById('drop-btn');

dropBtn.addEventListener('click', () => {
    const radius = Math.random() * 40 + 10;
    const x = Math.random() * canvas.width;
    const y = Math.random() * (canvas.height / 2);
    const speedX = 0;
    const speedY = 0;
    const weight = 3; // コンストラクタに合わせて追加
    const type = Math.floor(Math.random() * 3);

    // 引数を7個すべて渡す
    parts.push(new Part(x, y, radius, speedX, speedY, weight, type));
});

function init() {
    parts = [];
}

init();

// メインループ
function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 衝突判定
    for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
            const dx = parts[j].x - parts[i].x;
            const dy = parts[j].y - parts[i].y;
            const distSq = dx * dx + dy * dy;
            const minDist = parts[i].radius + parts[j].radius;

            if (distSq < minDist * minDist) {
                const distance = Math.sqrt(distSq) || 0.0001;
                const overlap = minDist - distance;
                const nx = dx / distance;
                const ny = dy / distance;

                parts[i].x -= nx * overlap * 0.5;
                parts[i].y -= ny * overlap * 0.5;
                parts[j].x += nx * overlap * 0.5;
                parts[j].y += ny * overlap * 0.5;

                const force = overlap * 0.1;
                parts[i].speedX -= nx * force * 3;
                parts[i].speedY -= ny * force * 3;
                parts[j].speedX += nx * force * 3;
                parts[j].speedY += ny * force * 3;
            }
        }
    }

    // 更新と描画
    for (let i = 0; i < parts.length; i++) {
        parts[i].update();
        parts[i].draw();
    }

    requestAnimationFrame(loop);
}

loop();