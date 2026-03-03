import { Test, type TestingModule } from '@nestjs/testing';
import { type ExecutionContext } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';

import { NotificationsGuard } from './notifications.guard';

describe('NotificationsGuard', () => {
  let guard: NotificationsGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsGuard],
    }).compile();

    guard = module.get<NotificationsGuard>(NotificationsGuard);
  });

  describe('canActivate', () => {
    it('When canActivate is called, then it should return false', async () => {
      const context = createMock<ExecutionContext>();

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });
  });
});
