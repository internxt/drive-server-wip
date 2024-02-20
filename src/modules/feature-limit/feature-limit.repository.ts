import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TierModel } from './models/tier.model';
import { Limitmodel } from './models/limit.model';
import { TierLimitsModel } from './models/tier-limits.model';
import { Limit } from './limit.domain';
import { PaidPlansModel } from './models/paid-plans.model';

@Injectable()
export class SequelizeFeatureLimitsRepository {
  constructor(
    @InjectModel(TierModel)
    private tierModel: typeof TierModel,
    @InjectModel(Limitmodel)
    private limitModel: typeof Limitmodel,
    @InjectModel(TierLimitsModel)
    private tierLimitmodel: typeof TierLimitsModel,
    @InjectModel(PaidPlansModel)
    private paidPlansModel: typeof PaidPlansModel,
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

  async findAllPlansTiersMap(): Promise<PaidPlansModel[]> {
    return this.paidPlansModel.findAll();
  }
}
