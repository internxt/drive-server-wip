import { Injectable, Logger } from '@nestjs/common';
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
import { UserReferralNotFoundException } from './exception/user-referral-not-found.exception';
import {
  ReferralModel,
  SequelizeReferralRepository,
} from './referrals.repository';
import { ReferralAttributes, UserReferralAttributes } from './user.domain';
import { UserModel } from './user.model';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { ConfigService } from '@nestjs/config';
import { SequelizeUserRepository } from './user.repository';
import { UserAttributes } from './user.attributes';
import { PaymentsService } from '../../externals/payments/payments.service';
import { AppSumoUseCase } from '../app-sumo/app-sumo.usecase';
import { AppSumoModel } from '../app-sumo/app-sumo.model';
import { AppSumoNotFoundException } from '../app-sumo/exception/app-sumo-not-found.exception';
import { Constans } from '../../lib/contants';
import { ReferralsNotAvailableException } from './exception/referrals-not-available.exception';
import { UserNotFoundException } from './exception/user-not-found.exception';
import { ReferralNotFoundException } from './exception/referral-not-found.exception';

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
export class SequelizeUserReferralsRepository implements UserReferralsRepository {
  private readonly logger = new Logger(SequelizeUserReferralsRepository.name);

  constructor(
    @InjectModel(UserReferralModel)
    private readonly model: typeof UserReferralModel,
    private readonly bridgeService: BridgeService,
    private readonly config: ConfigService,
    private readonly referralsRepository: SequelizeReferralRepository,
    private readonly userRepository: SequelizeUserRepository,
    private readonly paymentsService: PaymentsService,
    private readonly appSumoUseCase: AppSumoUseCase,
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

  async applyUserReferral(
    userId: UserAttributes['id'],
    referralKey: ReferralAttributes['key'],
    referred?: string,
  ) {
    const referral = await this.referralsRepository.findOne({
      key: referralKey,
    });

    if (!referral) {
      throw new ReferralNotFoundException();
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UserNotFoundException();
    }

    const userReferral = await this.model.findOne({
      where: {
        userId,
        referralId: referral.id,
        applied: false,
      },
    });

    if (!userReferral) {
      throw new UserReferralNotFoundException();
    }

    const userHasReferralsProgram = await this.hasReferralsProgram(
      userId,
      user.email,
      user.bridgeUser,
      user.userId,
    );

    if (!userHasReferralsProgram) {
      throw new ReferralsNotAvailableException();
    }

    await this.updateReferralById(userReferral.id, {
      referred,
      applied: true,
    });

    await this.redeemUserReferral(
      user.uuid,
      userId,
      referral.type,
      referral.credit,
    );
  }

  async hasReferralsProgram(
    userId: number,
    userEmail: string,
    networkUser: string,
    networkPassword: string,
  ) {
    let appSumo: AppSumoModel | null;

    try {
      appSumo = await this.appSumoUseCase.getByUserId(userId);
    } catch (error) {
      if (error instanceof AppSumoNotFoundException) {
        this.logger.log(error.message);
      }
    }

    const [hasSubscriptions, maxSpaceBytes] = await Promise.all([
      this.paymentsService.hasSubscriptions(userEmail),
      this.bridgeService.getLimit(networkUser, networkPassword),
    ]);

    const isLifetime = maxSpaceBytes > Constans.MAX_FREE_PLAN_BYTES;

    return !appSumo && !(isLifetime || hasSubscriptions);
  }

  async redeemUserReferral(
    uuid: string,
    userId: number,
    type: string,
    credit: number,
  ) {
    if (type === 'storage') {
      if (
        this.config.get('apis.storage.auth.username') &&
        this.config.get('apis.storage.auth.password')
      ) {
        await this.bridgeService.addStorage(uuid, credit);
      } else {
        this.logger.warn(
          '(usersReferralsService.redeemUserReferral) GATEWAY_USER' +
            ' || GATEWAY_PASS not found. Skipping storage increasing',
        );
      }
    }

    this.logger.log(
      `(usersReferralsService.redeemUserReferral) ` +
        `The user '${uuid}' (id: ${userId}) has redeemed a referral: ${type} - ${credit}`,
    );
  }
}
