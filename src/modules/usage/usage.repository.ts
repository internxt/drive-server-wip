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

  public async create(usage: Omit<Usage, 'id'>) {
    const newUsage = await this.usageModel.create(usage);

    return this.toDomain(newUsage);
  }

  public async getMostRecentUsage(userUuid: string): Promise<Usage | null> {
    const mostRecentUsage = await this.usageModel.findOne({
      where: { userId: userUuid },
      order: [['period', 'DESC']],
    });

    return mostRecentUsage ? this.toDomain(mostRecentUsage) : null;
  }

  public async getUsage(
    where: Partial<Usage>,
    order?: Array<[keyof Usage, 'ASC' | 'DESC']>,
  ): Promise<Usage | null> {
    const mostRecentUsage = await this.usageModel.findOne({
      where: { ...where },
      order: order,
    });

    return mostRecentUsage ? this.toDomain(mostRecentUsage) : null;
  }

  public async addFirstDailyUsage(userUuid: string): Promise<Usage> {
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
          AND f.created_at < CURRENT_DATE
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

    return result.length > 0 ? this.toDomain(result[0]) : null;
  }

  public async getUserUsage(userUuid: string) {
    const query = `
        WITH yearly_sums AS (
        SELECT
            date_trunc('year', period) AS year,
            SUM(delta) AS total_delta
        FROM
            public.usages
        WHERE
            type = 'yearly'
            AND user_id = :userUuid
        GROUP BY
            date_trunc('year', period)
        ),
        monthly_sums AS (
            SELECT
                date_trunc('year', period) AS year,
                SUM(delta) AS total_delta
            FROM
                public.usages
            WHERE
                type = 'monthly'
                AND user_id = :userUuid
            GROUP BY
                date_trunc('year', period)
        ),
        filtered_monthly_sums AS (
            SELECT
                m.year,
                m.total_delta
            FROM
                monthly_sums m
            LEFT JOIN yearly_sums y ON m.year = y.year
            WHERE y.year IS NULL
        ),
        combined_sums AS (
            SELECT
                year,
                total_delta
            FROM
                yearly_sums
            UNION ALL
            SELECT
                year,
                total_delta
            FROM
                filtered_monthly_sums
        )
        SELECT
            SUM(
                CASE
                    WHEN year < date_trunc('year', CURRENT_DATE) THEN total_delta
                    ELSE 0
                END
            ) AS total_yearly_delta,
            SUM(
                CASE
                    WHEN year = date_trunc('year', CURRENT_DATE) THEN total_delta
                    ELSE 0
                END
            ) AS total_monthly_delta
        FROM
            combined_sums;
    `;

    const [result] = (await this.usageModel.sequelize.query(query, {
      replacements: { userUuid },
    })) as unknown as [
      {
        total_yearly_delta: number;
        total_monthly_delta: number;
      }[],
    ];

    return {
      total_yearly_delta: Number(result[0].total_yearly_delta || 0),
      total_monthly_delta: Number(result[0].total_monthly_delta || 0),
    };
  }

  toDomain(model: UsageModel): Usage {
    return Usage.build({
      ...model.toJSON(),
    });
  }
}
