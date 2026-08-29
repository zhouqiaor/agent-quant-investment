import { Test } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PersistenceService } from '../persistence/persistence.service';

describe('NotificationService (TDD)', () => {
  let service: NotificationService;

  const mockPersistence = {
    saveNotification: jest.fn().mockResolvedValue({ id: 'n1' }),
    listNotifications: jest.fn().mockResolvedValue([]),
    markNotificationRead: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPersistence.listNotifications.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PersistenceService, useValue: mockPersistence },
      ],
    }).compile();
    service = moduleRef.get(NotificationService);
  });

  it('服务可被实例化', () => {
    expect(service).toBeDefined();
  });

  describe('notify - 从信号生成通知', () => {
    const signal = {
      id: 's1',
      type: 'BUY' as const,
      symbol: '600519',
      name: '贵州茅台',
      price: 1302.8,
      reason: 'MACD金叉',
      source: 'agent' as const,
      time: new Date('2024-06-01T10:00:00+08:00').toISOString(),
    };

    it('生成通知并包含信号关键字段', async () => {
      const n = await service.notify(signal);
      expect(n.title).toContain('买入');
      expect(n.title).toContain('贵州茅台');
      expect(n.body).toContain('1302.80');
      expect(n.read).toBe(false);
      expect(n.signalId).toBe('s1');
    });

    it('写入持久化存储', async () => {
      await service.notify(signal);
      expect(mockPersistence.saveNotification).toHaveBeenCalledTimes(1);
      const arg = mockPersistence.saveNotification.mock.calls[0][0];
      expect(arg.title).toContain('贵州茅台');
    });

    it('相同信号不重复通知（去重）', async () => {
      mockPersistence.listNotifications.mockResolvedValue([
        { signalId: 's1', read: false },
      ]);
      const n = await service.notify(signal);
      expect(n.deduplicated).toBe(true);
      expect(mockPersistence.saveNotification).not.toHaveBeenCalled();
    });
  });

  describe('通知列表与已读', () => {
    it('list 返回未读优先、时间倒序', async () => {
      mockPersistence.listNotifications.mockResolvedValue([
        { id: 'a', read: true, time: '2024-06-01T09:00:00+08:00' },
        { id: 'b', read: false, time: '2024-06-01T08:00:00+08:00' },
        { id: 'c', read: false, time: '2024-06-01T07:00:00+08:00' },
      ]);
      const list = await service.list({ unreadOnly: false });
      expect(list.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    });

    it('unreadOnly 过滤已读', async () => {
      mockPersistence.listNotifications.mockResolvedValue([
        { id: 'a', read: true },
        { id: 'b', read: false },
      ]);
      const list = await service.list({ unreadOnly: true });
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('b');
    });

    it('markRead 标记单条已读', async () => {
      await service.markRead('n1');
      expect(mockPersistence.markNotificationRead).toHaveBeenCalledWith('n1');
    });

    it('markAllRead 标记全部已读', async () => {
      mockPersistence.listNotifications.mockResolvedValue([
        { id: 'a', read: false },
        { id: 'b', read: false },
      ]);
      const count = await service.markAllRead();
      expect(count).toBe(2);
      expect(mockPersistence.markNotificationRead).toHaveBeenCalledWith('a');
      expect(mockPersistence.markNotificationRead).toHaveBeenCalledWith('b');
    });
  });

  describe('未读计数', () => {
    it('unreadCount 正确统计', async () => {
      mockPersistence.listNotifications.mockResolvedValue([
        { id: 'a', read: false },
        { id: 'b', read: false },
        { id: 'c', read: true },
      ]);
      expect(await service.unreadCount()).toBe(2);
    });
  });
});
