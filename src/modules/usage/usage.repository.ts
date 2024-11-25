import { InjectModel } from '@nestjs/sequelize';
import { Injectable } from '@nestjs/common';
import { UsageModel } from './usage.model';
import { Usage } from './usage.domain';

@Injectable()
export class SequelizeUsageRepository {
  constructor(
    @InjectModel(UsageModel)
    private readonly usageModel: typeof UsageModel,
  ) {}

  public async getUserUsages(userUuid: string) {
    const usages = await this.usageModel.findAll({
      where: { userId: userUuid },
    });

    return usages.map((usage) => this.toDomain(usage));
  }

  public async getMostRecentUsage(userUuid: string): Promise<Usage | null> {
    const mostRecentUsage = await this.usageModel.findOne({
      where: { userId: userUuid },
      order: [['period', 'DESC']],
    });

    return mostRecentUsage ? this.toDomain(mostRecentUsage) : null;
  }

  public async addFirstDailyUsage(userUuid: string): Promise<Usage[]> {
    const query = `
      INSERT INTO public.usages (id, user_id, delta, period, type, created_at, updated_at)
      SELECT
          uuid_generate_v4(),
          u.uuid::uuid AS user_id,
          COALESCE(SUM(f.size), 0) AS delta,
          (CURRENT_DATE - INTERVAL '1 day')::DATE AS period,
          'monthly' AS type,
          NOW() AS created_at,
          NOW() AS updated_at
      FROM
          users u
      LEFT JOIN public.files f ON u.id = f.user_id
          AND f.status != 'DELETED'
          AND (
              f.created_at < CURRENT_DATE
              AND f.updated_at < CURRENT_DATE
          )
      WHERE
          u.uuid = :userUuid
      GROUP BY
          u.uuid
      RETURNING *;
    `;

    const result = await this.usageModel.sequelize.query(query, {
      replacements: { userUuid },
      model: UsageModel,
    });

    return result.map((result) => this.toDomain(result));
  }

  public async getUserUsage(userUuid: string): Promise<Usage[]> {
    const query = `
      INSERT INTO public.usages (id, user_id, delta, period, type, created_at, updated_at)
      SELECT
          uuid_generate_v4(),
          u.uuid::uuid AS user_id,
          COALESCE(SUM(f.size), 0) AS delta,
          (CURRENT_DATE - INTERVAL '2 day')::DATE AS period,
          'monthly' AS type,
          NOW() AS created_at,
          NOW() AS updated_at
      FROM
          users u
      LEFT JOIN public.files f ON u.id = f.user_id
          AND f.status != 'DELETED'
          AND (
              f.created_at < CURRENT_DATE
              AND f.updated_at < CURRENT_DATE
          )
      WHERE
          u.uuid = :userUuid
      GROUP BY
          u.uuid
      RETURNING *;
    `;

    const result = await this.usageModel.sequelize.query(query, {
      replacements: { userUuid },
      model: UsageModel,
    });

    return result.map((result) => this.toDomain(result));
  }

  toDomain(model: UsageModel): Usage {
    return Usage.build({
      ...model.toJSON(),
    });
  }
}
