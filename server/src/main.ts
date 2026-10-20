import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import * as express from 'express';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';

function parsePort(): number {
  // 优先级：CLI -p 参数 > 环境变量 PORT > 默认 3000
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('-p');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!Number.isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  const envPort = parseInt(process.env.PORT ?? '', 10);
  if (!Number.isNaN(envPort) && envPort > 0 && envPort < 65536) {
    return envPort;
  }
  return 3000;
}

const BOOT_T0 = Date.now();

/** 启动里程碑埋点：下次部署日志可直接定位卡在哪个阶段 */
function step(label: string): void {
  console.log(`[boot +${Date.now() - BOOT_T0}ms] ${label}`);
}

// 兜底：任何未捕获异常都留下明确日志，绝不静默死亡
process.on('uncaughtException', (err) => {
  console.error(`[FATAL] uncaughtException: ${err?.stack || err}`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  // 记录但保持存活：服务健康检查优先于崩溃退出
  console.error(`[ERROR] unhandledRejection: ${reason instanceof Error ? reason.stack : reason}`);
});

async function bootstrap() {
  step(`bootstrap 开始 pid=${process.pid} node=${process.version} cwd=${process.cwd()} argv=${process.argv.slice(2).join(' ')}`);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  step('NestFactory.create 完成（模块实例化 + 全部 onModuleInit 钩子）');

  // 平台健康检查兜底：GET / 与 GET /health 无论全局前缀/静态托管配置如何都返回 200
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method === 'GET' && (req.path === '/' || req.path === '/health')) {
      return res.json({ status: 'ok', service: 'agent-quant-server', ts: Date.now() });
    }
    next();
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalInterceptors(new HttpStatusInterceptor());

  // 生产环境：托管前端静态文件
  const distWebPath = join(__dirname, '../../dist-web');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distWebPath)) {
    // 托管静态资源
    app.useStaticAssets(distWebPath, { index: false });
    
    // SPA fallback: 所有非 API 请求返回 index.html
    app.use((req, res, next) => {
      // 跳过 API 请求
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(join(distWebPath, 'index.html'));
    });
    
    console.log(`📦 Serving frontend from: ${distWebPath}`);
  }

  // 1. 开启优雅关闭 Hooks (关键!)
  app.enableShutdownHooks();

  // 2. 解析端口并绑定 0.0.0.0（FaaS 容器外部可访问）
  const port = parsePort();
  step(`准备 listen 0.0.0.0:${port}`);
  try {
    await app.listen(port, '0.0.0.0');
    console.log(`[boot +${Date.now() - BOOT_T0}ms] Server running on http://0.0.0.0:${port} (health: /health)`);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'EADDRINUSE') {
      console.error(`[FATAL] 端口 ${port} 被占用(EADDRINUSE)! 请释放端口后重试。`);
      process.exit(1);
    }
    console.error(`[FATAL] listen 失败: ${(err as Error)?.stack || err}`);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error(`[FATAL] bootstrap 异常(可能为模块初始化钩子抛错): ${(err as Error)?.stack || err}`);
  process.exit(1);
});
