import { type NestExpressApplication } from '@nestjs/platform-express';
import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  type ArgumentsHost,
} from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { getModelToken } from '@nestjs/sequelize';
import { v4 } from 'uuid';
import { Op, UniqueConstraintError } from 'sequelize';

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
import { UniqueConstraintFilter } from '../../common/filters/unique-constraint.filter';
import { AesService } from '../../externals/crypto/aes';
import request from 'supertest';
import { ClientEnum } from '../../common/enums/platform.enum';
import { SequelizeThumbnailRepository } from '../thumbnail/thumbnail.repository';

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

  const createUserFile = (owner: TestUserContext) =>
    fileRepository.create(
      newFile({
        attributes: {
          folderId: owner.rootFolder?.id,
          folderUuid: owner.rootFolder?.uuid,
          userId: owner.user.id,
          status: FileStatus.EXISTS,
        },
      }),
    );

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

  // GET /files/sync
  describe('Cursor sync', () => {
    let createdFiles: File[];

    beforeEach(async () => {
      createdFiles = [];
    });

    afterEach(async () => {
      if (createdFiles.length > 0) {
        await fileModel.destroy({
          where: { id: { [Op.in]: createdFiles.map((f) => f.id) } },
        });
        createdFiles = [];
      }
    });

    const createTestFile = async () => {
      const fileAttributes = newFile({
        attributes: {
          folderId: testUser.rootFolder?.id,
          folderUuid: testUser.rootFolder?.uuid,
          userId: testUser.user.id,
          status: FileStatus.EXISTS,
        },
      });
      const file = await fileRepository.create(fileAttributes);
      createdFiles.push(file);
      return file;
    };

    const setUpdatedAt = (uuid: string, isoWithMicroseconds: string) =>
      fileModel.sequelize.query(
        'UPDATE files SET updated_at = :updatedAt WHERE uuid = :uuid',
        { replacements: { updatedAt: isoWithMicroseconds, uuid } },
      );

    const collectAllPages = async (
      getPage: (cursorToken?: string) => Promise<{
        files: File[];
        hasMore: boolean;
        nextCursor: string | null;
      }>,
    ) => {
      const seenUuids: string[] = [];
      let cursorToken: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const page = await getPage(cursorToken);
        seenUuids.push(...page.files.map((f) => f.uuid));
        hasMore = page.hasMore;
        cursorToken = page.nextCursor ?? undefined;
      }

      return seenUuids;
    };

    it('When paginating by cursor, then it should not repeat or skip rows', async () => {
      const fileA = await createTestFile();
      const fileB = await createTestFile();
      const fileC = await createTestFile();
      await setUpdatedAt(fileA.uuid, '2026-01-01T10:00:00.123456Z');
      await setUpdatedAt(fileB.uuid, '2026-01-01T10:00:00.123999Z');
      await setUpdatedAt(fileC.uuid, '2026-01-01T10:00:00.123001Z');

      const seenUuids = await collectAllPages((cursorToken) =>
        fileUseCases.getFilesUpdatedAfterWithCursor(
          testUser.user.id,
          undefined,
          new Date(0),
          1,
          cursorToken,
        ),
      );

      expect(seenUuids).toHaveLength(3);
      expect(new Set(seenUuids)).toEqual(
        new Set([fileA.uuid, fileB.uuid, fileC.uuid]),
      );
    });

    it('When status filter is applied, then only files matching that status should be returned', async () => {
      const existsFile = await createTestFile();
      const trashedFile = await createTestFile();
      await fileRepository.updateByUuidAndUserId(
        trashedFile.uuid,
        testUser.user.id,
        { status: FileStatus.TRASHED },
      );

      const page = await fileUseCases.getFilesUpdatedAfterWithCursor(
        testUser.user.id,
        FileStatus.EXISTS,
        new Date(0),
        10,
        undefined,
      );

      const returnedUuids = page.files.map((f) => f.uuid);
      expect(returnedUuids).toContain(existsFile.uuid);
      expect(returnedUuids).not.toContain(trashedFile.uuid);
    });

    it('When cursorToken is invalid, then it should throw', async () => {
      await expect(
        fileUseCases.getFilesUpdatedAfterWithCursor(
          testUser.user.id,
          undefined,
          new Date(0),
          10,
          'not-a-valid-cursor',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When cursor status does not match the requested status, then it should throw', async () => {
      await createTestFile();
      await createTestFile();
      const firstPage = await fileUseCases.getFilesUpdatedAfterWithCursor(
        testUser.user.id,
        FileStatus.EXISTS,
        new Date(0),
        1,
        undefined,
      );
      const cursorToken = firstPage.nextCursor;
      expect(cursorToken).not.toBeNull();

      await expect(
        fileUseCases.getFilesUpdatedAfterWithCursor(
          testUser.user.id,
          FileStatus.TRASHED,
          new Date(0),
          10,
          cursorToken,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When there are no files updated after the given date, then it should return an empty page', async () => {
      const futureDate = new Date(Date.now() + 60_000);

      const page = await fileUseCases.getFilesUpdatedAfterWithCursor(
        testUser.user.id,
        undefined,
        futureDate,
        10,
        undefined,
      );

      expect(page.files).toHaveLength(0);
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeNull();
    });
  });

  // TODO: remove with findAllForOffsetSync
  describe('findAllForOffsetSync', () => {
    const updatedAfter = new Date('2025-12-31T00:00:00.000Z');
    const limit = 50;
    const totalFiles = 300;
    const statuses = [
      FileStatus.EXISTS,
      FileStatus.TRASHED,
      FileStatus.DELETED,
    ];
    const tieGroupOf = (index: number) => {
      if (index >= 45 && index < 85) {
        return 100;
      }
      if (index >= 97 && index < 247) {
        return 300;
      }
      return (index < 45 ? 0 : index < 97 ? 200 : 400) + Math.floor(index / 7);
    };
    const updatedAtOf = (index: number) =>
      new Date(
        Date.parse('2026-01-01T10:00:00Z') + tieGroupOf(index) * 1000,
      ).toISOString();
    let createdFiles: File[];

    beforeEach(async () => {
      createdFiles = await Promise.all(
        Array.from({ length: totalFiles }, (_, index) => {
          const { id: _id, ...attributes } = newFile({
            attributes: {
              folderId: testUser.rootFolder?.id,
              folderUuid: testUser.rootFolder?.uuid,
              userId: testUser.user.id,
              status: statuses[index % statuses.length],
            },
          }).toJSON();
          return fileRepository.create(attributes);
        }),
      );
      await Promise.all(
        createdFiles.map((file, index) =>
          fileModel.sequelize.query(
            'UPDATE files SET updated_at = :updatedAt WHERE uuid = :uuid',
            {
              replacements: { updatedAt: updatedAtOf(index), uuid: file.uuid },
            },
          ),
        ),
      );
    });

    afterEach(async () => {
      await fileModel.destroy({
        where: { id: { [Op.in]: createdFiles.map((f) => f.id) } },
      });
    });

    it.each([
      0, 1, 6, 7, 44, 45, 50, 63, 84, 85, 96, 97, 100, 120, 147, 150, 197, 200,
      246, 247, 280, 300, 500,
    ])(
      'When paginating with offset %i, then it should return the same page as the regular query',
      async (offset) => {
        const userId = testUser.user.id;
        const regularPage = await fileRepository.findAllCursorWhereUpdatedAfter(
          { userId },
          updatedAfter,
          limit,
          offset,
          [['updatedAt', 'ASC']],
        );

        const offsetSyncPage = await fileRepository.findAllForOffsetSync({
          userId,
          updatedAfter,
          limit,
          offset,
        });

        expect(offsetSyncPage.map((f) => f.uuid)).toEqual(
          regularPage.map((f) => f.uuid),
        );
      },
    );
  });

  describe('Fields removed or changed depending on client and version', () => {
    let file: File;

    beforeEach(async () => {
      file = await fileRepository.create(
        newFile({
          attributes: {
            folderId: testUser.rootFolder?.id,
            folderUuid: testUser.rootFolder?.uuid,
            userId: testUser.user.id,
            status: FileStatus.EXISTS,
          },
        }),
      );
    });

    afterEach(async () => {
      await fileModel.destroy({ where: { id: file.id } });
    });

    const requestSyncedFile = async (headers: Record<string, string>) => {
      const response = await request(app.getHttpServer())
        .get('/files/sync')
        .query({
          status: FileStatus.EXISTS,
          updatedAt: new Date(0).toISOString(),
        })
        .set('Authorization', `bearer ${testUser.token}`)
        .set(headers);

      expect(response.status).toBe(200);
      return response.body.files.find(
        (f: { uuid: string }) => f.uuid === file.uuid,
      );
    };

    describe('name', () => {
      const desktopClients = [
        ['Windows', ClientEnum.DesktopWindows],
        ['macOS', ClientEnum.DesktopMacos],
      ];

      it.each(desktopClients)(
        'When %s desktop 2.6.0 or newer syncs, then name is the plain name',
        async (_label, client) => {
          const headers = {
            'internxt-client': client,
            'internxt-version': '2.6.0',
          };

          const syncedFile = await requestSyncedFile(headers);

          expect(syncedFile.name).toBe(file.plainName);
        },
      );

      it.each(desktopClients)(
        'When %s desktop older than 2.6.0 syncs, then name is the encrypted plain name',
        async (_label, client) => {
          const headers = {
            'internxt-client': client,
            'internxt-version': '2.5.9',
          };

          const syncedFile = await requestSyncedFile(headers);

          expect(syncedFile.name).toBeDefined();
          expect(syncedFile.name).not.toBe(file.plainName);
          expect(
            new AesService(process.env.CRYPTO_SECRET2).decrypt(
              syncedFile.name,
              file.folderId,
            ),
          ).toBe(file.plainName);
        },
      );

      it('When CLI 1.5.0 or newer syncs, then name is the plain name', async () => {
        const headers = {
          'internxt-client': ClientEnum.Cli,
          'internxt-version': '1.6.10',
        };

        const syncedFile = await requestSyncedFile(headers);

        expect(syncedFile.name).toBe(file.plainName);
      });

      it('When rclone syncs, then name is the plain name', async () => {
        const headers = { 'user-agent': 'rclone/v1.73.0' };

        const syncedFile = await requestSyncedFile(headers);

        expect(syncedFile.name).toBe(file.plainName);
      });

      it('When Linux desktop syncs, then name is encrypted', async () => {
        const headers = {
          'internxt-client': ClientEnum.DesktopLinux,
          'internxt-version': '2.6.2',
        };

        const syncedFile = await requestSyncedFile(headers);

        expect(syncedFile.name).not.toBe(file.plainName);
      });

      it('When a client without a name rule syncs, then name is the plain name', async () => {
        const headers = {
          'internxt-client': ClientEnum.Web,
          'internxt-version': '99.0.0',
        };

        const syncedFile = await requestSyncedFile(headers);

        expect(syncedFile.name).toBe(file.plainName);
      });

      it('When the request has no client headers, then name is the plain name', async () => {
        const syncedFile = await requestSyncedFile({});

        expect(syncedFile.name).toBe(file.plainName);
      });
    });
  });

  describe('POST /files', () => {
    const buildCreateFileBody = (folderUuid: string) => ({
      bucket: v4().substring(0, 24),
      fileId: v4().substring(0, 24),
      encryptVersion: '03-aes',
      folderUuid,
      size: 100,
      plainName: `file-${v4()}`,
      type: 'txt',
    });

    it('When the user uploads a file to their own folder, then the file is created', async () => {
      const body = buildCreateFileBody(testUser.rootFolder?.uuid);

      const response = await request(app.getHttpServer())
        .post('/files')
        .set('Authorization', `bearer ${testUser.token}`)
        .send(body);

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body).toMatchObject({
        plainName: body.plainName,
        folderUuid: body.folderUuid,
        userId: testUser.user.id,
      });
    });

    it('When the user uploads a file to a folder of another user, then it is not allowed', async () => {
      const anotherTestUser = await createTestUser(app);
      const body = buildCreateFileBody(anotherTestUser.rootFolder?.uuid);

      const response = await request(app.getHttpServer())
        .post('/files')
        .set('Authorization', `bearer ${testUser.token}`)
        .send(body);
      const filesInFolder = await fileModel.count({
        where: { folderUuid: anotherTestUser.rootFolder?.uuid },
      });
      await anotherTestUser.cleanup();

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(filesInFolder).toBe(0);
    });
  });

  describe('GET /files/sync', () => {
    it('When listing files, then only the files of the current user are returned', async () => {
      const anotherTestUser = await createTestUser(app);
      const requesterFile = await createUserFile(testUser);
      const anotherUserFile = await createUserFile(anotherTestUser);

      const response = await request(app.getHttpServer())
        .get('/files/sync')
        .query({
          status: FileStatus.EXISTS,
          updatedAt: new Date(0).toISOString(),
        })
        .set('Authorization', `bearer ${testUser.token}`);
      await anotherTestUser.cleanup();

      expect(response.status).toBe(HttpStatus.OK);
      const uuids = response.body.files.map((f: { uuid: string }) => f.uuid);
      expect(uuids).toContain(requesterFile.uuid);
      expect(uuids).not.toContain(anotherUserFile.uuid);
    });
  });

  describe('POST /files/thumbnail', () => {
    let thumbnailRepository: SequelizeThumbnailRepository;

    beforeAll(() => {
      thumbnailRepository = app.get(SequelizeThumbnailRepository);
    });

    const buildThumbnailBody = (fileUuid: string) => ({
      fileUuid,
      type: 'png',
      size: 100,
      maxWidth: 300,
      maxHeight: 300,
      bucketId: v4().substring(0, 24),
      bucketFile: v4().substring(0, 24),
      encryptVersion: '03-aes',
    });

    it('When the user adds a thumbnail to their own file, then the thumbnail is created', async () => {
      const file = await createUserFile(testUser);
      const body = buildThumbnailBody(file.uuid);

      const response = await request(app.getHttpServer())
        .post('/files/thumbnail')
        .set('Authorization', `bearer ${testUser.token}`)
        .send(body);
      await thumbnailRepository.deleteBy({ fileUuid: file.uuid });

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body).toMatchObject({ fileUuid: file.uuid });
    });

    it('When the user adds a thumbnail to a file of another user, then it is not allowed', async () => {
      const anotherTestUser = await createTestUser(app);
      const otherUserFile = await createUserFile(anotherTestUser);
      const body = buildThumbnailBody(otherUserFile.uuid);

      const response = await request(app.getHttpServer())
        .post('/files/thumbnail')
        .set('Authorization', `bearer ${testUser.token}`)
        .send(body);
      const thumbnails = await thumbnailRepository.findAll({
        fileUuid: otherUserFile.uuid,
      });
      await anotherTestUser.cleanup();

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(thumbnails).toHaveLength(0);
    });
  });

  describe('File unique constraint', () => {
    it('When a file with a duplicated name is inserted, then the violated constraint is mapped to a conflict', async () => {
      const fileAttributes = newFile({
        attributes: {
          folderId: testUser.rootFolder?.id,
          folderUuid: testUser.rootFolder?.uuid,
          userId: testUser.user.id,
          status: FileStatus.EXISTS,
        },
      });
      await fileRepository.create(fileAttributes);

      const duplicatedFile = newFile({
        attributes: {
          plainName: fileAttributes.plainName,
          type: fileAttributes.type,
          folderId: testUser.rootFolder?.id,
          folderUuid: testUser.rootFolder?.uuid,
          userId: testUser.user.id,
          status: FileStatus.EXISTS,
        },
      });

      const error = await fileRepository
        .create(duplicatedFile)
        .then(() => null)
        .catch((err) => err);

      expect(error).toBeInstanceOf(UniqueConstraintError);
      expect(() =>
        new UniqueConstraintFilter().catch(error, createMock<ArgumentsHost>()),
      ).toThrow(
        new ConflictException(
          'A file with this name already exists in this location',
        ),
      );
    });
  });
});
