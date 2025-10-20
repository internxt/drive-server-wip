import { NestExpressApplication } from '@nestjs/platform-express';
import { getModelToken } from '@nestjs/sequelize';
import { v4 } from 'uuid';
import { Op } from 'sequelize';

import {
  createTestUser,
  TestUserContext,
} from '../../../test/helpers/user.helper';
import { createTestApp } from '../../../test/helpers/test-app.helper';
import { FileUseCases } from './file.usecase';
import { SequelizeFileRepository } from './file.repository';
import { UsageType } from '../usage/usage.domain';
import { UsageModel } from '../usage/usage.model';
import { FileModel } from './file.model';
import { newFile } from '../../../test/fixtures';
import { Time } from '../../lib/time';
import { File, FileStatus } from './file.domain';

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
    it('When user has no previous usage, then it should create the first usage record', async () => {
      await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

      const usages = await usageModel.findAll({
        where: { userId: testUser.user.uuid },
      });
      expect(usages).toHaveLength(1);
      expect(usages[0].type).toBe(UsageType.Monthly);
      expect(usages[0].delta).toBe('0');
    });

    it('When user has updated usage, then it should not create new usage records', async () => {
      const yesterday = Time.daysAgo(1);
      const createdUsage = await usageModel.create({
        id: v4(),
        userId: testUser.user.uuid,
        period: yesterday,
        type: UsageType.Monthly,
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
          type: UsageType.Monthly,
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

      const findBackfilledUsage = (usages: UsageModel[]) => {
        const yesterday = Time.daysAgo(1);
        yesterday.setUTCHours(0, 0, 0, 0);

        return usages.find((u: UsageModel) => {
          if (u.type !== UsageType.Monthly) return false;
          const usagePeriod = new Date(u.period);
          usagePeriod.setUTCHours(0, 0, 0, 0);
          return usagePeriod.getTime() === yesterday.getTime();
        });
      };

      it('When backfilling is triggered, then it should create monthly usage with delta equal to sum of new files', async () => {
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

        const backfilledUsage = findBackfilledUsage(usages);
        expect(Number(backfilledUsage.delta)).toBe(file1Size + file2Size);
      });

      it('When user has no file changes during the period, then it should create usage record with zero delta', async () => {
        const totalDeltaWithoutChanges = 1000;
        await createUsageRecord(Time.daysAgo(3), totalDeltaWithoutChanges);

        await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

        const usages = await usageModel.findAll({
          where: { userId: testUser.user.uuid },
        });
        expect(usages.length).toBeGreaterThanOrEqual(2);

        const backfilledUsage = findBackfilledUsage(usages);
        expect(Number(backfilledUsage.delta)).toBe(0);
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

        const backfilledUsage = findBackfilledUsage(usages);
        expect(backfilledUsage).toBeDefined();
        expect(Number(backfilledUsage.delta)).toBe(-fileSize);
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
          { status: 'DELETED', updatedAt: new Date() },
          { where: { id: file.id }, silent: true },
        );

        await fileUseCases.getUserUsedStorageIncrementally(testUser.user);

        const usages = await usageModel.findAll({
          where: { userId: testUser.user.uuid },
        });
        expect(usages.length).toBeGreaterThanOrEqual(2);

        const backfilledUsage = findBackfilledUsage(usages);
        expect(backfilledUsage).toBeDefined();
        expect(Number(backfilledUsage.delta)).toBe(fileSize);
        expect(
          usages.reduce<number>((sum, usage) => sum + Number(usage.delta), 0),
        ).toBe(initialDeltaUsage + fileSize);
      });

      it('When last usage is Yearly from previous completed year, then it should backfill from start of current year', async () => {
        const initialYearlyDelta = 50000;
        const currentYear = new Date().getFullYear();
        const lastYear = Time.startOfYear(currentYear - 1);

        await usageModel.create({
          id: v4(),
          userId: testUser.user.uuid,
          period: lastYear,
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

        // Verify backfilled usage is Monthly (not Yearly)
        const backfilledUsage = findBackfilledUsage(usages);
        expect(backfilledUsage).toBeDefined();
        expect(backfilledUsage.type).toBe(UsageType.Monthly);

        // Backfill should include all files created after the yearly period
        expect(Number(backfilledUsage.delta)).toBe(file1Size + file2Size);
      });

      it('When last usage is Yearly from 2+ years ago, then it should backfill all intermediate changes', async () => {
        const initialYearlyDelta = 20000;
        // Yearly aggregation from 2 years ago
        const currentYear = new Date().getFullYear();
        const oldYearPeriod = Time.startOfYear(currentYear - 2);

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

        const backfilledUsage = findBackfilledUsage(usages);
        expect(backfilledUsage).toBeDefined();
        expect(backfilledUsage.type).toBe(UsageType.Monthly);
        expect(Number(backfilledUsage.delta)).toBe(newFileSize);
      });
    });
  });
});
