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
import { UserModel } from './user.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'users_referrals',
})
export class UserReferralModel extends Model implements UserReferralAttributes {
  @AllowNull(false)
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id: UserReferralAttributes['id'];

  @Column(DataType.INTEGER)
  @ForeignKey(() => UserModel)
  userId: UserReferralAttributes['userId'];

  @Column(DataType.INTEGER)
  @ForeignKey(() => ReferralModel)
  referralId: UserReferralAttributes['referralId'];

  @AllowNull(true)
  @Column(DataType.STRING)
  referred: UserReferralAttributes['referred'];

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  applied: UserReferralAttributes['applied'];

  @Default(Date.now())
  @AllowNull(false)
  @Column(DataType.DATE)
  startDate: UserReferralAttributes['startDate'];
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

  async bulkCreate(
    data: Omit<UserReferralAttributes, 'id' | 'startDate'>[],
  ): Promise<void> {
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
