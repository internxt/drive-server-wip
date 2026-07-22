import { v4 } from 'uuid';
import { type Sequelize } from 'sequelize';
import { SequelizeLookUpRepository } from './look-up.repository';

describe('SequelizeLookUpRepository', () => {
  let repository: SequelizeLookUpRepository;
  let sequelize: { query: jest.Mock };

  const userUuid = v4();
  const workspaceUserUuid = v4();
  const workspaceId = v4();
  const partialName = 'report';

  beforeEach(() => {
    sequelize = { query: jest.fn().mockResolvedValue([]) };
    repository = new SequelizeLookUpRepository(
      sequelize as unknown as Sequelize,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    test('When no filters are passed, then it should query files and folders without filter clauses', async () => {
      await repository.search(userUuid, partialName);

      const [sql, options] = sequelize.query.mock.calls[0];
      expect(sql).toContain('FROM files');
      expect(sql).toContain('FROM folders');
      expect(sql).toContain('UNION ALL');
      expect(sql).not.toContain(':extensions');
      expect(sql).not.toContain(':minSize');
      expect(sql).not.toContain(':modifiedAfter');
      expect(options.replacements).toEqual({
        userUuid,
        partialName,
        offset: 0,
      });
    });

    test('When extensions are passed, then it should filter files by type', async () => {
      await repository.search(userUuid, partialName, {
        itemTypes: ['file'],
        extensions: ['pdf'],
      });

      const [sql, options] = sequelize.query.mock.calls[0];
      expect(sql).toContain('LOWER(f."type") IN (:extensions)');
      expect(sql).not.toContain('FROM folders');
      expect(options.replacements.extensions).toEqual(['pdf']);
    });

    test('When only folders are requested, then it should not query files', async () => {
      await repository.search(userUuid, partialName, {
        itemTypes: ['folder'],
      });

      const [sql] = sequelize.query.mock.calls[0];
      expect(sql).toContain('FROM folders');
      expect(sql).not.toContain('FROM files');
      expect(sql).not.toContain('UNION ALL');
    });

    test('When a size filter is passed, then it should exclude folders', async () => {
      await repository.search(userUuid, partialName, { minSize: 1024 });

      const [sql, options] = sequelize.query.mock.calls[0];
      expect(sql).toContain('f."size" >= :minSize');
      expect(sql).not.toContain('FROM folders');
      expect(options.replacements.minSize).toBe(1024);
    });

    test('When a size filter is combined with folders only, then it should return empty without querying', async () => {
      const result = await repository.search(userUuid, partialName, {
        itemTypes: ['folder'],
        minSize: 1024,
      });

      expect(result).toEqual([]);
      expect(sequelize.query).not.toHaveBeenCalled();
    });

    test('When date filters are passed, then they should apply to files and folders', async () => {
      await repository.search(userUuid, partialName, {
        modifiedAfter: '2026-01-01T00:00:00.000Z',
        modifiedBefore: '2026-06-30T23:59:59.999Z',
      });

      const [sql, options] = sequelize.query.mock.calls[0];
      expect(sql).toContain('f."modification_time" >= :modifiedAfter');
      expect(sql).toContain('fo."modification_time" >= :modifiedAfter');
      expect(sql).toContain('f."modification_time" <= :modifiedBefore');
      expect(sql).toContain('fo."modification_time" <= :modifiedBefore');
      expect(options.replacements.modifiedAfter).toBe(
        '2026-01-01T00:00:00.000Z',
      );
      expect(options.replacements.modifiedBefore).toBe(
        '2026-06-30T23:59:59.999Z',
      );
    });

    test('When combined filters are passed, then all clauses should apply together', async () => {
      await repository.search(userUuid, partialName, {
        offset: 10,
        itemTypes: ['file'],
        extensions: ['jpg', 'png'],
        minSize: 1024,
        maxSize: 5242880,
        modifiedAfter: '2026-01-01T00:00:00.000Z',
      });

      const [sql, options] = sequelize.query.mock.calls[0];
      expect(sql).toContain('LOWER(f."type") IN (:extensions)');
      expect(sql).toContain('f."size" >= :minSize');
      expect(sql).toContain('f."size" <= :maxSize');
      expect(sql).toContain('f."modification_time" >= :modifiedAfter');
      expect(options.replacements).toMatchObject({
        offset: 10,
        extensions: ['jpg', 'png'],
        minSize: 1024,
        maxSize: 5242880,
        modifiedAfter: '2026-01-01T00:00:00.000Z',
      });
    });

    test('When rows are returned, then they should be mapped to results', async () => {
      const fileUuid = v4();
      sequelize.query.mockResolvedValueOnce([
        {
          id: fileUuid,
          itemId: fileUuid,
          itemType: 'file',
          userId: userUuid,
          name: 'report',
          rank: null,
          similarity: 0.9,
          'file.type': 'pdf',
          'file.id': 1,
          'file.size': '1024',
          'file.bucket': 'bucket',
          'file.fileId': 'fileId',
          'file.plainName': 'report',
        },
      ]);

      const result = await repository.search(userUuid, partialName);

      expect(result).toEqual([
        {
          id: fileUuid,
          itemId: fileUuid,
          itemType: 'file',
          userId: userUuid,
          name: 'report',
          rank: null,
          similarity: 0.9,
          item: {
            type: 'pdf',
            id: 1,
            size: '1024',
            bucket: 'bucket',
            fileId: 'fileId',
            plainName: 'report',
          },
        },
      ]);
    });
  });

  describe('workspaceSearch', () => {
    test('When no filters are passed, then it should query both branches with workspace replacements', async () => {
      await repository.workspaceSearch(
        userUuid,
        workspaceUserUuid,
        workspaceId,
        partialName,
      );

      const [sql, options] = sequelize.query.mock.calls[0];
      expect(sql).toContain('FROM files');
      expect(sql).toContain('FROM folders');
      expect(sql).toContain('wiu.workspace_id = :workspaceId');
      expect(options.replacements).toEqual({
        userUuid,
        workspaceUserUuid,
        workspaceId,
        partialName,
        offset: 0,
      });
    });

    test('When filters are passed, then the same clauses should apply as in the personal search', async () => {
      await repository.workspaceSearch(
        userUuid,
        workspaceUserUuid,
        workspaceId,
        partialName,
        {
          itemTypes: ['file'],
          extensions: ['pdf'],
          maxSize: 5242880,
        },
      );

      const [sql, options] = sequelize.query.mock.calls[0];
      expect(sql).toContain('LOWER(f."type") IN (:extensions)');
      expect(sql).toContain('f."size" <= :maxSize');
      expect(sql).not.toContain('FROM folders');
      expect(options.replacements).toMatchObject({
        extensions: ['pdf'],
        maxSize: 5242880,
      });
    });
  });
});
