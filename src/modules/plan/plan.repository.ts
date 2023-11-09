import { InjectModel } from '@nestjs/sequelize';
import { PlanModel } from './plan.model';
import { PlanNotFoundException } from './exception/plan-not-found.exception';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SequelizePlanRepository {
  constructor(
    @InjectModel(PlanModel)
    private readonly planModel: typeof PlanModel,
  ) {}

  /**
   *
   * @param plan {Partial<PlanModel>}
   * @returns {PlanModel}
   */
  public async getOneBy(plan: Partial<PlanModel>): Promise<PlanModel> {
    const item = await this.planModel.findOne({ where: plan });

    if (!item) {
      throw new PlanNotFoundException();
    }

    return item;
  }
}
