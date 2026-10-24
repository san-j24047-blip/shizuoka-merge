# 静岡県スイカゲーム

HTML・CSS・JavaScript・Matter.jsで動作する、静岡県の名産品を合体させるゲームです。

## 起動方法

`index.html` をブラウザで開いてください。Matter.jsとSupabase JSはCDNから読み込むため、インターネット接続が必要です。

## 構成

- `index.html`：メニュー、ゲーム、ランキング画面と各スクリプトの読み込み
- `characters.js`：11段階のキャラクター情報
- `game.js`：入力、描画、スコア、ゲームオーバー処理
- `physics.js`：Matter.jsによる落下・衝突・合体
- `shape.js`：画像から当たり判定用の形状を生成
- `menu.js`：画面切り替え
- `supabase.js`：オンラインランキング
- `style.css`：レイアウトと画面デザイン
- `images/`：キャラクター画像

ランキング用のSupabase設定は `supabase.js` に既存の公開用キーで設定されています。Secret Keyやservice_roleキーはブラウザに置かないでください。
