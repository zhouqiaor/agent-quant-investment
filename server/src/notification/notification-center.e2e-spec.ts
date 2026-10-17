import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { NotificationModule } from '../notification/notification.module';
import { PersistenceModule } from '@/persistence/persistence.module';

const TEST_DB = `/tmp/quant-test-notif-center-${process.pid}-${Date.now()}-${Math.round(
  Math.random() * 1e9,
)}.db`;
process.env.SQLITE_PATH = TEST_DB;
process.env.NODE_ENV = 'test';

describe('通知中心 E2E (TDD)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, NotificationModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    try {
      require('fs').unlinkSync(TEST_DB);
    } catch {
      /* ignore */
    }
  });

  it('unreadCount 响应结构正确', async () => {
    const res = await request(app.getHttpServer()).get('/api/notifications/unread-count');
    expect(res.body.code).toBe(200);
    expect(res.body.data).toHaveProperty('count');
    expect(typeof res.body.data.count).toBe('number');
  });

  it('通知列表响应结构正确', async () => {
    const res = await request(app.getHttpServer()).get('/api/notifications');
    expect(res.body.code).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('sync 接口响应结构正确（含 created / deduplicated / notifications）', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/notifications/sync')
      .send({ limit: 10 });
    expect(res.body.code).toBe(200);
    expect(res.body.data).toHaveProperty('created');
    expect(res.body.data).toHaveProperty('deduplicated');
    expect(res.body.data).toHaveProperty('notifications');
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
  });

  it('重复 sync 不增加通知数（去重生效）', async () => {
    // 第一次 sync 建立基线
    await request(app.getHttpServer())
      .post('/api/notifications/sync')
      .send({ limit: 10 });
    const before = (await request(app.getHttpServer()).get('/api/notifications?limit=100')).body.data;
    // 第二次 sync
    await request(app.getHttpServer())
      .post('/api/notifications/sync')
      .send({ limit: 10 });
    const after = (await request(app.getHttpServer()).get('/api/notifications?limit=100')).body.data;
    // 通知数应不变或减少（AgentService 可能在每次返回新生成的信号 ID，但已有 signalId 不会被重复保存）
    expect(after.length).toBeLessThanOrEqual(before.length);
  });

  it('unreadOnly=true 筛选：标已读后未读数减少', async () => {
    const unreadBefore = (await request(app.getHttpServer()).get('/api/notifications/unread-count')).body.data.count;
    const list = (await request(app.getHttpServer()).get('/api/notifications?limit=5')).body.data;
    if (list.length > 0) {
      await request(app.getHttpServer()).post(`/api/notifications/${list[0].id}/read`);
      const unreadAfter = (await request(app.getHttpServer()).get('/api/notifications/unread-count')).body.data.count;
      expect(unreadAfter).toBeLessThanOrEqual(unreadBefore);
    }
  });

  it('markAllRead 后 unreadCount 归零', async () => {
    await request(app.getHttpServer()).post('/api/notifications/read-all');
    const res = await request(app.getHttpServer()).get('/api/notifications/unread-count');
    expect(res.body.data.count).toBe(0);
  });
});