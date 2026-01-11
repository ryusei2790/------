# 英単語学習Slack Bot

Notionに保存された英単語データベースから、毎時間自動的にテストを生成してSlackで配信する適応型学習システム。

## 概要

このSlack Botは以下の機能を提供します：

- 📚 **毎時自動テスト配信**: 日中の毎時間、5問の英単語テストを自動生成・配信
- 🎯 **適応型学習**: 正解率が低い単語を優先的に出題（重み付けランダム選択）
- 💬 **即時フィードバック**: 回答するとすぐに正誤判定
- 📊 **学習統計**: ユーザーごとの正解率を追跡・分析

## 主要機能

### テスト形式（3種類）
1. **英単語→日本語** (テキスト入力)
2. **日本語→英単語** (テキスト入力)
3. **4択問題** (Block Kitボタン)

### 適応型アルゴリズム
正解率に基づいて出題頻度を自動調整：
- 100%正解 → 出にくい（重み 0.91）
- 50%正解 → 標準（重み 1.67）
- 20%正解 → 出やすい（重み 3.33）
- 0%正解 → 最優先（重み 10.0）

## 学習の流れ

### 1. 初回セットアップ
1. Slack Appをワークスペースにインストールすると、Botが自動的に全ユーザーにDMを送信
2. ウェルカムメッセージで学習システムの使い方を説明
3. ユーザー情報がSupabaseデータベースに登録される

### 2. 単語データの同期
1. Notionの単語データベースから英単語と日本語訳を取得
2. Supabaseの`vocabulary`テーブルにキャッシュ
3. 各ユーザーの学習統計を`vocabulary_stats`テーブルで管理

### 3. 毎時テストの自動配信
**Cloud Schedulerが毎時0分に実行**

1. **テストセッションの作成**
   - `create-test` Cloud Functionが起動
   - 全登録ユーザーに対して新しいテストセッションを作成
   - テストIDと開始時刻をデータベースに記録

2. **問題の選択と生成**
   - 各ユーザーの学習統計（`vocabulary_stats`）を参照
   - 正解率が低い単語を優先的に選択（重み付けランダム）
   - 5問の問題を生成（テキスト入力 or 4択をランダム）

3. **SlackへのDM配信**
   - 最初の問題をSlack DMで送信
   - テキスト入力問題: プレーンテキストで質問
   - 4択問題: Block Kitのボタンで選択肢を表示

### 4. ユーザーの回答フロー
**ユーザー側の操作**

1. **回答の送信**
   - テキスト入力: DMにメッセージを送信
   - 4択: ボタンをクリック

2. **即時フィードバック**
   - Botが回答を受信し、正誤判定
   - ファジーマッチング適用（タイポ許容）
   - 正解/不正解と正答を表示
   - 現在のスコア（例: 2/5）を表示

3. **次の問題へ進行**
   - 回答が記録されると自動的に次の問題が送信
   - 進捗状況を表示（例: 問題3/5）

4. **テスト完了**
   - 5問すべて回答すると最終スコアを表示
   - 回答履歴がデータベースに保存
   - 統計データが自動更新

### 5. 学習統計の自動更新
**各回答後にバックグラウンドで実行**

1. **回答履歴の記録**
   - `user_answers`テーブルに詳細を保存
   - 問題タイプ、ユーザー回答、正誤判定を記録

2. **統計の再計算**
   - `vocabulary_stats`テーブルを更新
   - 単語ごと・ユーザーごとの正解率を計算
   - 次回の出題重みを自動調整

3. **適応型学習の実現**
   - 間違えた単語は次回以降に出やすくなる
   - 正解した単語は徐々に出にくくなる
   - ユーザー個別の学習進捗に最適化

### 6. 繰り返し学習サイクル
- 毎時テストが自動配信
- ユーザーは自分のペースで回答
- 統計データが蓄積され、出題が最適化
- 長期的な学習効果の向上

## 技術スタック

