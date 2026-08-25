#!/bin/bash
# Agent 量化投资小程序 - 部署脚本
# 使用方式: bash deploy.sh

set -e

echo "🚀 开始部署 Agent 量化投资小程序..."

# 1. 安装依赖
echo "📦 安装依赖..."
pnpm install

# 2. 构建前端
echo "🔨 构建前端 (H5)..."
pnpm build:web

# 3. 构建后端
echo "🔨 构建后端..."
pnpm build:server

# 4. 设置生产环境变量
export NODE_ENV=production

# 5. 启动服务
echo "✅ 启动生产服务..."
cd server
node dist/main.js
