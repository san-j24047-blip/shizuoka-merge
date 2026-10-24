// menu.js
// メニュー画面とゲーム画面の切り替え

document.addEventListener("DOMContentLoaded", () => {
    const menuScreen = document.getElementById("menu-screen");
    const gameScreen = document.getElementById("game-screen");
    const rankingScreen = document.getElementById("ranking-screen");

    const startButton = document.getElementById("start-button");
    const rankingButton = document.getElementById("ranking-button");
    const backButton = document.getElementById("back-button");
    const returnMenuButton = document.getElementById("return-menu-button");
    const menuToggle = document.getElementById("menu-toggle");
    const gameMenu = document.getElementById("game-menu");
    const menuRestartButton = document.getElementById("menu-restart-button");
    const menuReturnButton = document.getElementById("menu-return-button");

    // 必要なHTML要素があるか確認
    if (
        !menuScreen ||
        !gameScreen ||
        !rankingScreen ||
        !startButton ||
        !rankingButton ||
        !backButton
    ) {
        console.error("メニュー画面に必要なHTML要素が見つかりません。");
        return;
    }

    // 指定した画面だけを表示する
    function showScreen(screenToShow) {
        menuScreen.hidden = screenToShow !== menuScreen;
        gameScreen.hidden = screenToShow !== gameScreen;
        rankingScreen.hidden = screenToShow !== rankingScreen;
    }

    // ゲームスタート
    startButton.addEventListener("click", () => {
        showScreen(gameScreen);
        window.startShizuokaGame?.();
    });

    // ランキングを表示
    rankingButton.addEventListener("click", () => {
        showScreen(rankingScreen);
    });

    // メニューに戻る
    backButton.addEventListener("click", () => {
        showScreen(menuScreen);
    });

    returnMenuButton?.addEventListener("click", () => {
        closeGameMenu();
        showScreen(menuScreen);
    });

    function closeGameMenu() {
        if (!gameMenu || !menuToggle) return;
        gameMenu.hidden = true;
        menuToggle.setAttribute("aria-expanded", "false");
    }

    document.addEventListener("click", (event) => {
        if (!gameMenu || gameMenu.hidden || event.target === menuToggle) return;
        closeGameMenu();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeGameMenu();
    });
    menuToggle?.addEventListener("click", () => {
        const isOpening = gameMenu.hidden;
        gameMenu.hidden = !isOpening;
        menuToggle.setAttribute("aria-expanded", String(isOpening));
    });

    menuRestartButton?.addEventListener("click", () => {
        closeGameMenu();
        document.getElementById("restart-button")?.click();
    });

    menuReturnButton?.addEventListener("click", () => {
        closeGameMenu();
        showScreen(menuScreen);
    });

    // 最初はメニューを表示
    showScreen(menuScreen);
});