- **Bot Framework**: [Slack Bolt for JavaScript](https://slack.dev/bolt-js/)
- **Backend**: Node.js + Express
- **Deployment**: Google Cloud Run Functions (2nd gen)
- **Database**: Supabase (PostgreSQL)
- **APIs**:
  - Slack Web API & Events API
  - Notion API
- **Scheduling**: Cloud Scheduler

## 必要な環境変数

```.env
# Supabase
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# Slack
SLACK_BOT_TOKEN=xoxb-<your-token>
SLACK_SIGNING_SECRET=<your-signing-secret>

# Notion
NOTION_API_KEY=<your-notion-api-key>
NOTION_DATABASE_ID=<your-notion-database-id>

# Google Cloud
GCP_PROJECT_ID=<your-project-id>
GCP_REGION=asia-northeast1
```

## セットアップ手順

### 1. Slack Appの作成

1. [Slack API](https://api.slack.com/apps)にアクセス
2. "Create New App" → "From scratch"を選択
3. App名とワークスペースを選択

### 2. Bot Token Scopesの設定

OAuth & Permissions → Bot Token Scopesで以下を追加：
- `chat:write` - メッセージ送信
- `users:read` - ユーザー情報取得
- `im:write` - DMチャンネル作成

### 3. Event Subscriptionsの有効化

1. Event Subscriptions → Enable Events
2. Request URLを設定: `https://REGION-PROJECT_ID.cloudfunctions.net/slack-events`
   （デプロイ後に設定）
3. Subscribe to bot events:
   - `message.im` - DMメッセージ受信

### 4. Interactive Componentsの有効化

1. Interactivity & Shortcuts → Enable
2. Request URLを設定: `https://REGION-PROJECT_ID.cloudfunctions.net/slack-events`
   （デプロイ後に設定）
   
**注意**: Event SubscriptionsとInteractive Componentsは同じエンドポイント（`slack-events`）を使用します。

### 5. アプリのインストール

1. Install App → Install to Workspace
2. Bot User OAuth Tokenをコピー（`xoxb-...`）
3. Signing Secretをコピー（Basic Information → App Credentials）

### 6. Supabaseの設定

**6.1 プロジェクトの作成**

1. [Supabase](https://supabase.com)にアクセス
2. 「Start your project」をクリックして新規プロジェクトを作成
3. プロジェクト名、データベースパスワード、リージョンを設定
   - リージョンは日本に近い場所を選択（例: Tokyo または Singapore）

**6.2 データベーススキーマの作成**

1. Supabase Dashboard にログイン
2. 左側のメニューから「SQL Editor」を選択
3. 「New query」ボタンをクリック
4. プロジェクトルートにある [`supabase_schema.sql`](supabase_schema.sql) ファイルの内容をすべてコピー
5. SQL Editorに貼り付けて「Run」ボタンをクリック

このSQLスクリプトには以下のテーブルとトリガーが含まれています：
- **slack_users**: Slackユーザー情報を管理
- **vocabulary**: Notionから同期した英単語データを保存
- **test_sessions**: 生成されたテストセッション
- **user_test_attempts**: ユーザーごとのテスト進捗状況
- **user_answers**: 回答履歴の詳細
- **vocabulary_stats**: 単語ごと・ユーザーごとの学習統計（重み付け自動計算）
- **トリガー**: 回答時に自動的に統計を更新

**6.3 APIキーの取得**

1. Supabase Dashboard で「Settings」→「API」を開く
2. 以下の3つの値をコピーして `.env` ファイルに設定:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`
   - **service_role secret key** → `SUPABASE_SERVICE_ROLE_KEY`（**注意**: この鍵は秘密にしてください）

**6.4 初期データの同期**

データベースのテーブル作成後、Notionから単語データを同期する必要があります。
詳細は「使い方」セクションの「Notionから単語を再同期」を参照してください。

**重要な注意事項**:
- `service_role` キーは強力な権限を持つため、**サーバーサイドでのみ使用**してください
- GitHubなどにアップロードする際は、`.env`ファイルが`.gitignore`に含まれていることを確認してください
- Row Level Security (RLS) ポリシーが有効化されているため、クライアント側からの不正アクセスは防がれます

### 7. Notionの設定

**7.1 インテグレーションの作成**

1. [Notion Integrations](https://www.notion.so/my-integrations)にアクセス
2. 「New integration」をクリック
3. インテグレーション名を入力（例: "English Vocabulary Sync"）
4. ワークスペースを選択
5. 「Submit」をクリック
6. 表示された「Internal Integration Token」をコピーして `.env` ファイルの `NOTION_API_KEY` に設定

**7.2 単語データベースの作成**

Notionで英単語データベースを作成する必要があります。以下の構造を持つデータベースを作成してください：

| プロパティ名 | タイプ | 説明 | 必須 |
|------------|------|------|------|
| **English** | Title | 英単語 | ✅ |
| **Japanese** | Text | 日本語訳 | ✅ |

**例**:
| English | Japanese |
|---------|----------|
| archipelago | 群島、列島 |
| benevolent | 慈悲深い、親切な |
| contemplate | 熟考する |

**7.3 データベースとインテグレーションを接続**

1. Notionで作成した単語データベースのページを開く
2. ページ右上の「⋯」（3点リーダー）をクリック
3. 「Add connections」を選択
4. 作成したインテグレーション（例: "English Vocabulary Sync"）を選択して接続

**7.4 Database IDの取得**

1. Notionで単語データベースのページを開く
2. ブラウザのアドレスバーからURLをコピー
3. URLの形式: `https://www.notion.so/ワークスペース名/データベース名-DATABASE_ID?v=...`
4. `DATABASE_ID` の部分（32文字の英数字）をコピーして `.env` ファイルの `NOTION_DATABASE_ID` に設定

**例**:
```
URL: https://www.notion.so/myworkspace/Vocabulary-f6404f8a1d064418a6878358e733cf8c?v=abc123
DATABASE_ID: f6404f8a1d064418a6878358e733cf8c
```

**7.5 初期データの同期確認**

デプロイ後、以下のコマンドでNotionからSupabaseへデータを同期します:
```bash
curl -X POST https://<sync-vocabulary-url>.run.app
```

成功すると、同期された単語数が表示されます。詳細は「使い方」セクションを参照してください。

### 8. Google Cloud Platformの設定

```bash
# gcloud CLIのインストール（未インストールの場合）
# https://cloud.google.com/sdk/docs/install

# GCPプロジェクト作成
gcloud projects create PROJECT_ID
gcloud config set project PROJECT_ID
```

**重要: 請求先アカウントの設定**

Cloud Schedulerなどの一部サービスは有料サービスのため、**利用前に必ず請求先アカウントを設定する必要があります**。無料枠内での利用でも請求先の設定は必須です。

Cloud Schedulerの無料枠:
- ジョブ3個まで無料
- それ以降は1ジョブあたり月額$0.10
- **無料枠内でも請求先アカウントの設定は必須**

```bash
# 請求先アカウントを確認
gcloud billing accounts list

# プロジェクトに請求先アカウントをリンク
gcloud billing projects link PROJECT_ID --billing-account=BILLING_ACCOUNT_ID

# 請求先が正しく設定されたか確認
gcloud beta billing projects describe PROJECT_ID
```

請求先アカウントがない場合は、[Google Cloud Console](https://console.cloud.google.com/billing)で作成してください。

```bash
# 請求先設定後、必要なAPIを有効化
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

**注意**: 請求先を設定せずに`gcloud services enable cloudscheduler.googleapis.com`を実行すると、以下のエラーが発生します：
```
ERROR: (gcloud.services.enable) FAILED_PRECONDITION: Billing account for project 'PROJECT_ID' is not found.
```
このエラーが出た場合は、上記の手順で請求先アカウントを設定してください。

### 9. ローカル開発

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envに各種トークンを設定

# TypeScriptをコンパイル
npm run build

# Functions Framework でローカル実行
npm run dev
```

**注意**: 初回実行時や、TypeScriptファイルを編集した後は必ず`npm run build`を実行してください。`npm run dev`は`dist`ディレクトリ内のコンパイル済みJavaScriptファイルを使用します。

### 10. Cloud Functionsへデプロイ

**重要な前提条件**:
- ✅ TypeScriptファイルを編集した後は、**必ず `npm run build` を実行**してからデプロイすること
- ✅ `functions/index.ts` で必要な関数がすべてエクスポートされているか確認すること
- ✅ 環境変数ファイル (`.env.yaml`) が正しく設定されていること

**デプロイ手順**:

```bash
# 1. 環境変数ファイルを作成（.env.localから自動生成）
./create-env-yaml.sh

# または手動で作成
cat > .env.yaml << EOF
SUPABASE_URL: "your-supabase-url"
SUPABASE_SERVICE_ROLE_KEY: "your-supabase-key"
SLACK_BOT_TOKEN: "xoxb-..."
SLACK_SIGNING_SECRET: "your-signing-secret"
NOTION_API_KEY: "your-notion-api-key"
NOTION_DATABASE_ID: "f6404f8a1d064418a6878358e733cf8c"
SUPABASE_ANON_KEY: "your-supabase-anon-key"
EOF

# 2. TypeScriptをコンパイル（重要！）
npm run build

# 3. デプロイ対象の関数がエクスポートされているか確認
# functions/index.ts に以下が含まれていることを確認:
# export { createTest } from './create-test';
# export { slackEvents } from './slack-events';
# export { syncVocabulary } from './sync-vocabulary';

# 4. 各Functionをデプロイ
# slack-events: Slackイベントとインタラクション（ボタンクリック）の両方を処理
gcloud functions deploy slack-events \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --source=. \
  --entry-point=slackEvents \
  --trigger-http \
  --allow-unauthenticated \
  --env-vars-file=.env.yaml

gcloud functions deploy create-test \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --source=. \
  --entry-point=createTest \
  --trigger-http \
  --env-vars-file=.env.yaml

gcloud functions deploy sync-vocabulary \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --source=. \
  --entry-point=syncVocabulary \
  --trigger-http \
  --env-vars-file=.env.yaml
```

**デプロイ後の確認**:

```bash
# 関数が正しくデプロイされたか確認
gcloud functions describe slack-events --region=asia-northeast1 --gen2
gcloud functions describe create-test --region=asia-northeast1 --gen2
gcloud functions describe sync-vocabulary --region=asia-northeast1 --gen2

# 関数のURLを取得
gcloud functions describe slack-events --region=asia-northeast1 --gen2 --format='value(serviceConfig.uri)'
```

### 11. Cloud Schedulerの設定

まず、`create-test` 関数の Cloud Run URL を取得します:

```bash
# create-test関数のURLを取得
gcloud run services describe create-test \
  --region=asia-northeast1 \
  --platform=managed \
  --format='value(status.url)'
```

出力例: `https://create-test-d46xhq4ula-an.a.run.app`

次に、取得したURLを使ってSchedulerジョブを作成します:

```bash
# Schedulerジョブを作成（朝10時から夜10時まで毎時0分に実行）
gcloud scheduler jobs create http create-test-job \
  --location=asia-northeast1 \
  --schedule="0 10-22 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="<create-test関数のURL>" \
  --http-method=GET \
  --oidc-service-account-email=<your-project-id>@appspot.gserviceaccount.com
```

**重要**: 
- `--uri` には上記で取得した Cloud Run の URL を使用してください
- `--oidc-service-account-email` はプロジェクトIDに応じて変更してください（形式: `PROJECT_ID@appspot.gserviceaccount.com`）

### 12. Slack Request URLを更新

デプロイ後、**Cloud Run サービスのURL**を確認してSlackアプリに設定します。

**URLを取得**:
```bash
# slack-events関数のURLを取得
gcloud run services describe slack-events \
  --region=asia-northeast1 \
  --platform=managed \
  --format='value(status.url)'
```

出力例: `https://slack-events-d46xhq4ula-an.a.run.app`

**Slack App管理画面で設定**（https://api.slack.com/apps）:

#### Event Subscriptionsの設定

1. **Slack App管理画面にアクセス**:
   - https://api.slack.com/apps にアクセス
   - 設定したいアプリを選択

2. **Event Subscriptionsページに移動**:
   - 左側のメニューから「Event Subscriptions」をクリック

3. **Enable Eventsをオンにする**:
   - ページ上部の「Enable Events」トグルを **On** にする

4. **Request URLを設定**:
   - 「Request URL」フィールドに、前の手順で取得したURLに **`/slack/events`** を追加して入力
   - 例: `https://slack-events-d46xhq4ula-an.a.run.app/slack/events`
   - **重要**: Slack Bolt は `/slack/events` パスでリクエストを受け付けます
   - 入力すると、Slackが自動的にURLを検証します
   - ✅ "Verified" と表示されればOK
   - ❌ エラーが出る場合は、関数が正しくデプロイされているか確認

5. **Subscribe to bot eventsを設定**:
   - 「Subscribe to bot events」セクションまでスクロール
   - 「Add Bot User Event」ボタンをクリック
   - 以下のイベントを追加:
     - `message.im` - DMでのメッセージを受信

6. **変更を保存**:
   - ページ下部の「Save Changes」をクリック
   - 変更を反映するため、アプリの再インストールを求められる場合があります

#### Interactivity & Shortcutsの設定

1. **Interactivity & Shortcutsページに移動**:
   - 左側のメニューから「Interactivity & Shortcuts」をクリック

2. **Interactivityをオンにする**:
   - ページ上部の「Interactivity」トグルを **On** にする

3. **Request URLを設定**:
   - 「Request URL」フィールドに、**Event Subscriptionsと同じURL**を入力
   - 例: `https://slack-events-d46xhq4ula-an.a.run.app/slack/events`
   - **重要**: Event Subscriptionsと同じく `/slack/events` パスを含める必要があります
   - 入力すると、Slackが自動的にURLを検証します
   - ✅ "Verified" と表示されればOK

4. **変更を保存**:
   - ページ下部の「Save Changes」をクリック

#### App Homeの設定（重要）

Slackアプリにメッセージを送信できるようにするため、App Homeの設定が必要です:

1. **App Homeページに移動**:
   - 左側のメニューから「App Home」をクリック

2. **Messages Tabを有効化**:
   - 「Show Tabs」セクションまでスクロール
   - **「Messages Tab」** にチェックを入れる
   - **「Allow users to send Slash commands and messages from the messages tab」** にチェックを入れる

3. **変更を保存**:
   - ページ下部の「Save」をクリック

この設定を行わないと、ユーザーがアプリにメッセージを送信しようとしても「このアプリへのメッセージ送信はオフにされています」と表示されます。

#### 設定確認のチェックリスト

- ✅ Event Subscriptions が **On** になっている
- ✅ Event Subscriptions の Request URL が **Verified** になっている
- ✅ `message.im` イベントが購読されている
- ✅ Interactivity が **On** になっている
- ✅ Interactivity の Request URL が **Verified** になっている
- ✅ 両方のRequest URLが**同じ**になっている（`/slack/events` パスを含む）
- ✅ App Home の Messages Tab が有効になっている
- ✅ "Allow users to send messages" が有効になっている

#### トラブルシューティング

**Request URLが "Verified" にならない場合**:

1. Cloud Run サービスが正しくデプロイされているか確認:
   ```bash
   gcloud run services describe slack-events --region=asia-northeast1 --platform=managed
   ```

2. Cloud Run のログを確認:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=slack-events" --limit=20
   ```

3. 環境変数 `SLACK_SIGNING_SECRET` が正しく設定されているか確認:
   ```bash
   gcloud run services describe slack-events --region=asia-northeast1 --platform=managed --format='value(spec.template.spec.containers[0].env)'
   ```

4. URLが正しいか再確認:
   ```bash
   gcloud run services describe slack-events --region=asia-northeast1 --platform=managed --format='value(status.url)'
   ```

**重要**: 
- Slack Boltの設計により、イベントとインタラクションは同じエンドポイントで処理されます
- **Slack Bolt は `/slack/events` パスでリクエストを受け付けます**。URLの末尾に必ず `/slack/events` を追加してください
- Cloud Functions Gen2 は Cloud Run 上で動作するため、URLは `*.run.app` 形式になります
- `cloudfunctions.net` 形式のURLは Gen1 用です
- 正しいURL例: `https://slack-events-d46xhq4ula-an.a.run.app/slack/events`
- 誤ったURL例: `https://slack-events-d46xhq4ula-an.a.run.app`（パスなし）

## 使い方

### ユーザー側

1. Slack AppをワークスペースにインストールするとBotが自動的にDMを送信
2. 毎時0分に5問のテストが届く
3. 回答を入力またはボタンをクリック
4. 即座に正誤判定が返ってくる
5. 5問すべて回答するとスコアが表示される

### 管理者側

```bash
# まず、各関数のURLを取得
gcloud run services describe create-test --region=asia-northeast1 --platform=managed --format='value(status.url)'
gcloud run services describe sync-vocabulary --region=asia-northeast1 --platform=managed --format='value(status.url)'

# 手動でテスト送信（取得したURLを使用）
curl -X GET <create-test-url>

# Notionから単語を再同期（取得したURLを使用）
curl -X POST <sync-vocabulary-url>

# Cloud Runサービスのログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=slack-events" --limit=50

# または特定の関数のログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=create-test" --limit=50
```

**URLを取得するコマンド**:
```bash
# 各関数のURLを確認
gcloud run services describe create-test --region=asia-northeast1 --platform=managed --format='value(status.url)'
gcloud run services describe slack-events --region=asia-northeast1 --platform=managed --format='value(status.url)'
gcloud run services describe sync-vocabulary --region=asia-northeast1 --platform=managed --format='value(status.url)'
```

## データベース構造

### 主要テーブル

- **slack_users**: Slackユーザー情報
- **vocabulary**: Notionからキャッシュした単語データ
- **test_sessions**: 毎時生成されるテスト
- **user_test_attempts**: ユーザーごとのテスト進捗
- **user_answers**: 詳細な回答履歴
- **vocabulary_stats**: 単語ごと・ユーザーごとの統計（重み付け自動計算）

詳細は[supabase_schema.sql](supabase_schema.sql)を参照。

## セキュリティとプライバシー

### 環境変数の管理

このプロジェクトでは、以下の機密情報を環境変数として管理しています：

- **Supabase認証情報** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
  - Supabaseデータベースへのアクセスに使用
  - `SERVICE_ROLE_KEY`は特に強力な権限を持つため、**絶対に公開しないでください**

- **Slack認証情報** (`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`)
  - Slack APIとの通信に使用
  - ワークスペース固有の値

- **Notion認証情報** (`NOTION_API_KEY`, `NOTION_DATABASE_ID`)
  - Notionデータベースへのアクセスに使用
  - アカウント固有の値

**重要な注意事項**:
1. `.env`ファイルは`.gitignore`に必ず追加してください
2. GitHubなどの公開リポジトリにプッシュする前に、機密情報が含まれていないか確認してください
3. Cloud Functionsにデプロイする際は`.env.yaml`を使用し、このファイルも`.gitignore`に追加してください
4. サービスアカウントやプロジェクトIDは機密情報ではありませんが、個人を特定できる情報として扱うことを推奨します

### データベースのセキュリティ

Supabaseでは以下のセキュリティ対策が実装されています：

- **Row Level Security (RLS)**: すべてのテーブルでRLSが有効化されています
- **サービスロールポリシー**: Cloud Functionsからのアクセスのみを許可
- **最小権限の原則**: 各関数は必要最小限の権限のみを持ちます

### このREADMEについて

このREADMEでは、すべての機密情報を`<your-xxx>`形式のプレースホルダーに置き換えています。
実際の値を設定する際は、各自の環境に応じて適切な値を使用してください。

### セットアップのクイックチェックリスト

環境変数を設定する際は、以下の値を各サービスから取得してください：

- [ ] **Supabase** (https://app.supabase.com)
  - [ ] Project URL → `SUPABASE_URL`
  - [ ] Anon key → `SUPABASE_ANON_KEY`
  - [ ] Service role key → `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Slack** (https://api.slack.com/apps)
  - [ ] Bot User OAuth Token → `SLACK_BOT_TOKEN`
  - [ ] Signing Secret → `SLACK_SIGNING_SECRET`

- [ ] **Notion** (https://www.notion.so/my-integrations)
  - [ ] Internal Integration Token → `NOTION_API_KEY`
  - [ ] Database ID (URLから取得) → `NOTION_DATABASE_ID`

- [ ] **Google Cloud Platform**
  - [ ] プロジェクトID → `GCP_PROJECT_ID`
  - [ ] リージョン（通常は`asia-northeast1`）→ `GCP_REGION`

## プロジェクト構成

```
英単語アプリ/
├── functions/
│   ├── create-test.ts             # 毎時テスト生成
│   ├── slack-events.ts            # Slackメッセージ受信
│   ├── slack-interactions.ts      # ボタンクリック処理
│   └── sync-vocabulary.ts         # Notion同期
├── src/
│   ├── lib/
│   │   ├── slack-client.ts        # Slack Bolt App
│   │   ├── notion-client.ts       # Notion API
│   │   ├── supabase.ts            # Supabase クライアント
│   │   └── test-generator.ts      # テスト生成ロジック
│   ├── services/
│   │   ├── slack-message-service.ts # Block Kit フォーマット
│   │   ├── answer-validator.ts    # 回答検証
│   │   └── vocabulary-service.ts  # 単語選択
│   ├── utils/
│   │   ├── weighted-random.ts     # 重み付けランダム選択
│   │   └── fuzzy-match.ts        # タイポ許容マッチング
│   └── types/
│       └── index.ts               # TypeScript型定義
├── supabase_schema.sql            # データベーススキーマ
├── package.json                   # 依存関係
├── tsconfig.json                  # TypeScript設定
├── .env                           # ローカル環境変数
└── .env.yaml                      # Cloud Functions環境変数
```

## Cloud Scheduler設定

Cloud Schedulerで自動実行を設定します。

**1. create-test 関数のURLを取得**:
```bash
gcloud run services describe create-test \
  --region=asia-northeast1 \
  --platform=managed \
  --format='value(status.url)'
```

**2. Schedulerジョブを作成**:
```bash
# 朝10時から夜10時まで毎時0分に実行（日本時間）
gcloud scheduler jobs create http create-test-job \
  --location=asia-northeast1 \
  --schedule="0 10-22 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="<create-test関数のURL>" \
  --http-method=GET \
  --oidc-service-account-email=<your-project-id>@appspot.gserviceaccount.com
```

**注意**: 
- `--uri` には手順1で取得したURLを使用してください
- `--oidc-service-account-email` は `プロジェクトID@appspot.gserviceaccount.com` の形式です

**3. スケジュールを変更する場合**:
```bash
gcloud scheduler jobs update http create-test-job \
  --location=asia-northeast1 \
  --schedule="0 10-22 * * *" \
  --time-zone="Asia/Tokyo"
```

**Cronスケジュールの説明**:
- `"0 10-22 * * *"`: 毎時0分、10時から22時まで実行（10:00, 11:00, ..., 22:00 = 13回/日）
- `"0 * * * *"`: 毎時0分に実行（24回/日）
- `"0 9-21 * * *"`: 9時から21時まで毎時0分に実行（13回/日）
- タイムゾーン: `Asia/Tokyo` を指定することで日本時間で実行

## 回答検証ロジック

### ファジーマッチング（タイポ許容）

- 大文字小文字を無視
- 前後の空白を削除
- レーベンシュタイン距離1以内を許容（4文字以上）
- 日本語の助詞違いも考慮
- **4択問題は完全一致のみ**

例：
```
正解: "archipelago"
✅ "archipelago" - 完全一致
✅ "Archipelago" - 大文字小文字
✅ "archipelago " - 空白
✅ "archipelago" - タイポ1文字
❌ "arcipelago" - タイポ2文字
```

## トラブルシューティング

### ローカル開発時のエラー

#### `Provided code location 'dist' is not a loadable module`

**原因**: TypeScriptがコンパイルされていないため、`dist`ディレクトリが存在しないか、中身が空です。

**解決方法**:
```bash
# TypeScriptをコンパイル
npm run build

# 成功を確認
ls -la dist/functions/

# 開発サーバーを起動
npm run dev
```

#### `SUPABASE_URL is not set` などの環境変数エラー

**原因**: 環境変数が読み込まれていません。

**解決方法**:
```bash
# .envファイルが存在するか確認
ls -la .env

# 存在しない場合は作成
cp .env.example .env

# .envに必要な環境変数を設定してから再実行
npm run dev
```

**注意**: `.env.local`を使用している場合は、`.env`にコピーするか、`dotenv`が正しく設定されているか確認してください。

### Slackからメッセージが届かない

1. Event Subscriptions のRequest URLが正しいか確認
2. Bot Token Scopesが設定されているか確認
3. Appがワークスペースにインストールされているか確認
4. Cloud Functionが正しくデプロイされているか確認:
   ```bash
   gcloud functions describe slack-events --region=asia-northeast1 --gen2
   ```

### テストが自動送信されない

1. Cloud Schedulerジョブの状態を確認:
   ```bash
   gcloud scheduler jobs describe create-test-job --location=asia-northeast1
   ```
2. Cloud Loggingでエラーログを確認:
   ```bash
   gcloud functions logs read create-test --region=asia-northeast1 --gen2
   ```
3. 環境変数が正しく設定されているか確認
4. Slack APIのレート制限に引っかかっていないか確認

### 回答が認識されない

1. Slackのメッセージイベントが正しく受信されているか確認
2. Cloud Loggingでログを確認:
   ```bash
   gcloud functions logs read slack-events --region=asia-northeast1 --gen2 --limit=50
   ```
3. ユーザーがアクティブなテストを持っているか確認
4. データベースの`user_test_attempts`テーブルを確認

### 請求先アカウントのエラー

Cloud Schedulerなどの有料サービスを有効化する際に、以下のエラーが発生する場合があります：

```
ERROR: (gcloud.services.enable) FAILED_PRECONDITION: Billing account for project '976151156330' is not found.
Billing must be enabled for activation of service(s) 'cloudscheduler.googleapis.com' to proceed.
```

**原因**: プロジェクトに請求先アカウントが設定されていません。Cloud Schedulerは有料サービスのため、無料枠内の利用でも請求先アカウントの設定が必須です。

**解決方法**:

1. **Google Cloud Consoleで請求先を設定**:
   - [Google Cloud Console](https://console.cloud.google.com/)にアクセス
   - 左上のプロジェクト選択ドロップダウンから該当プロジェクトを選択
   - ナビゲーションメニュー（☰）→「お支払い」をクリック
   - 「請求先アカウントをリンク」をクリック
   - 既存の請求先アカウントを選択するか、新規作成

2. **コマンドラインで設定**:
   ```bash
   # 請求先アカウントを確認
   gcloud billing accounts list

   # プロジェクトに請求先をリンク
   gcloud billing projects link PROJECT_ID --billing-account=BILLING_ACCOUNT_ID

   # 設定を確認
   gcloud beta billing projects describe PROJECT_ID
   ```

3. **再度APIを有効化**:
   ```bash
   gcloud services enable cloudscheduler.googleapis.com
   ```

**注意**: 請求先を設定しても、Cloud Schedulerの無料枠（ジョブ3個まで）内であれば課金されません。

### デプロイエラー

#### Container Healthcheck Failed

**エラーメッセージ**:
```
ERROR: (gcloud.functions.deploy) OperationError: code=3, message=Could not create or update Cloud Run service, 
Container Healthcheck failed. The user-provided container failed to start and listen on the port defined 
provided by the PORT=8080 environment variable within the allocated timeout.
```

**主な原因と解決方法**:

1. **TypeScriptがコンパイルされていない**
   ```bash
   # 必ず実行してからデプロイ
   npm run build
   ```

2. **関数がエクスポートされていない**
   - `functions/index.ts` で必要な関数がエクスポートされているか確認
   ```typescript
   // functions/index.ts の内容を確認
   export { createTest } from './create-test';
   export { slackEvents } from './slack-events';
   export { syncVocabulary } from './sync-vocabulary';
   ```

3. **環境変数の不足**
   - `.env.yaml` に必要な環境変数がすべて設定されているか確認
   ```bash
   cat .env.yaml
   ```

4. **依存関係の問題**
   ```bash
   # node_modules を削除して再インストール
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

**デバッグ方法**:

```bash
# ビルドログを確認
gcloud builds list --limit=5

# 詳細なビルドログを確認
gcloud logging read "resource.type=cloud_build" --limit=50 --format=json

# 関数の詳細を確認
gcloud functions describe FUNCTION_NAME --region=asia-northeast1 --gen2

# Cloud Runのログを確認（関数がCloud Run上で動作するため）
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=FUNCTION_NAME" --limit=50

# IAM権限を確認
gcloud projects get-iam-policy PROJECT_ID
```

## 将来の拡張案

- [ ] スラッシュコマンド（`/stats`）で統計表示
- [ ] ストリーク機能（連続回答でボーナス）
- [ ] リーダーボード（他ユーザーとスコア比較）
- [ ] カスタム単語リスト
- [ ] 音声対応（発音練習）
- [ ] FSRS アルゴリズム導入
- [ ] Web統計ダッシュボード

## ライセンス

MIT

## コスト見積もり

### Google Cloud (東京リージョン)

**Cloud Run Functions (2nd gen)**
- 無料枠: 200万リクエスト/月、40万GB-秒/月、20万GHz-秒/月
- 想定: 4つの関数 × 1日30回実行 = 約3600リクエスト/月
- **コスト: 無料枠内**

**Cloud Scheduler**
- 無料枠: 3ジョブまで無料
- 想定: 1ジョブ（毎時実行）
- **コスト: 無料**

**Supabase**
- Free Tier: 500MB DB、無制限API リクエスト
- **コスト: 無料**

**合計月額: ¥0**（無料枠内で運用可能）

## 参考資料

- [Slack Bolt for JavaScript](https://slack.dev/bolt-js/)
- [Slack Block Kit](https://api.slack.com/block-kit)
- [Slack API Documentation](https://api.slack.com/)
- [Cloud Run Functions](https://cloud.google.com/functions/docs)
- [Cloud Scheduler](https://cloud.google.com/scheduler/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Notion API](https://developers.notion.com/)
