import { createMock } from '@golevelup/ts-jest';
import { SequelizeUserRepository, type UserModel } from './user.repository';
import { User } from './user.domain';
import { newUser, newNotificationToken } from '../../../test/fixtures';
import { Op, type Transaction } from 'sequelize';
import { type UserNotificationTokensModel } from './user-notification-tokens.model';
import { UserNotificationTokens } from './user-notification-tokens.domain';
import { v4 } from 'uuid';
import { randomInt } from 'crypto';
import { DeviceType } from './dto/register-notification-token.dto';

describe('SequelizeUserRepository', () => {
  let repository: SequelizeUserRepository;
  let userModel: typeof UserModel;
  let userNotificationTokensModel: typeof UserNotificationTokensModel;
  let user: User;
  let notificationToken: UserNotificationTokens;
  let mockTokenModel: UserNotificationTokensModel;

  beforeEach(async () => {
    userModel = createMock<typeof UserModel>();
    userNotificationTokensModel =
      createMock<typeof UserNotificationTokensModel>();

    repository = new SequelizeUserRepository(
      userModel,
      userNotificationTokensModel,
    );

    user = newUser();
    notificationToken = newNotificationToken();
    mockTokenModel = createMock<UserNotificationTokensModel>({
      toJSON: () => notificationToken.toJSON(),
    });
  });

  const createMockedUserModel = (userData: User = user) => {
    return createMock<UserModel>({
      toJSON: () => userData.toJSON(),
      rootFolder: null,
    });
  };

  describe('findById', () => {
    it('When user is found by id, then it should return the user domain object', async () => {
      const userId = randomInt(100000);
      const userModelInstance = createMockedUserModel();

      jest.spyOn(userModel, 'findByPk').mockResolvedValue(userModelInstance);

      const result = await repository.findById(userId);

      expect(userModel.findByPk).toHaveBeenCalledWith(userId);
      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe(user.id);
    });

    it('When user is not found by id, then it should return null', async () => {
      const userId = randomInt(100000);

      jest.spyOn(userModel, 'findByPk').mockResolvedValue(null);

      const result = await repository.findById(userId);

      expect(userModel.findByPk).toHaveBeenCalledWith(userId);
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('When user is found by email, then it should return the user domain object', async () => {
      const userModelInstance = createMockedUserModel();

      jest.spyOn(userModel, 'findOne').mockResolvedValue(userModelInstance);

      const result = await repository.findByEmail(user.email);

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { email: user.email },
      });
      expect(result).toBeInstanceOf(User);
      expect(result?.email).toBe(user.email);
    });

    it('When user is not found by email, then it should return null', async () => {
      jest.spyOn(userModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
      expect(result).toBeNull();
    });
  });

  describe('findByUuid', () => {
    it('When user is found by uuid, then it should return the user domain object', async () => {
      const userModelInstance = createMockedUserModel();

      jest.spyOn(userModel, 'findOne').mockResolvedValue(userModelInstance);

      const result = await repository.findByUuid(user.uuid);

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { uuid: user.uuid },
      });
      expect(result).toBeInstanceOf(User);
      expect(result?.uuid).toBe(user.uuid);
    });

    it('When user is not found by uuid, then it should return null', async () => {
      const nonexistentUuid = v4();

      jest.spyOn(userModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findByUuid(nonexistentUuid);

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { uuid: nonexistentUuid },
      });
      expect(result).toBeNull();
    });
  });

  describe('findByUuids', () => {
    it('When users are found by uuids, then it should return array of user domain objects', async () => {
      const uuids = [v4(), v4(), v4()];
      const userModelInstances = uuids.map(() => createMockedUserModel());

      jest.spyOn(userModel, 'findAll').mockResolvedValue(userModelInstances);

      const result = await repository.findByUuids(uuids);

      expect(userModel.findAll).toHaveBeenCalledWith({
        where: { uuid: { [Op.in]: uuids } },
        attributes: ['uuid', 'email', 'name', 'lastname', 'avatar', 'tierId'],
      });
      expect(result).toHaveLength(3);
      expect(result[0]).toBeInstanceOf(User);
    });

    it('When no users are found by uuids, then it should return empty array', async () => {
      const uuids = [v4(), v4()];

      jest.spyOn(userModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findByUuids(uuids);

      expect(userModel.findAll).toHaveBeenCalledWith({
        where: { uuid: { [Op.in]: uuids } },
        attributes: ['uuid', 'email', 'name', 'lastname', 'avatar', 'tierId'],
      });
      expect(result).toEqual([]);
    });
  });

  describe('findByBridgeUser', () => {
    it('When user is found by bridge user, then it should return the user domain object', async () => {
      const bridgeUser = 'bridge-user@example.com';
      const userModelInstance = createMockedUserModel();

      jest.spyOn(userModel, 'findOne').mockResolvedValue(userModelInstance);

      const result = await repository.findByBridgeUser(bridgeUser);

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { bridgeUser },
      });
      expect(result).toBeInstanceOf(User);
    });

    it('When user is not found by bridge user, then it should return null', async () => {
      const bridgeUser = 'nonexistent@example.com';

      jest.spyOn(userModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findByBridgeUser(bridgeUser);

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { bridgeUser },
      });
      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('When user is found by username, then it should return the user domain object', async () => {
      const userModelInstance = createMockedUserModel();

      jest.spyOn(userModel, 'findOne').mockResolvedValue(userModelInstance);

      const result = await repository.findByUsername(user.username);

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { username: user.username },
      });
      expect(result).toBeInstanceOf(User);
      expect(result?.username).toBe(user.username);
    });

    it('When user is not found by username, then it should return null', async () => {
      const username = 'nonexistent';

      jest.spyOn(userModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findByUsername(username);

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { username },
      });
      expect(result).toBeNull();
    });
  });

  describe('findAllBy', () => {
    it('When users are found by criteria, then it should return array of user domain objects', async () => {
      const where = { registerCompleted: true };
      const userModelInstances = [
        createMockedUserModel(),
        createMockedUserModel(),
      ];

      jest.spyOn(userModel, 'findAll').mockResolvedValue(userModelInstances);

      const result = await repository.findAllBy(where);

      expect(userModel.findAll).toHaveBeenCalledWith({ where });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(User);
    });

    it('When no users are found by criteria, then it should return empty array', async () => {
      const where = { registerCompleted: false };

      jest.spyOn(userModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findAllBy(where);

      expect(userModel.findAll).toHaveBeenCalledWith({ where });
      expect(result).toEqual([]);
    });
  });

  describe('findAllCursorById', () => {
    it('When called with lastId, then it should include cursor condition', async () => {
      const where = { registerCompleted: true };
      const lastId = 100;
      const limit = 10;
      const order = [['id', 'ASC']] as Array<[keyof UserModel, 'ASC' | 'DESC']>;

      jest.spyOn(userModel, 'findAll').mockResolvedValue([]);

      await repository.findAllCursorById(where, lastId, limit, order);

      expect(userModel.findAll).toHaveBeenCalledWith({
        where: { ...where, id: { [Op.gt]: lastId } },
        limit,
        order,
      });
    });

    it('When called without lastId, then it should not include cursor condition', async () => {
      const where = { registerCompleted: true };
      const lastId = 0;
      const limit = 10;

      jest.spyOn(userModel, 'findAll').mockResolvedValue([]);

      await repository.findAllCursorById(where, lastId, limit);

      expect(userModel.findAll).toHaveBeenCalledWith({
        where,
        limit,
        order: [],
      });
    });
  });

  describe('create', () => {
    it('When creating a user, then it should return the user domain object', async () => {
      const userData = { email: 'new@example.com', name: 'New User' };
      const userModelInstance = createMockedUserModel();

      jest.spyOn(userModel, 'create').mockResolvedValue(userModelInstance);

      const result = await repository.create(userData);

      expect(userModel.create).toHaveBeenCalledWith(userData);
      expect(result).toBeInstanceOf(User);
    });
  });

  describe('updateById', () => {
    it('When updating user by id, then it should call model update with correct parameters', async () => {
      const userId = randomInt(100000);
      const update = { name: 'Updated Name' };
      const transaction = createMock<Transaction>();

      jest.spyOn(userModel, 'update').mockResolvedValue([1]);

      await repository.updateById(userId, update, transaction);

      expect(userModel.update).toHaveBeenCalledWith(update, {
        where: { id: userId },
        transaction,
      });
    });

    it('When updating user by id without transaction, then it should call model update without transaction', async () => {
      const userId = randomInt(100000);
      const update = { name: 'Updated Name' };

      jest.spyOn(userModel, 'update').mockResolvedValue([1]);

      await repository.updateById(userId, update);

      expect(userModel.update).toHaveBeenCalledWith(update, {
        where: { id: userId },
        transaction: undefined,
      });
    });
  });

  describe('updateBy', () => {
    it('When updating users by criteria, then it should call model update with correct parameters', async () => {
      const where = { registerCompleted: false };
      const update = { registerCompleted: true };
      const transaction = createMock<Transaction>();

      jest.spyOn(userModel, 'update').mockResolvedValue([1]);

      await repository.updateBy(where, update, transaction);

      expect(userModel.update).toHaveBeenCalledWith(update, {
        where,
        transaction,
      });
    });
  });

  describe('updateByUuid', () => {
    it('When updating user by uuid, then it should call model update with correct parameters', async () => {
      const uuid = v4();
      const update = { name: 'Updated Name' };

      jest.spyOn(userModel, 'update').mockResolvedValue([1]);

      await repository.updateByUuid(uuid, update);

      expect(userModel.update).toHaveBeenCalledWith(update, {
        where: { uuid },
      });
    });
  });

  describe('deleteBy', () => {
    it('When deleting users by criteria, then it should call model destroy with correct parameters', async () => {
      const where = { uuid: user.uuid };

      jest.spyOn(userModel, 'destroy').mockResolvedValue(1);

      await repository.deleteBy(where);

      expect(userModel.destroy).toHaveBeenCalledWith({ where });
    });
  });

  describe('loginFailed', () => {
    it('When login failed is true, then it should increment error login count', async () => {
      const testUser = newUser({ attributes: { errorLoginCount: 3 } });

      jest.spyOn(userModel, 'update').mockResolvedValue([1]);

      await repository.loginFailed(testUser, true);

      expect(userModel.update).toHaveBeenCalledWith(
        { errorLoginCount: 4 },
        { where: { uuid: testUser.uuid } },
      );
    });

    it('When login failed is false, then it should reset error login count to 0', async () => {
      const testUser = newUser({ attributes: { errorLoginCount: 5 } });

      jest.spyOn(userModel, 'update').mockResolvedValue([1]);

      await repository.loginFailed(testUser, false);

      expect(userModel.update).toHaveBeenCalledWith(
        { errorLoginCount: 0 },
        { where: { uuid: testUser.uuid } },
      );
    });
  });

  describe('createTransaction', () => {
    it('When creating transaction, then it should return sequelize transaction', async () => {
      const transaction = createMock<Transaction>();
      const sequelize = createMock({
        transaction: () => Promise.resolve(transaction),
      });

      Object.defineProperty(userModel, 'sequelize', {
        value: sequelize,
        writable: true,
      });

      const result = await repository.createTransaction();

      expect(sequelize.transaction).toHaveBeenCalled();
      expect(result).toBe(transaction);
    });
  });

  describe('findOrCreate', () => {
    it('When calling findOrCreate, then it should call model findOrCreate', async () => {
      const opts = { where: { email: 'test@example.com' } };
      const expectedResult = [user, true];

      jest
        .spyOn(userModel, 'findOrCreate')
        .mockResolvedValue(expectedResult as any);

      const result = await repository.findOrCreate(opts as any);

      expect(userModel.findOrCreate).toHaveBeenCalledWith(opts);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('Notification tokens functionality', () => {
    describe('getNotificationTokens', () => {
      it('When getting notification tokens for user, then it should return array of tokens', async () => {
        const userId = v4();
        const where = { type: DeviceType.ios };

        jest
          .spyOn(userNotificationTokensModel, 'findAll')
          .mockResolvedValue([mockTokenModel]);

        const result = await repository.getNotificationTokens(userId, where);

        expect(userNotificationTokensModel.findAll).toHaveBeenCalledWith({
          where: { userId, ...where },
        });
        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(UserNotificationTokens);
      });

      it('When getting notification tokens without additional criteria, then it should use only userId', async () => {
        const userId = v4();

        jest
          .spyOn(userNotificationTokensModel, 'findAll')
          .mockResolvedValue([]);

        await repository.getNotificationTokens(userId);

        expect(userNotificationTokensModel.findAll).toHaveBeenCalledWith({
          where: { userId },
        });
      });
    });

    describe('getNotificationTokensByUserUuids', () => {
      it('When getting notification tokens by user uuids, then it should return array of tokens', async () => {
        const userIds = [v4(), v4()];

        jest
          .spyOn(userNotificationTokensModel, 'findAll')
          .mockResolvedValue([mockTokenModel]);

        const result =
          await repository.getNotificationTokensByUserUuids(userIds);

        expect(userNotificationTokensModel.findAll).toHaveBeenCalledWith({
          where: { userId: { [Op.in]: userIds } },
        });
        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(UserNotificationTokens);
      });
    });

    describe('addNotificationToken', () => {
      it('When adding notification token, then it should create new token record', async () => {
        const userId = v4();
        const token = 'notification-token';
        const type = DeviceType.android;

        jest
          .spyOn(userNotificationTokensModel, 'create')
          .mockResolvedValue({} as any);

        await repository.addNotificationToken(userId, token, type);

        expect(userNotificationTokensModel.create).toHaveBeenCalledWith({
          userId,
          token,
          type,
        });
      });
    });

    describe('deleteUserNotificationTokens', () => {
      it('When deleting notification tokens with specific tokens, then it should include token condition', async () => {
        const userUuid = v4();
        const tokens = ['token1', 'token2'];

        jest.spyOn(userNotificationTokensModel, 'destroy').mockResolvedValue(2);

        await repository.deleteUserNotificationTokens(userUuid, tokens);

        expect(userNotificationTokensModel.destroy).toHaveBeenCalledWith({
          where: {
            userId: userUuid,
            token: { [Op.in]: tokens },
          },
        });
      });

      it('When deleting notification tokens without specific tokens, then it should delete all user tokens', async () => {
        const userUuid = v4();

        jest.spyOn(userNotificationTokensModel, 'destroy').mockResolvedValue(5);

        await repository.deleteUserNotificationTokens(userUuid);

        expect(userNotificationTokensModel.destroy).toHaveBeenCalledWith({
          where: {
            userId: userUuid,
          },
        });
      });
    });

    describe('getNotificationTokenCount', () => {
      it('When getting notification token count, then it should return count for user', async () => {
        const userId = v4();
        const expectedCount = 5;

        jest
          .spyOn(userNotificationTokensModel, 'count')
          .mockResolvedValue(expectedCount);

        const result = await repository.getNotificationTokenCount(userId);

        expect(userNotificationTokensModel.count).toHaveBeenCalledWith({
          where: { userId },
        });
        expect(result).toBe(expectedCount);
      });
    });
  });

  describe('toDomain', () => {
    it('When converting model to domain, then it should return User instance', () => {
      const userModelInstance = createMockedUserModel();

      const result = repository.toDomain(userModelInstance);

      expect(result).toBeInstanceOf(User);
      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
    });

    it('When model has rootFolder, then it should include it in domain object', () => {
      const folderData = { id: 1, name: 'Root', uuid: v4() };
      const userModelInstance = createMock<UserModel>({
        toJSON: () => ({ ...user.toJSON(), rootFolder: folderData }),
        rootFolder: folderData as any,
      });

      const result = repository.toDomain(userModelInstance);

      expect(result).toBeInstanceOf(User);
    });
  });

  describe('toModel', () => {
    it('When converting domain to model, then it should return JSON representation', () => {
      const result = repository.toModel(user);

      expect(result).toEqual(user.toJSON());
    });
  });
});
