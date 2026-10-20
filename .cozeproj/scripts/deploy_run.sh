#!/bin/bash
set -Eeuo pipefail

start_service() {
    cd "${COZE_WORKSPACE_PATH}/server/dist"

    local port="${DEPLOY_RUN_PORT:-3000}"
    export NODE_ENV=production
    echo "Starting NestJS HTTP service (api + static) on port ${port} for deploy..."

    # 健康检查：GET / 与 GET /health 均返回 200；业务路由挂载在 /api/*
    exec node ./main.js -p "${port}"
}

echo "Starting HTTP service for deploy..."
start_service
