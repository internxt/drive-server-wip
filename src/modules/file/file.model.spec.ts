import { v7 } from 'uuid';
import { Sequelize } from 'sequelize-typescript';
import { heavyReadPoolModels } from '../../config/heavy-read-pool-connection';
import {
  DeprecatedField,
  DeprecationMode,
  getDeprecationMode,
} from '../../common/deprecated-fields/deprecated-fields';
import { deriveFileIdFromUuid, FileModel } from './file.model';

jest.mock('../../common/deprecated-fields/deprecated-fields', () => ({
  ...jest.requireActual('../../common/deprecated-fields/deprecated-fields'),
  getDeprecationMode: jest.fn(),
}));

const getDeprecationModeMock = jest.mocked(getDeprecationMode);

const mockFileIdMode = (mode: DeprecationMode | null) =>
  getDeprecationModeMock.mockImplementation((field) =>
    field === DeprecatedField.FILE_ID ? mode : DeprecationMode.PLAIN,
  );

describe('FileModel', () => {
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

  describe('id', () => {
    it('When the client still uses file ids, then it returns a number derived from the uuid', () => {
      mockFileIdMode(null);
      const uuid = v7();
      const file = FileModel.build({ uuid });

      const plain = file.get({ plain: true });

      expect(file.id).toBe(deriveFileIdFromUuid(uuid));
      expect(plain.id).toBe(deriveFileIdFromUuid(uuid));
    });

    it('When the same file is requested twice, then it returns the same id', () => {
      mockFileIdMode(null);
      const uuid = v7();

      const firstId = FileModel.build({ uuid }).id;
      const secondId = FileModel.build({ uuid }).id;

      expect(firstId).toBe(secondId);
    });

    it('When files are created in the same millisecond, then each one has a different id', () => {
      mockFileIdMode(null);
      const uuids = Array.from({ length: 10000 }, () => v7());

      const ids = uuids.map((uuid) => FileModel.build({ uuid }).id);

      expect(new Set(ids).size).toBe(uuids.length);
    });

    it('When the client no longer uses file ids, then the id is not sent', () => {
      mockFileIdMode(DeprecationMode.OMIT);
      const file = FileModel.build({ uuid: 'file-uuid' });

      const serialized = JSON.parse(JSON.stringify(file.toJSON()));

      expect(file.id).toBeUndefined();
      expect(serialized).not.toHaveProperty('id');
      expect(serialized.uuid).toBe('file-uuid');
    });

    it('When files are queried, then the id is not read from the database', () => {
      const idAttribute = FileModel.getAttributes().id;

      const columnType = idAttribute.type['key'];

      expect(columnType).toBe('VIRTUAL');
    });
  });
});
