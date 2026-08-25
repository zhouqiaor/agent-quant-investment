# Agent 量化投资小程序 - Docker 部署
# 构建: docker build -t quant-agent .
# 运行: docker run -p 3000:3000 quant-agent

# 阶段1: 构建
FROM node:20-alpine AS builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建前端和后端
RUN pnpm build:web
RUN pnpm build:server

# 阶段2: 生产镜像
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/dist-web ./dist-web
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/server/node_modules ./server/node_modules

# 复制根目录的 node_modules（包含共享依赖）
COPY --from=builder /app/node_modules ./node_modules

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server/dist/main.js"]
