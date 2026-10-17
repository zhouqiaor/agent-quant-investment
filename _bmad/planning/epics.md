---
stepsCompleted: [1]
inputDocuments:
  - "BMAD Architecture Analysis (inline, no document — code/git/CI only)"
---

# agent-quant-investment - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **agent-quant-investment**, decomposing the requirements from the BMAD Architecture Analysis (risk surface R1–R13 + recommendations 1–12) into implementable stories. No PRD/Architecture/UX documents exist in this repo per the user's explicit instruction to ignore existing docs; all requirements derive from a code-only, git-only, CI-only recon pass.

## Requirements Inventory

### Functional Requirements

```
FR1:  notifications.signalId 必须有 DB 层 UNIQUE 索引 + INSERT ON CONFLICT 语义，关闭 R1 应用层去重竞态。
FR2:  stores/notification.ts 必须有 6-8 个 spec（初始化、refresh、decrement、reset、轮询节拍、TabBar 调用 stub）。
FR3:  Drizzle ORM/kit/zod、@aws-sdk/*、@supabase/*、pg、coze-coding-dev-sdk 五个未用依赖必须删除或正式立项使用文档。
FR4:  preview-server.cjs 必须纳入 pnpm scripts（新增 pnpm preview:web）或从仓库删除。
FR5:  husky 必须真实接入并把 lint-staged 绑定到 pre-commit；不能继续空转。
FR6:  高频页（market、portfolio、position、paper-trading）必须有完整 page-level spec。
FR7:  main.ts 必须注册全局 ValidationPipe 与 HttpExceptionFilter，统一 API 错误格式。
FR8:  risk 与 agent 两个后端核心模块必须至少有 5-10 个 spec 骨架。
FR9:  必须新增一个 e2e 测试覆盖 legacy DB 走 ALTER TABLE 迁移的完整 bootstrap 路径。
FR10: main.ts 必须收紧 CORS（白名单）、body limit（合理上限）、并接入 rate limit 与 access log envelope。
FR11: 鉴权模型必须做出"不做 / 做 session / 做 JWT / 做 API key"的明确决策并写入决策记录。
FR12: patches/@tarojs__plugin-mini-ci@4.1.9.patch 必须有 README/CHANGELOG 说明何时可弃。
```

### NonFunctional Requirements

```
NFR1: 服务端覆盖率门禁（statements≥70 / branches≥55 / functions≥72 / lines≥70）必须只升不降。
NFR2: Web 端覆盖率基线（5/3/5/5）必须只升不降，每轮迭代收紧。
NFR3: CI 五 job（setup / validate / test-server / test-web / build）必须在 push/PR main 时全部执行且任何失败即红。
NFR4: 全部 HTTP 路由必须经 /api 前缀；HttpStatusInterceptor 必须维持 POST 201→200 重写。
NFR5: 所有页面必须在 H5 + weapp + tt 三端可用，禁用 Canvas/D3（图表必须 SVG）。
NFR6: 全部 DB 写入必须经 PersistenceModule；禁止任何模块直接 better-sqlite3 实例化。
NFR7: 测试不得依赖真实网络（行情 mock）；e2e 可用 NODE_ENV=test 跳过 Sina 预热。
NFR8: 任何 commit 不得引入 ESLint 0-warning 红线（含 custom no-restricted-syntax）。
NFR9: 提交前本地 pnpm validate（lint + tsc）+ pnpm test 必须全绿。
```

### Additional Requirements

```
AR1: PersistenceModule 是 @Global() 单例；任何新模块注入它不能引入新的 DB 实例或 ORM 通道。
AR2: 唯一调度源仍是 MarketPollingService.setInterval(5s)；新功能不得引入 WebSocket/SSE/长轮询变体。
AR3: 图表组件继续走 SVG → data:image/svg+xml → <Image mode="widthFix">；禁止引入图表库依赖。
AR4: 5-job CI 流水线是部署前唯一硬门禁；任何本地绿灯不能抵消 CI 红灯。
AR5: Husky + lint-staged 是 pre-commit 的唯一合法实现路径（不能用其他 hook 框架替代，除非另行决策）。
AR6: 跨端兼容矩阵（H5 + weapp + tt）保持不变；任何新依赖必须验证三端可加载。
AR7: patches/ 目录是 fork 上游的临时方案，必须有弃用条件；一旦上游修复即应清除。
```

### UX Design Requirements

```
（项目无 UX Design contract——空白；按需后续补充）
```

### FR Coverage Map

{{requirements_coverage_map}}

## Epic List

{{epics_list}}

<!-- Epic and story blocks will be appended by step-02 / step-03 -->
