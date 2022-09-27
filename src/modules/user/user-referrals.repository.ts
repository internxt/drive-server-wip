import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  AllowNull,
  AutoIncrement,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ReferralModel } from './referrals.repository';
import { UserReferralAttributes } from './user.domain';
import { UserModel } from './user.repository';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'users_referrals',
})
export class UserReferralModel extends Model implements UserReferralAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  @AllowNull(false)
  id: UserReferralAttributes['id'];

  @Column(DataType.INTEGER)
  @ForeignKey(() => UserModel)
  userId: UserReferralAttributes['userId'];

  @Column(DataType.INTEGER)
  @ForeignKey(() => ReferralModel)
  referralId: UserReferralAttributes['referralId'];

  @Column(DataType.STRING)
  @AllowNull(true)
  referred: UserReferralAttributes['referred'];

  @Column(DataType.BOOLEAN)
  @AllowNull(false)
  @Default(false)
  applied: UserReferralAttributes['applied'];
}

export interface UserReferralsRepository {
  findOneWhere(
    where: Partial<UserReferralAttributes>,
  ): Promise<UserReferralAttributes | null>;
  bulkCreate(data: Omit<UserReferralAttributes, 'id'>[]): Promise<void>;
  updateReferralById(
    id: UserReferralAttributes['id'],
    update: Partial<UserReferralAttributes>,
  ): Promise<void>;
}

@Injectable()
export class SequelizeUserReferralsRepository
  implements UserReferralsRepository
{
  constructor(
    @InjectModel(UserReferralModel)
    private model: typeof UserReferralModel,
  ) {}

  findOneWhere(
    where: Partial<UserReferralAttributes>,
  ): Promise<UserReferralAttributes | null> {
    return this.model.findOne({ where });
  }

  async bulkCreate(data: Omit<UserReferralAttributes, 'id'>[]): Promise<void> {
    const userReferralsWithStartDate = data.map((ur) => ({
      ...ur,
      startDate: new Date(),
    }));

    await this.model.bulkCreate(userReferralsWithStartDate, {
      individualHooks: true,
      // fields: ['user_id', 'referral_id', 'start_date, applied'],
    });
  }

  async updateReferralById(
    id: UserReferralAttributes['id'],
    update: Partial<UserReferralAttributes>,
  ) {
    await this.model.update(update, {
      where: { id },
    });
  }
}
