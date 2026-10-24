
const SUPABASE_URL = "https://ybalylaoafkztsmxeogw.supabase.co/";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QmKCP2RDvbBeqbFxbVcK8g_u65JT64d";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// HTMLの要素
const rankingList = document.getElementById("ranking-list");

const registerScoreButton =
    document.getElementById("register-score-button");
const skipRegistrationButton =
    document.getElementById("skip-registration-button");

const registrationArea =
    document.getElementById("score-registration");
const registrationForm =
    document.getElementById("score-registration-form");

const playerNameInput =
    document.getElementById("score-player-name");
const submitScoreButton =
    document.getElementById("submit-score-button");
const cancelRegistrationButton =
    document.getElementById("cancel-registration-button");

const registrationMessage =
    document.getElementById("score-registration-message");

// 前回のプレイヤー名を読み込む
const savedPlayerName = localStorage.getItem("playerName");

if (savedPlayerName) {
    playerNameInput.value = savedPlayerName;
}

// 登録するを押したとき
registerScoreButton.addEventListener("click", () => {
    registrationArea.hidden = true;
    registrationForm.hidden = false;
    registrationMessage.textContent = "";
    playerNameInput.focus();
});

// 登録しないを押したとき
skipRegistrationButton.addEventListener("click", () => {
    registrationArea.hidden = true;
    registrationMessage.textContent = "";
});

// 名前入力画面から戻る
cancelRegistrationButton.addEventListener("click", () => {
    registrationForm.hidden = true;
    registrationArea.hidden = false;
    registrationMessage.textContent = "";
});

// スコアを登録する
submitScoreButton.addEventListener("click", async () => {
    const playerName = playerNameInput.value.trim();

    const scoreElement = document.getElementById("final-score");
    const score = Number(scoreElement.textContent);

    if (playerName.length < 1 || playerName.length > 12) {
        registrationMessage.textContent =
            "名前は1〜12文字で入力してください。";
        return;
    }

    if (!Number.isSafeInteger(score) || score < 0) {
        registrationMessage.textContent =
            "スコアを正しく取得できませんでした。";
        return;
    }

    submitScoreButton.disabled = true;
    registrationMessage.textContent = "登録しています...";

    try {
        const { error } = await supabaseClient
            .from("rankings")
            .insert({
                player_name: playerName,
                score: score
            });

        if (error) {
            console.error("スコア登録エラー:", error.message);
            registrationMessage.textContent =
                "登録に失敗しました。もう一度お試しください。";
            return;
        }

        // 登録成功後に名前を保存
        localStorage.setItem("playerName", playerName);

        registrationMessage.textContent =
            "ランキングに登録しました！";

        // ランキングデータを更新
        await loadOnlineRanking();
    } catch (error) {
        console.error("通信エラー:", error);
        registrationMessage.textContent =
            "通信に失敗しました。接続を確認してください。";
    } finally {
        submitScoreButton.disabled = false;
    }
});

// オンラインランキングを取得する
async function loadOnlineRanking() {
    if (!rankingList) return;

    rankingList.textContent = "ランキングを読み込み中...";

    const { data, error } = await supabaseClient
        .from("rankings")
        .select("player_name, score, created_at")
        .order("score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(10);

    if (error) {
        console.error("ランキング取得エラー:", error.message);
        rankingList.textContent =
            "ランキングを取得できませんでした。";
        return;
    }

    rankingList.replaceChildren();

    if (data.length === 0) {
        rankingList.textContent =
            "まだランキングデータがありません。";
        return;
    }

    data.forEach((entry, index) => {
        const item = document.createElement("p");
        item.textContent =
            `${index + 1}位：${entry.player_name} — ${entry.score}点`;

        rankingList.appendChild(item);
    });
}

// ランキング画面を開いたら最新データを取得
const rankingButton = document.getElementById("ranking-button");

if (rankingButton) {
    rankingButton.addEventListener("click", loadOnlineRanking);
}

// 初回読み込み
loadOnlineRanking();
