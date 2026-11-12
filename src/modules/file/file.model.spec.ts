import { Sequelize } from 'sequelize-typescript';
import { heavyReadPoolModels } from '../../config/heavy-read-pool-connection';
import {
  DeprecatedField,
  DeprecationMode,
  getDeprecationMode,
} from '../../common/deprecated-fields/deprecated-fields';
import { FileModel } from './file.model';

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
    it('When the client still uses file ids, then it returns the id', () => {
      mockFileIdMode(null);
      const file = FileModel.build({ id: 1, uuid: 'file-uuid' });

      const plain = file.get({ plain: true });

      expect(file.id).toBe(1);
      expect(plain.id).toBe(1);
    });

    it('When the client still uses file ids and the file has no id, then it returns 0', () => {
      mockFileIdMode(null);
      const file = FileModel.build({ id: null, uuid: 'file-uuid' });

      const plain = file.get({ plain: true });

      expect(file.id).toBe(0);
      expect(plain.id).toBe(0);
    });

    it('When the client no longer uses file ids, then the id is not sent', () => {
      mockFileIdMode(DeprecationMode.OMIT);
      const file = FileModel.build({ id: 1, uuid: 'file-uuid' });

      const serialized = JSON.parse(JSON.stringify(file.toJSON()));

      expect(file.id).toBeUndefined();
      expect(serialized).not.toHaveProperty('id');
      expect(serialized.uuid).toBe('file-uuid');
    });

    it('When the client no longer uses file ids, then the stored id is kept', () => {
      mockFileIdMode(DeprecationMode.OMIT);
      const file = FileModel.build({ id: 1, uuid: 'file-uuid' });

      const storedId = file.getDataValue('id');

      expect(storedId).toBe(1);
    });
  });
});
