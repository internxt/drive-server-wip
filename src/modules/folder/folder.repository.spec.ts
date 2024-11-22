import { createMock } from '@golevelup/ts-jest';
import { CalculateFolderSizeTimeoutException } from './exception/calculate-folder-size-timeout.exception';
import { SequelizeFolderRepository } from './folder.repository';
import { FolderModel } from './folder.model';
import { Folder } from './folder.domain';
import { newFolder, newUser } from '../../../test/fixtures';
import { FileStatus } from '../file/file.domain';
import { Op } from 'sequelize';
import { v4 } from 'uuid';

jest.mock('./folder.model', () => ({
  FolderModel: {
    sequelize: {
      query: jest.fn(() => Promise.resolve([[{ totalsize: 100 }]])),
    },
  },
}));

describe('SequelizeFolderRepository', () => {
  const TIMEOUT_ERROR_CODE = '57014';

  let repository: SequelizeFolderRepository;
  let folderModel: typeof FolderModel;
  let folder: Folder;

  beforeEach(async () => {
    folderModel = createMock<typeof FolderModel>();

    repository = new SequelizeFolderRepository(folderModel);

    folder = newFolder();
  });

  describe('calculate folder size', () => {
    it('When calculate folder size is requested, then it works', async () => {
      const calculateSizeQuery = `
      WITH RECURSIVE folder_recursive AS (
        SELECT 
            fl1.uuid,
            fl1.parent_uuid,
            COALESCE(f1.size, 0) AS filesize,
            1 AS row_num,
            fl1.user_id as owner_id
        FROM folders fl1
        LEFT JOIN files f1 ON f1.folder_uuid = fl1.uuid AND f1.status IN (:fileStatusCondition)
        WHERE fl1.uuid = :folderUuid
          AND fl1.removed = FALSE 
          AND fl1.deleted = FALSE
        
        UNION ALL
        
        SELECT 
            fl2.uuid,
            fl2.parent_uuid,
            COALESCE(f2.size, 0) AS filesize,
            fr.row_num + 1,
            fr.owner_id
        FROM folders fl2
        LEFT JOIN files f2 ON f2.folder_uuid = fl2.uuid AND f2.status IN (:fileStatusCondition)
        INNER JOIN folder_recursive fr ON fr.uuid = fl2.parent_uuid
        WHERE fr.row_num < 100000
          AND fl2.user_id = fr.owner_id
          AND fl2.removed = FALSE 
          AND fl2.deleted = FALSE
    ) 
    SELECT COALESCE(SUM(filesize), 0) AS totalsize FROM folder_recursive;
      `;

      jest
        .spyOn(FolderModel.sequelize, 'query')
        .mockResolvedValue([[{ totalsize: 100 }]] as any);

      const size = await repository.calculateFolderSize(folder.uuid);

      expect(size).toBeGreaterThanOrEqual(0);
      expect(FolderModel.sequelize.query).toHaveBeenCalledWith(
        calculateSizeQuery,
        {
          replacements: {
            folderUuid: folder.uuid,
            fileStatusCondition: [FileStatus.EXISTS, FileStatus.TRASHED],
          },
        },
      );
    });

    it('When calculate folder size is requested without trashed files, then it should only request existent files', async () => {
      const folderModelSpy = jest.spyOn(FolderModel.sequelize, 'query');

      await repository.calculateFolderSize(folder.uuid, false);

      expect(folderModelSpy).toHaveBeenCalledWith(expect.any(String), {
        replacements: {
          folderUuid: folder.uuid,
          fileStatusCondition: [FileStatus.EXISTS],
        },
      });
    });

    it('When the folder size calculation times out, then throw an exception', async () => {
      jest.spyOn(FolderModel.sequelize, 'query').mockRejectedValue({
        original: {
          code: TIMEOUT_ERROR_CODE,
        },
      });

      await expect(repository.calculateFolderSize(folder.uuid)).rejects.toThrow(
        CalculateFolderSizeTimeoutException,
      );
    });
  });

  describe('findByParentUuid', () => {
    const parentId = 1;
    const plainNames = ['Document', 'Image'];

    it('When folders are searched with names, then it should handle the call with names', async () => {
      await repository.findByParent(parentId, {
        plainName: plainNames,
        deleted: false,
        removed: false,
      });

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: {
          parentId,
          plainName: { [Op.in]: plainNames },
          deleted: false,
          removed: false,
        },
      });
    });

    it('When called without specific criteria, then it should handle the call', async () => {
      await repository.findByParent(parentId, {
        plainName: [],
        deleted: false,
        removed: false,
      });

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: {
          parentId,
          deleted: false,
          removed: false,
        },
      });
    });
  });

  describe('findUserFoldersByUuid', () => {
    const user = newUser();
    const folderUuids = [v4(), v4(), v4()];

    const assertFindAllCalledWith = (deleted: boolean, removed: boolean) => {
      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: {
          uuid: { [Op.in]: folderUuids },
          userId: user.id,
          deleted,
          removed,
        },
      });
    };

    it('should call findAll with deleted set to true when searching for deleted folders', async () => {
      await repository.findUserFoldersByUuid(user, folderUuids, true);
      assertFindAllCalledWith(true, false);
    });

    it('should call findAll with removed set to true when searching for removed folders', async () => {
      await repository.findUserFoldersByUuid(user, folderUuids, false, true);
      assertFindAllCalledWith(false, true);
    });
  });

  describe('findAllByParentUuidsAndUserId', () => {
    const user = newUser();
    const parentUuids = [v4(), v4()];

    it('should return folders deleted', async () => {
      const mockFolders = [
        newFolder({
          owner: user,
          attributes: { parentUuid: parentUuids[0], deleted: true },
        }),
        newFolder({
          owner: user,
          attributes: { parentUuid: parentUuids[1], deleted: true },
        }),
      ];

      jest.spyOn(repository, 'findAll').mockResolvedValue(mockFolders);

      const result = await repository.findAllByParentUuidsAndUserId(
        parentUuids,
        user.id,
        true,
      );

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: {
          parentUuid: { [Op.in]: parentUuids },
          userId: user.id,
          deleted: true,
          removed: false,
        },
      });
      expect(result).toEqual(mockFolders);
    });

    it('should call findAll with default deleted and removed values', async () => {
      await repository.findAllByParentUuidsAndUserId(parentUuids, user.id);

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: {
          parentUuid: { [Op.in]: parentUuids },
          userId: user.id,
          deleted: false,
          removed: false,
        },
      });
    });

    it('should return an empty array if no folders are found', async () => {
      jest.spyOn(repository, 'findAll').mockResolvedValue([]);

      const result = await repository.findAllByParentUuidsAndUserId(
        parentUuids,
        user.id,
      );

      expect(result).toEqual([]);
    });
  });
});
