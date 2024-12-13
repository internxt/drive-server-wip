import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FindOrCreateOptions, Transaction } from 'sequelize/types';

import { Folder } from '../folder/folder.domain';

import { UserAttributes } from './user.attributes';
import { User } from './user.domain';
import { UserModel } from './user.model';
import { Op } from 'sequelize';
import { UserNotificationTokensModel } from './user-notification-tokens.model';
import { UserNotificationTokens } from './user-notification-tokens.domain';

export interface UserRepository {
  findById(id: number): Promise<User | null>;
  findByUuid(uuid: User['uuid']): Promise<User | null>;
  findByUuids(uuid: User['uuid'][]): Promise<User[]>;
  findAllBy(where: any): Promise<Array<User> | []>;
  findByEmail(email: User['email']): Promise<User | null>;
  findByBridgeUser(bridgeUser: User['bridgeUser']): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  updateByUuid(
    uuid: User['uuid'],
    update: Partial<UserAttributes>,
  ): Promise<void>;
  toDomain(model: UserModel): User;
  toModel(domain: User): Partial<UserAttributes>;
  updateBy(
    where: Partial<UserAttributes>,
    update: Partial<UserAttributes>,
    transaction?: Transaction,
  ): Promise<void>;
  getMeetClosedBetaUsers(): Promise<string[]>;
  setRoomToBetaUser(room: string, user: User): Promise<void>;
  getBetaUserFromRoom(room: string): Promise<User | null>;
  getNotificationTokens(
    userId: string,
    where?: Partial<Omit<UserNotificationTokens, 'userId'>>,
  ): Promise<UserNotificationTokens[]>;
  deleteUserNotificationTokens(
    userUuid: UserAttributes['uuid'],
    tokens: string[],
  ): Promise<void>;
  getNotificationTokenCount(userId: string): Promise<number>;
}

@Injectable()
export class SequelizeUserRepository implements UserRepository {
  constructor(
    @InjectModel(UserModel)
    private modelUser: typeof UserModel,
    @InjectModel(UserNotificationTokensModel)
    private modelUserNotificationTokens: typeof UserNotificationTokensModel,
  ) {}
  async findById(id: number): Promise<User | null> {
    const user = await this.modelUser.findByPk(id);
    return user ? this.toDomain(user) : null;
  }

  async findByEmail(email: User['email']): Promise<User> {
    const user = await this.modelUser.findOne({ where: { email } });
    return user ? this.toDomain(user) : null;
  }

  async findByUuid(uuid: User['uuid']): Promise<User | null> {
    const user = await this.modelUser.findOne({ where: { uuid } });
    return user ? this.toDomain(user) : null;
  }

