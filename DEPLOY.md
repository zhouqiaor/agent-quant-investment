# Agent 量化投资小程序 - 部署指南

## 部署方式

### 方式一：直接部署（推荐快速验证）

```bash
# 1. 安装依赖
pnpm install

# 2. 构建
pnpm build:web      # 前端
pnpm build:server   # 后端

# 3. 启动生产服务
export NODE_ENV=production
cd server && node dist/main.js
```

访问 `http://localhost:3000` 即可使用。

### 方式二：Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

### 方式三：使用部署脚本

```bash
chmod +x deploy.sh
./deploy.sh
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | 服务端口 | `3000` |
| `PROJECT_DOMAIN` | 前端域名 | - |

## 生产环境配置

1. 复制 `.env.production` 为 `.env`
2. 修改 `PROJECT_DOMAIN` 为你的实际域名
3. 配置 HTTPS 证书（推荐）

## Nginx 反向代理配置（可选）

如果使用 Nginx 作为反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 健康检查

```bash
curl http://localhost:3000/api/health
```

## 注意事项

1. 生产环境建议配置 HTTPS
2. 建议配置日志收集（如 PM2、Winston）
3. 建议配置进程管理（如 PM2）
4. 数据库连接需要额外配置
