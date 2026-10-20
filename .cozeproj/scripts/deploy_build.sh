#!/bin/bash
set -Eeuo pipefail

cd "${COZE_WORKSPACE_PATH}"
if [ -f "./.cozeproj/scripts/init_env.sh" ]; then
    echo "⚙️ Initializing environment..."
    # 使用 bash 执行，确保即使没有 x 权限也能跑
    bash ./.cozeproj/scripts/init_env.sh
else
    echo "⚠️ Warning: init_env.sh not found, skipping environment init."
fi
echo "Installing dependencies..."
# 安装所有依赖（包含 Taro 核心和 React）
pnpm install

echo "Building the Taro project..."
pnpm build

echo "Building the NestJS server (dist/main.js for FaaS entry)..."
pnpm --dir server build

echo "Building the H5 web app (dist-web, hosted by Nest in production)..."
pnpm build:web

echo "Build completed successfully! server/dist/main.js + dist-web are ready."
