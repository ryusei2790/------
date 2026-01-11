#!/bin/bash
# .env.localから.env.yamlを生成するスクリプト

# .env.localファイルの存在確認
if [ ! -f .env.local ]; then
    echo "Error: .env.local file not found"
    exit 1
fi

# 環境変数を読み込む
source .env.local

# .env.yamlファイルを生成
cat > .env.yaml << EOF
SUPABASE_URL: "${SUPABASE_URL}"
SUPABASE_SERVICE_ROLE_KEY: "${SUPABASE_SERVICE_ROLE_KEY}"
SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}"
SLACK_SIGNING_SECRET: "${SLACK_SIGNING_SECRET}"
NOTION_API_KEY: "${NOTION_API_KEY}"
NOTION_DATABASE_ID: "${NOTION_DATABASE_ID}"
EOF

echo "✅ .env.yaml ファイルが作成されました"
cat .env.yaml
