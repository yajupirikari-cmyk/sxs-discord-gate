# SXS Discord Gateway

SXSサーバーへの入室を自動化する、無機質なデザインの認証ゲートウェイサイトです。
Renderにデプロイすることを前提に構成されています。

## セットアップ手順

### 1. Discord Developer Portal での準備
1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセスします。
2. 「New Application」を作成します。
3. **OAuth2** セクションに移動し、`REDIRECT_URI` を追加します。
   - `https://your-app-name.onrender.com/auth/callback` (RenderのURL)
   - ローカルテスト用: `http://localhost:3000/auth/callback`
4. **Bot** セクションでTokenを取得し、以下の権限のいずれかがあることを確認してください。
   - サーバーへのメンバー追加権限があること（通常、Botがサーバーに存在していればOK）。

### 2. 環境変数の設定
`.env.example` を参考に、Renderのダッシュボードで以下の環境変数を設定してください。

- `DISCORD_CLIENT_ID`: アプリケーションのClient ID
- `DISCORD_CLIENT_SECRET`: アプリケーションのClient Secret
- `DISCORD_BOT_TOKEN`: BotのToken
- `DISCORD_GUILD_ID`: 参加させたいサーバーのID
- `REDIRECT_URI`: 設定したリダイレクトURL

### 3. Renderへのデプロイ
1. このディレクトリをGitHubリポジトリにプッシュします。
2. Renderで「Web Service」を作成し、リポジトリを連携します。
3. `render.yaml` が自動的に読み込まれ、デプロイが開始されます。

## デザインコンセプト
「無機質な黒」を基調とし、装飾を極限まで削ぎ落としたインダストリアルなデザインを採用しています。
高コントラストなモノクローム配色により、SXSのブランドイメージを際立たせています。
