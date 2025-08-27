import { InjectModel } from '@nestjs/sequelize';
import { Injectable } from '@nestjs/common';
import { UsageModel } from './usage.model';
import { Usage, UsageType } from './usage.domain';
import { Op, QueryTypes } from 'sequelize';

@Injectable()
export class SequelizeUsageRepository {
  constructor(
    @InjectModel(UsageModel)
    private readonly usageModel: typeof UsageModel,
  ) {}

  public async create(usage: Omit<Usage, 'id'>) {
    const newUsage = await this.usageModel.create(usage);

    return this.toDomain(newUsage);
  }

  public async createMonthlyUsage(usage: Usage) {
    const newUsage = await this.usageModel.create({
      ...usage,
    });

    return this.toDomain(newUsage);
  }

  public async getMostRecentMonthlyOrYearlyUsage(
    userUuid: string,
  ): Promise<Usage | null> {
    const mostRecentUsage = await this.usageModel.findOne({
      where: {
        userId: userUuid,
        [Op.or]: [{ type: UsageType.Monthly }, { type: UsageType.Yearly }],
      },
      order: [['period', 'DESC']],
    });

    return mostRecentUsage ? this.toDomain(mostRecentUsage) : null;
  }

  public async createFirstUsageCalculation(userUuid: string): Promise<Usage> {
    const selectResult = await this.usageModel.sequelize.query(
      `
      SELECT
          uuid_generate_v4() as id,
          u.uuid AS user_id,
          COALESCE(SUM(f.size), 0) AS delta,
          (CURRENT_DATE - INTERVAL '1 day')::DATE AS period,
          'monthly' AS type
      FROM
          users u
      LEFT JOIN public.files f ON u.id = f.user_id
          AND f.status != 'DELETED'
          AND f.created_at < CURRENT_DATE
      WHERE
          u.uuid = :userUuid
      GROUP BY
          u.uuid
      `,
      {
        replacements: { userUuid },
        type: QueryTypes.SELECT,
      },
    );

    const data = selectResult[0] as any;

    const [newUsage] = await this.usageModel.findOrCreate({
      where: {
        userId: data.user_id,
        type: data.type,
        period: data.period,
      },
      defaults: {
        id: data.id,
        userId: data.user_id,
        delta: data.delta,
        period: data.period,
        type: data.type,
      },
    });

    return newUsage ? this.toDomain(newUsage) : null;
  }

  toDomain(model: UsageModel): Usage {
    return Usage.build({
      ...model.toJSON(),
    });
  }
}
