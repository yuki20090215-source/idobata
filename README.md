# 🪣 いどばた — デプロイ手順書

バーチャル井戸端会議アプリをインターネットに公開する手順です。

---

## 📋 必要なもの

- GitHubアカウント（無料）: https://github.com
- RenderアカウントまたはRailwayアカウント（無料）
- **どちらか1つ** のAPIキー:
  - OpenAI (ChatGPT): https://platform.openai.com/api-keys
  - Google Gemini: https://aistudio.google.com/app/apikey

---

## 🔑 STEP 1: APIキーを取得する

### ChatGPT (OpenAI) を使う場合 ★おすすめ
1. https://platform.openai.com/api-keys を開く
2. 「Create new secret key」をクリック
3. 表示されたキー（`sk-...`）をコピーして保存
4. ※クレジットカード登録が必要。$5〜$10チャージすれば数ヶ月使える

### Gemini (Google) を使う場合（無料枠あり）
1. https://aistudio.google.com/app/apikey を開く
2. Googleアカウントでログイン
3. 「Create API Key」をクリック
4. 表示されたキー（`AIza...`）をコピーして保存

---

## 🐙 STEP 2: GitHubにアップロード

1. https://github.com/new でリポジトリを作成
   - Repository name: `idobata`
   - Public または Private どちらでもOK
   - 「Create repository」をクリック

2. このフォルダをGitHubにアップロード:
   ```bash
   cd idobata
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/あなたのユーザー名/idobata.git
   git push -u origin main
   ```

   ※ GitHubのWebサイトから直接ファイルをアップロードしてもOK

---

## 🚀 STEP 3-A: Render でデプロイ（おすすめ・無料）

1. https://render.com でアカウント作成（GitHub連携）

2. ダッシュボードで「New +」→「Web Service」

3. GitHubのリポジトリを選択

4. 設定:
   - **Name**: `idobata`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

5. 「Environment Variables」で環境変数を追加:
   | Key | Value |
   |-----|-------|
   | `AI_PROVIDER` | `openai` または `gemini` |
   | `OPENAI_API_KEY` | `sk-...`（OpenAIの場合） |
   | `GEMINI_API_KEY` | `AIza...`（Geminiの場合） |

6. 「Create Web Service」をクリック

7. 数分でデプロイ完了！URLが発行されます（例: `https://idobata-xxxx.onrender.com`）

---

## 🚂 STEP 3-B: Railway でデプロイ

1. https://railway.app でGitHubアカウントでログイン

2. 「New Project」→「Deploy from GitHub repo」

3. リポジトリを選択

4. 「Variables」タブで環境変数を追加:
   - `AI_PROVIDER` = `openai`
   - `OPENAI_API_KEY` = `sk-...`

5. 自動でデプロイ開始。URLが発行される

---

## ⚠️ 注意点

### Renderの無料プランについて
- 15分間アクセスがないとスリープする
- スリープ後の初回アクセスは30秒〜1分かかる
- 月750時間まで無料

### APIの費用について
- OpenAI: 1投稿あたり約0.01〜0.02円（非常に安い）
- Gemini: 無料枠内で月1500リクエストまで無料

---

## 🔧 ローカルで動かす方法（テスト用）

```bash
# 1. 依存パッケージをインストール
npm install

# 2. .envファイルを作成
cp .env.example .env
# .envを編集してAPIキーを入力

# 3. サーバー起動
npm start

# 4. ブラウザで開く
# http://localhost:3000
```

---

## 📁 ファイル構成

```
idobata/
├── server.js          ← バックエンド（Node.js + Express）
├── package.json       ← 依存パッケージ定義
├── .env.example       ← 環境変数テンプレート
├── .env               ← 実際の環境変数（※GitHubにあげない！）
├── .gitignore         ← Git除外設定
└── public/
    └── index.html     ← フロントエンド（HTML/CSS/JS）
```

---

## ❓ よくある問題

**Q: AIが返信しない**
→ 環境変数が正しく設定されているか確認。`/api/health`にアクセスして`hasKey: true`になっているか確認

**Q: Renderでスリープして遅い**
→ UptimeRobotなどの無料監視ツールで定期的にアクセスさせるとスリープしなくなる

**Q: APIキーのお金が心配**
→ OpenAIのダッシュボードでUsage Limitsを$5などに設定しておくと安心
