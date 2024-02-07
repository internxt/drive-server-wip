import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TierModel } from './models/tier.model';
import { Limitmodel } from './models/limit.model';
import { TierLimitsModel } from './models/tier-limits.model';
import { Limit } from './limit.domain';

@Injectable()
export class SequelizeFeatureLimitsRepository {
  constructor(
    @InjectModel(TierModel)
    private tierModel: typeof TierModel,
    @InjectModel(Limitmodel)
    private limitModel: typeof Limitmodel,
    @InjectModel(TierLimitsModel)
    private tierLimitmodel: typeof TierLimitsModel,
  ) {}

  async findLimitByLabelAndTier(
    tierId: string,
    label: string,
  ): Promise<Limit | null> {
    const limit = await this.limitModel.findOne({
      where: {
        label,
      },
      include: [
        {
          model: TierModel,
          where: {
            id: tierId,
          },
        },
      ],
    });

    return limit ? Limit.build(limit) : null;
  }
}
