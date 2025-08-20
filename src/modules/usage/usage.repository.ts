import { InjectModel } from '@nestjs/sequelize';
import { Injectable } from '@nestjs/common';
import { UsageModel } from './usage.model';
import { Usage, UsageType } from './usage.domain';
import { Op } from 'sequelize';

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
    // Calculate yesterday's date in the application to avoid timezone issues
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const query = `
      INSERT INTO public.usages (id, user_id, delta, period, type, created_at, updated_at)
      SELECT
          uuid_generate_v4(),
          u.uuid::uuid AS user_id,
          COALESCE(SUM(f.size), 0) AS delta,
          :period::DATE AS period,
          'monthly' AS type,
          NOW() AS created_at,
          NOW() AS updated_at
      FROM
          users u
      LEFT JOIN public.files f ON u.id = f.user_id
          AND f.status != 'DELETED'
          -- Ensure we only consider files created before today
          AND f.created_at < :today::DATE
      WHERE
          u.uuid = :userUuid
      GROUP BY
          u.uuid
      RETURNING *;
    `;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.usageModel.sequelize.query(query, {
      replacements: {
        userUuid,
        period: yesterday.toISOString().split('T')[0],
        today: today.toISOString().split('T')[0],
      },
      model: UsageModel,
      logging: true,
    });

    return result.length > 0 ? this.toDomain(result[0]) : null;
  }

  toDomain(model: UsageModel): Usage {
    return Usage.build({
      ...model.toJSON(),
    });
  }
}