  async findByUuids(uuids: string[]): Promise<User[]> {
    const users = await this.modelUser.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
    });

    return users.map((user) => this.toDomain(user));
  }

  createTransaction(): Promise<Transaction> {
    return this.modelUser.sequelize.transaction();
  }

  async findByBridgeUser(bridgeUser: string): Promise<User | null> {
    const user = await this.modelUser.findOne({ where: { bridgeUser } });

    return user ? this.toDomain(user) : null;
  }

  findOrCreate(opts: FindOrCreateOptions): Promise<[User | null, boolean]> {
    return this.modelUser.findOrCreate(opts) as any;
  }

  async create(user: any): Promise<User> {
    const dbUser = await this.modelUser.create(user);

    return this.toDomain(dbUser);
  }

  async findByReferralCode(
    referralCode: UserAttributes['referralCode'],
  ): Promise<User | null> {
    const user = await this.modelUser.findOne({ where: { referralCode } });

    return user ? this.toDomain(user) : null;
  }

  async findAllBy(where: any): Promise<Array<User>> {
    const users = await this.modelUser.findAll({ where });
    return users.map((user) => this.toDomain(user));
  }

  async findAllCursorById(
    where: Partial<Record<keyof UserAttributes, any>>,
    lastId: number,
    limit: number,
    order: Array<[keyof UserModel, 'ASC' | 'DESC']> = [],
  ): Promise<User[]> {
    const cursorCondition = lastId ? { id: { [Op.gt]: lastId } } : {};
    const combinedWhere = {
      ...where,
      ...cursorCondition,
    };

    const users = await this.modelUser.findAll({
      where: combinedWhere,
      limit,
      order,
    });

    return users.map(this.toDomain.bind(this));
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.modelUser.findOne({
      where: {
        username,
      },
    });
    return user ? this.toDomain(user) : null;
  }

  async updateById(
    id: UserAttributes['id'],
    update: Partial<UserAttributes>,
    transaction?: Transaction,
  ): Promise<void> {
    await this.modelUser.update(update, { where: { id }, transaction });
  }

  async updateBy(
    where: Partial<UserAttributes>,
    update: Partial<UserAttributes>,
    transaction?: Transaction,
  ): Promise<void> {
    await this.modelUser.update(update, { where, transaction });
  }

  async updateByUuid(uuid: User['uuid'], update: Partial<User>): Promise<void> {
    await this.modelUser.update(update, { where: { uuid } });
  }

  async getMeetClosedBetaUsers(): Promise<string[]> {
    const [rawEmails] = await this.modelUser.sequelize.query(
      'SELECT email FROM meet_closed_beta_users',
    );

    const betaEmails = rawEmails.map(
      (rawEmail: { email: string }) => rawEmail.email,
    );
    return betaEmails;
  }

  async setRoomToBetaUser(room: string, user: User): Promise<void> {
    await this.modelUser.sequelize.query(
      'UPDATE meet_closed_beta_users SET room = :room, updated_at = NOW() WHERE email = :userEmail',
      {
        replacements: { room, userEmail: user.email },
      },
    );
  }

  async getBetaUserFromRoom(room: string): Promise<User | null> {
    const [rawEmails] = await this.modelUser.sequelize.query(
      'SELECT email FROM meet_closed_beta_users WHERE room = :room',
      {
        replacements: { room },
      },
    );

    const betaEmails = rawEmails.map(
      (rawEmail: { email: string }) => rawEmail.email,
    );
    if (betaEmails.length > 0) {
      const user = await this.modelUser.findOne({
        where: { email: betaEmails[0] },
      });
      return user ? this.toDomain(user) : null;
    }
    return null;
  }

  async getNotificationTokens(
    userId: string,
    where?: Partial<Omit<UserNotificationTokens, 'userId'>>,
  ): Promise<UserNotificationTokens[]> {
    const tokens = await this.modelUserNotificationTokens.findAll({
      where: { userId, ...where },
    });

    return tokens.map((token) => UserNotificationTokens.build(token.toJSON()));
  }

  async getNotificationTokensByUserUuids(
    userIds: string[],
  ): Promise<UserNotificationTokens[]> {
    const tokens = await this.modelUserNotificationTokens.findAll({
      where: { userId: { [Op.in]: userIds } },
    });

    return tokens.map((token) => UserNotificationTokens.build(token.toJSON()));
  }

  async deleteUserNotificationTokens(
    userUuid: UserAttributes['uuid'],
    tokens: string[],
  ) {
    await this.modelUserNotificationTokens.destroy({
      where: {
        userId: userUuid,
        token: {
          [Op.in]: tokens,
        },
      },
    });
  }

  async addNotificationToken(
    userId: string,
    token: string,
    type: UserNotificationTokens['type'],
  ): Promise<void> {
    await this.modelUserNotificationTokens.create({
      userId,
      token,
      type,
    });
  }

  async getNotificationTokenCount(userId: string): Promise<number> {
    return this.modelUserNotificationTokens.count({ where: { userId } });
  }

  toDomain(model: UserModel): User {
    return User.build({
      ...model.toJSON(),
      rootFolder: model.rootFolder ? Folder.build(model.rootFolder) : null,
    });
  }

  toModel(domain: User): Partial<UserAttributes> {
    return domain.toJSON();
  }
}
export { UserModel };
