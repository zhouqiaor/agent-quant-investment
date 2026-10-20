#!/bin/bash
set -Eeuo pipefail

start_service() {
    # 以脚本自身位置定位项目根（不依赖 COZE_WORKSPACE_PATH，veFaaS 下该变量可能未设置）
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
    local project_root
    project_root="$(dirname "$(dirname "${script_dir}")")"
    local app_dir="${project_root}/server/dist"

    if [[ ! -f "${app_dir}/main.js" ]]; then
        echo "FATAL: entry not found: ${app_dir}/main.js (did deploy_build.sh run?)" >&2
        exit 1
    fi
    cd "${app_dir}"

    local port="${DEPLOY_RUN_PORT:-3000}"
    export NODE_ENV=production
    echo "Starting NestJS HTTP service (api + static) on port ${port} (cwd: $(pwd))..."

    # 健康检查：GET / 与 GET /health 均返回 200；业务路由挂载在 /api/*
    # SQLite 由 PersistenceService 候选链写入：SQLITE_PATH > cwd/data > /tmp
    exec node ./main.js -p "${port}"
}

echo "Starting HTTP service for deploy..."
start_service
