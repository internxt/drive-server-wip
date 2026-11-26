import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type WhereOptions } from 'sequelize';
import { PreCreatedUserCheckoutModel } from './pre-created-user-checkout.model';
import { type PreCreatedUserCheckoutAttributes } from './pre-created-user-checkout.attributes';
import { type PreCreatedUserStatus } from './pre-created-users.attributes';
import { PreCreatedUserCheckout } from './pre-created-user-checkout.domain';
import { PreCreatedUserModel } from './pre-created-users.model';

type PreCreatedUserCheckoutUpdate = Partial<
  Omit<PreCreatedUserCheckoutAttributes, 'email' | 'createdAt' | 'updatedAt'>
>;

@Injectable()
export class SequelizePreCreatedUserCheckoutRepository {
  constructor(
    @InjectModel(PreCreatedUserCheckoutModel)
    private readonly preCreatedUserCheckoutModel: typeof PreCreatedUserCheckoutModel,
    @InjectModel(PreCreatedUserModel)
    private readonly preCreatedUserModel: typeof PreCreatedUserModel,
  ) {}

  async findByNetworkUuid(
    networkUuid: PreCreatedUserCheckoutAttributes['networkUuid'],
  ): Promise<PreCreatedUserCheckout | null> {
    const checkout =
      await this.preCreatedUserCheckoutModel.findByPk(networkUuid);

    if (checkout) {
      return this.toDomain(checkout);
    }

    return this.copyFromPreCreatedUser({ uuid: networkUuid });
  }

  async findByEmail(
    email: PreCreatedUserCheckoutAttributes['email'],
  ): Promise<PreCreatedUserCheckout | null> {
    const checkout = await this.preCreatedUserCheckoutModel.findOne({
      where: { email },
    });

    if (checkout) {
      return this.toDomain(checkout);
    }

    return this.copyFromPreCreatedUser({ username: email });
  }

  async create(
    checkout: Pick<
      PreCreatedUserCheckoutAttributes,
      'networkUuid' | 'email' | 'status'
    >,
  ): Promise<PreCreatedUserCheckout> {
    const created = await this.preCreatedUserCheckoutModel.create(checkout);

    return this.toDomain(created);
  }

  async updateByNetworkUuid(
    networkUuid: PreCreatedUserCheckoutAttributes['networkUuid'],
    update: PreCreatedUserCheckoutUpdate,
  ): Promise<void> {
    await this.preCreatedUserCheckoutModel.update(update, {
      where: { networkUuid },
    });
  }

  async updateByNetworkUuidAndStatus(
    networkUuid: PreCreatedUserCheckoutAttributes['networkUuid'],
    status: PreCreatedUserStatus,
    update: PreCreatedUserCheckoutUpdate,
  ): Promise<boolean> {
    const [updatedRows] = await this.preCreatedUserCheckoutModel.update(
      update,
      {
        where: { networkUuid, status },
      },
    );

    return updatedRows > 0;
  }

  async deleteByNetworkUuid(
    networkUuid: PreCreatedUserCheckoutAttributes['networkUuid'],
  ): Promise<void> {
    await this.preCreatedUserCheckoutModel.destroy({ where: { networkUuid } });
  }

  // TODO: remove once the checkouts left in pre_created_users are copied (PB-7156)
  private async copyFromPreCreatedUser(
    where: WhereOptions<PreCreatedUserModel>,
  ): Promise<PreCreatedUserCheckout | null> {
    const preCreatedUser = await this.preCreatedUserModel.findOne({
      where: { ...where, status: { [Op.ne]: null } },
    });

    if (!preCreatedUser) {
      return null;
    }

    await this.preCreatedUserCheckoutModel.bulkCreate(
      [
        {
          networkUuid: preCreatedUser.uuid,
          email: preCreatedUser.username,
          status: preCreatedUser.status,
          tierId: preCreatedUser.tierId,
          setupEmailSentAt: preCreatedUser.setupEmailSentAt,
          setupEmailResendCount: preCreatedUser.setupEmailResendCount,
        },
      ],
      { ignoreDuplicates: true },
    );

    const copied = await this.preCreatedUserCheckoutModel.findByPk(
      preCreatedUser.uuid,
    );

    return copied ? this.toDomain(copied) : null;
  }

  private toDomain(model: PreCreatedUserCheckoutModel): PreCreatedUserCheckout {
    return PreCreatedUserCheckout.build(model.toJSON());
  }
}
