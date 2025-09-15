import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TierModel } from './models/tier.model';
import { Limitmodel } from './models/limit.model';
import { Limit } from './limit.domain';
import { PaidPlansModel } from './models/paid-plans.model';
import { Tier } from './tier.domain';
import { PLAN_FREE_TIER_ID } from './limits.enum';

@Injectable()
export class SequelizeFeatureLimitsRepository {
  constructor(
    @InjectModel(Limitmodel)
    private readonly limitModel: typeof Limitmodel,
    @InjectModel(TierModel)
    private readonly tierModel: typeof TierModel,
    @InjectModel(PaidPlansModel)
    private readonly paidPlansModel: typeof PaidPlansModel,
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

  async getTierByPlanId(planId: string): Promise<Tier | null> {
    const planTier = await this.paidPlansModel.findOne({
      where: { planId },
      include: [TierModel],
    });

    return planTier?.tier ? Tier.build(planTier?.tier) : null;
  }

  async getFreeTier(): Promise<Tier | null> {
    return this.getTierByPlanId(PLAN_FREE_TIER_ID);
  }

  async findTierById(tierId: string): Promise<Tier | null> {
    const tier = await this.tierModel.findByPk(tierId);
    return tier ? Tier.build(tier) : null;
  }
}
