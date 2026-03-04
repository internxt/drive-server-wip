import { type NestExpressApplication } from '@nestjs/platform-express';
import { getModelToken } from '@nestjs/sequelize';
import { v4 } from 'uuid';
import { Op } from 'sequelize';

import {
  createTestUser,
  type TestUserContext,
} from '../../../test/helpers/user.helper';
import { createTestApp } from '../../../test/helpers/test-app.helper';
import { FileUseCases } from './file.usecase';
import { SequelizeFileRepository } from './file.repository';
import { UsageType } from '../usage/usage.domain';
import { UsageModel } from '../usage/usage.model';
import { FileModel } from './file.model';
import { newFile } from '../../../test/fixtures';
import { Time } from '../../lib/time';
import { type File, FileStatus } from './file.domain';

describe('File module', () => {
  let app: NestExpressApplication;
  let testUser: TestUserContext;
  let fileUseCases: FileUseCases;
  let fileRepository: SequelizeFileRepository;
  let usageModel: typeof UsageModel;
  let fileModel: typeof FileModel;

  beforeAll(async () => {
    app = await createTestApp();
    fileUseCases = app.get(FileUseCases);
    fileRepository = app.get(SequelizeFileRepository);
    usageModel = app.get(getModelToken(UsageModel));
    fileModel = app.get(getModelToken(FileModel));
  });

  beforeEach(async () => {
    testUser = await createTestUser(app);
  });

  afterEach(async () => {
    await usageModel.destroy({ where: { userId: testUser.user.uuid } });
    await testUser.cleanup();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Get User Storage Incrementally', () => {
    const fixedSystemCurrentDate = new Date('2025-06-15T00:00:00.000Z');

    beforeAll(async () => {
      jest.useFakeTimers();
      jest.setSystemTime(fixedSystemCurrentDate);
    });
    afterAll(async () => {
      jest.useRealTimers();
    });

    it('When user has no previous usage, then it should create the first usage record', async () => {
      await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

      const usages = await usageModel.findAll({
        where: { userId: testUser.user.uuid },
      });
      expect(usages).toHaveLength(1);
      expect(usages[0].type).toBe(UsageType.Daily);
      expect(usages[0].delta).toBe('0');
    });

    it('When user has updated usage, then it should not create new usage records', async () => {
      const yesterday = Time.daysAgo(1);
      const createdUsage = await usageModel.create({
        id: v4(),
        userId: testUser.user.uuid,
        period: yesterday,
        type: UsageType.Daily,
        delta: 1000,
      });

      await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

      const usages = await usageModel.findAll({
        where: { userId: testUser.user.uuid },
      });
      expect(usages).toHaveLength(1);
      expect(usages[0].dataValues).toMatchObject(createdUsage.dataValues);
    });

    describe('When user has outdated usage requiring backfill', () => {
      let createdFiles: File[];

      beforeEach(async () => {
        createdFiles = [];
      });

      afterEach(async () => {
        if (createdFiles.length > 0) {
          await fileModel.destroy({
            where: {
              id: {
                [Op.in]: createdFiles.map((f) => f.id),
              },
            },
          });
          createdFiles = [];
        }
      });

      const createUsageRecord = async (date: Date, delta: number) => {
        return await usageModel.create({
          id: v4(),
          userId: testUser.user.uuid,
          period: date,
          type: UsageType.Daily,
          delta,
        });
      };

      const createTestFile = async (
        date: Date,
        size: number,
        status: FileStatus = FileStatus.EXISTS,
      ) => {
        const fileAttributes = newFile({
          attributes: {
            folderId: testUser.rootFolder?.id,
            folderUuid: testUser.rootFolder?.uuid,
            userId: testUser.user.id,
            size: BigInt(size),
            createdAt: date,
            updatedAt: date,
            status,
          },
        });
        const file = await fileRepository.create(fileAttributes);
        createdFiles.push(file);
        return file;
      };

      const findYesterdayUsage = (usages: UsageModel[]) => {
        const yesterday = new Date(fixedSystemCurrentDate);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);

        return usages.find((u: UsageModel) => {
          if (u.type !== UsageType.Daily) return false;
          const usagePeriod = new Date(u.period);
          usagePeriod.setUTCHours(0, 0, 0, 0);
          return usagePeriod.getTime() === yesterday.getTime();
        });
      };

      it('When backfilling is triggered, then it should create daily usage with delta equal to sum of new files', async () => {
        await createUsageRecord(Time.daysAgo(3), 1000);

        const file1Size = 500;
        const file2Size = 300;
        await createTestFile(Time.daysAgo(2), file1Size);
        await createTestFile(Time.daysAgo(2), file2Size);

        await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

        const usages = await usageModel.findAll({
          where: { userId: testUser.user.uuid },
        });
        expect(usages.length).toBeGreaterThanOrEqual(2);

        const mostRecentUsage = findYesterdayUsage(usages);
        expect(Number(mostRecentUsage.delta)).toBe(file1Size + file2Size);
      });

      it('When user has no file changes during the period, then it should create usage record with zero delta', async () => {
        const totalDeltaWithoutChanges = 1000;
        await createUsageRecord(Time.daysAgo(3), totalDeltaWithoutChanges);

        await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

        const usages = await usageModel.findAll({
          where: { userId: testUser.user.uuid },
        });
        expect(usages.length).toBeGreaterThanOrEqual(2);

        const mostRecentUsage = findYesterdayUsage(usages);
        expect(Number(mostRecentUsage.delta)).toBe(0);
        expect(
          usages.reduce<number>((sum, usage) => sum + Number(usage.delta), 0),
        ).toBe(totalDeltaWithoutChanges);
      });

      it('When files that existed before the period are deleted during the period, then it should create negative delta equal to deleted file size', async () => {
        const initialDeltaUsage = 5000;
        await createUsageRecord(Time.daysAgo(4), initialDeltaUsage);
        const fileSize = 1200;
        const file = await createTestFile(Time.daysAgo(5), fileSize);
        // Delete the file DURING the period (2 days ago)
        const twoDaysAgo = Time.daysAgo(2);
        await fileModel.update(
          { status: 'DELETED', updatedAt: twoDaysAgo },
          { where: { id: file.id }, silent: true },
        );

        await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

        const usages = await usageModel.findAll({
          where: { userId: testUser.user.uuid },
        });
        expect(usages.length).toBeGreaterThanOrEqual(2);

        const mostRecentUsage = findYesterdayUsage(usages);
        expect(mostRecentUsage).toBeDefined();
        expect(Number(mostRecentUsage.delta)).toBe(-fileSize);
        expect(
          usages.reduce<number>((sum, usage) => sum + Number(usage.delta), 0),
        ).toBe(initialDeltaUsage - fileSize);
      });

      it('When files are created during the period but deleted after it, then it should create positive delta equal to created file size', async () => {
        const initialDeltaUsage = 2000;
        await createUsageRecord(Time.daysAgo(3), initialDeltaUsage);
        const fileSize = 800;
        const file = await createTestFile(Time.daysAgo(2), fileSize);
        // Delete the file AFTER the period (today)
        await fileModel.update(
          { status: 'DELETED', updatedAt: Time.now() },
          { where: { id: file.id }, silent: true },
        );

        await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

        const usages = await usageModel.findAll({
          where: { userId: testUser.user.uuid },
        });
        expect(usages.length).toBeGreaterThanOrEqual(2);

        const mostRecentUsage = findYesterdayUsage(usages);
        expect(mostRecentUsage).toBeDefined();
        expect(Number(mostRecentUsage.delta)).toBe(fileSize);
        expect(
          usages.reduce<number>((sum, usage) => sum + Number(usage.delta), 0),
        ).toBe(initialDeltaUsage + fileSize);
      });

      it('When last usage is Yearly from previous completed year, then it should backfill from start of current year', async () => {
        const initialYearlyDelta = 50000;
        const lastYearPeriod = Time.dateWithTimeAdded(
          -1,
          'year',
          fixedSystemCurrentDate,
        );

        await usageModel.create({
          id: v4(),
          userId: testUser.user.uuid,
          period: lastYearPeriod,
          type: UsageType.Yearly,
          delta: initialYearlyDelta,
        });

        // Files created in current year (after the yearly aggregation)
        const file1Size = 1500;
        const file2Size = 800;
        await createTestFile(Time.daysAgo(10), file1Size);
        await createTestFile(Time.daysAgo(5), file2Size);

        await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

        const usages = await usageModel.findAll({
          where: { userId: testUser.user.uuid },
          order: [['period', 'ASC']],
        });

        expect(usages.length).toBeGreaterThanOrEqual(2);

        const mostRecentUsage = findYesterdayUsage(usages);
        expect(mostRecentUsage).toBeDefined();
        // Backfill should include all files created after the yearly period
        expect(Number(mostRecentUsage.delta)).toBe(file1Size + file2Size);
      });

      it('When last usage is Yearly from 2+ years ago, then it should backfill all intermediate changes', async () => {
        const initialYearlyDelta = 20000;
        // Yearly aggregation from 2 years ago
        const oldYearPeriod = Time.startOf(
          Time.dateWithTimeAdded(-2, 'year', fixedSystemCurrentDate),
          'year',
        );

        await usageModel.create({
          id: v4(),
          userId: testUser.user.uuid,
          period: oldYearPeriod,
          type: UsageType.Yearly,
          delta: initialYearlyDelta,
        });

        const newFileSize = 3000;
        await createTestFile(Time.daysAgo(2), newFileSize);

        await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

        const usages = await usageModel.findAll({
          where: { userId: testUser.user.uuid },
          order: [['period', 'ASC']],
        });

        expect(usages.length).toBeGreaterThanOrEqual(2);

        const mostRecentUsage = findYesterdayUsage(usages);
        expect(mostRecentUsage).toBeDefined();
        expect(mostRecentUsage.type).toBe(UsageType.Daily);
        expect(Number(mostRecentUsage.delta)).toBe(newFileSize);
      });

      describe('First usage calculation (cumulative through end of yesterday)', () => {
        it('When file was deleted yesterday at 23:59:59, then it should NOT count in the first usage calculation', async () => {
          const fileSize = 1000;
          const file = await createTestFile(Time.daysAgo(5), fileSize);
          // Delete the file yesterday at 23:59:59
          const yesterdayEnd = Time.endOfDay(Time.daysAgo(1));
          await fileModel.update(
            { status: 'DELETED', updatedAt: yesterdayEnd },
            { where: { id: file.id }, silent: true },
          );

          await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

          const usages = await usageModel.findAll({
            where: { userId: testUser.user.uuid },
          });
          expect(usages).toHaveLength(1);
          expect(Number(usages[0].delta)).toBe(0);
        });

        it('When file was deleted today at 00:00:00, then it should count in the first usage calculation', async () => {
          const fileSize = 1000;
          const file = await createTestFile(Time.daysAgo(5), fileSize);
          // Delete the file today at 00:00:00
          const todayStart = Time.startOf(fixedSystemCurrentDate, 'day');
          await fileModel.update(
            { status: 'DELETED', updatedAt: todayStart },
            { where: { id: file.id }, silent: true },
          );

          await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

          const usages = await usageModel.findAll({
            where: { userId: testUser.user.uuid },
          });
          expect(usages).toHaveLength(1);
          expect(Number(usages[0].delta)).toBe(fileSize);
        });

        it('When file was never deleted, then it should count in the first usage calculation', async () => {
          const fileSize = 2000;
          await createTestFile(Time.daysAgo(5), fileSize, FileStatus.EXISTS);

          await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

          const usages = await usageModel.findAll({
            where: { userId: testUser.user.uuid },
          });
          expect(usages).toHaveLength(1);
          expect(Number(usages[0].delta)).toBe(fileSize);
        });
      });
    });
  });
});
