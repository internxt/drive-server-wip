import { createMock } from '@golevelup/ts-jest';
import { CalculateFolderSizeTimeoutException } from './exception/calculate-folder-size-timeout.exception';
import { SequelizeFolderRepository } from './folder.repository';
import { FolderModel } from './folder.model';
import { Folder } from './folder.domain';
import { newFolder } from '../../../test/fixtures';

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
            f1.size AS filesize,
            1 AS row_num,
            fl1.user_id as owner_id
        FROM folders fl1
        LEFT JOIN files f1 ON f1.folder_uuid = fl1.uuid
        WHERE fl1.uuid = :folderUuid
        AND fl1.removed = FALSE 
        AND fl1.deleted = FALSE
        AND f1.status != 'DELETED'
        
        UNION ALL
        
        SELECT 
            fl2.uuid,
            fl2.parent_uuid,
            f2.size AS filesize,
            fr.row_num + 1,
            fr.owner_id
        FROM folders fl2
        INNER JOIN files f2 ON f2.folder_uuid = fl2.uuid
        INNER JOIN folder_recursive fr ON fr.uuid = fl2.parent_uuid
        WHERE fr.row_num < 100000
        AND fl2.user_id = fr.owner_id
        AND fl2.removed = FALSE 
        AND fl2.deleted = FALSE
        AND f2.status != 'DELETED'
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
          },
        },
      );
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
});