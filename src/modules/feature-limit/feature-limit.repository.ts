import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TierModel } from './models/tier.model';
import { Limitmodel } from './models/limit.model';
import { Limit } from './domain/limit.domain';
import { PaidPlansModel } from './models/paid-plans.model';
import { Tier } from './domain/tier.domain';
import { PLAN_FREE_TIER_ID } from './limits.enum';
import { TierLimitsModel } from './models/tier-limits.model';
import { UserOverriddenLimitModel } from './models/user-overridden-limit.model';

@Injectable()
export class SequelizeFeatureLimitsRepository {
  constructor(
    @InjectModel(Limitmodel)
    private readonly limitModel: typeof Limitmodel,
    @InjectModel(TierModel)
    private readonly tierModel: typeof TierModel,
    @InjectModel(PaidPlansModel)
    private readonly paidPlansModel: typeof PaidPlansModel,
    @InjectModel(TierLimitsModel)
    private readonly tierLimitsModel: typeof TierLimitsModel,
    @InjectModel(UserOverriddenLimitModel)
    private readonly userOverriddenLimitModel: typeof UserOverriddenLimitModel,
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

  async findTierByLabel(label: string): Promise<Tier | null> {
    const tier = await this.tierModel.findOne({ where: { label } });
    return tier ? Tier.build(tier) : null;
  }

  async findLimitsByLabelAndTiers(
    tierIds: string[],
    label: string,
  ): Promise<Limit[]> {
    const tierLimits = await this.tierLimitsModel.findAll({
      where: {
        tierId: tierIds,
      },
      include: [
        {
          model: Limitmodel,
          where: {
            label,
          },
          required: true,
        },
      ],
    });

    return tierLimits.length ? tierLimits.map((tl) => new Limit(tl.limit)) : [];
  }

  async findUserOverriddenLimit(
    userId: string,
    limitLabel: string,
  ): Promise<Limit | null> {
    const userOverriddenLimit = await this.userOverriddenLimitModel.findOne({
      where: { userId },
      include: [
        {
          model: Limitmodel,
          where: { label: limitLabel },
          required: true,
        },
      ],
    });

    return userOverriddenLimit?.limit
      ? Limit.build(userOverriddenLimit.limit)
      : null;
  }

  async findAllUserOverriddenLimits(userId: string): Promise<Limit[]> {
    const userOverriddenLimits = await this.userOverriddenLimitModel.findAll({
      where: { userId },
      include: [{ model: Limitmodel, required: true }],
    });

    return userOverriddenLimits.map((uol) => Limit.build(uol.limit));
  }

  async upsertOverridenLimit(userId: string, limitId: string): Promise<void> {
    await this.userOverriddenLimitModel.upsert({
      id: undefined,
      userId,
      limitId,
    });
  }

  async findLimitById(limitId: string): Promise<Limit | null> {
    const limit = await this.limitModel.findByPk(limitId);
    return limit ? Limit.build(limit) : null;
  }

  async findLimitByLabel(label: string): Promise<Limit | null> {
    const limit = await this.limitModel.findOne({ where: { label } });
    return limit ? Limit.build(limit) : null;
  }

  async findLimitByLabelAndValue(
    label: string,
    value: string,
  ): Promise<Limit | null> {
    const limit = await this.limitModel.findOne({ where: { label, value } });
    return limit ? Limit.build(limit) : null;
  }
}
