/**
 * Server Jest 全局 setup
 *
 * 修复 "A worker process has failed to exit gracefully and has been force exited"：
 * supertest 的 HTTP keep-alive 空闲连接会让 NestApplication.close()（内部 httpServer.close()）
 * 阻塞数秒等待连接 drain；Jest worker 在这段等待期内被强制退出。
 *
 * 这里包装 close()：关闭前先销毁所有现存连接（Node 18.2+ 的 server.closeAllConnections），
 * 使 app.close() 立即返回。仅影响测试进程的关停时序，不改变业务行为。
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NestApplication } = require('@nestjs/core')

const originalClose: (...args: unknown[]) => Promise<unknown> =
  NestApplication.prototype.close

NestApplication.prototype.close = async function patchedClose(
  ...args: unknown[]
): Promise<unknown> {
  try {
    const server = this.httpServer as { closeAllConnections?: () => void } | undefined
    if (server && typeof server.closeAllConnections === 'function') {
      server.closeAllConnections()
    }
  } catch {
    /* ignore：保持原始 close 行为 */
  }
  return originalClose.apply(this, args)
}
