import { Sequelize } from 'sequelize-typescript';
import { heavyReadPoolModels } from '../../config/heavy-read-pool-connection';
import { FolderModel } from './folder.model';
import { FolderStatus } from './folder.domain';

describe('FolderModel', () => {
  let sequelize: Sequelize;

  beforeAll(() => {
    sequelize = new Sequelize({
      dialect: 'postgres',
      logging: false,
      models: heavyReadPoolModels,
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('status', () => {
    it('When the folder is removed, then it returns deleted', () => {
      const folder = FolderModel.build({ deleted: true, removed: true });

      const status = folder.status;

      expect(status).toBe(FolderStatus.DELETED);
    });

    it('When the folder is deleted but not removed, then it returns trashed', () => {
      const folder = FolderModel.build({ deleted: true, removed: false });

      const status = folder.status;

      expect(status).toBe(FolderStatus.TRASHED);
    });

    it('When the folder is neither deleted nor removed, then it returns exists', () => {
      const folder = FolderModel.build({ deleted: false, removed: false });

      const status = folder.status;

      expect(status).toBe(FolderStatus.EXISTS);
    });

    it('When deleted or removed were not selected, then it returns undefined', () => {
      const folder = FolderModel.build(
        { id: 1, uuid: 'uuid' },
        { raw: true, isNewRecord: false },
      );

      const status = folder.status;

      expect(status).toBeUndefined();
    });

    it('When the folder is serialized as plain, then it includes the status', () => {
      const folder = FolderModel.build({ deleted: true, removed: false });

      const plain = folder.get({ plain: true });

      expect(plain.status).toBe(FolderStatus.TRASHED);
    });
  });
});
