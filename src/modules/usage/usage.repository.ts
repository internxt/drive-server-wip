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

  public async findOrCreateMonthlyUsage(usage: Omit<Usage, 'id'>) {
    const [newUsage] = await this.usageModel.findOrCreate({
      where: {
        userId: usage.userId,
        type: usage.type,
        period: usage.period,
      },
      defaults: {
        ...usage,
      },
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

  async getUserUsage(userUuid: string) {
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
                  date_trunc('month', period) AS month,
                  SUM(delta) AS total_delta
              FROM
                  public.usages
              WHERE
                  type = 'monthly'
                  AND user_id = :userUuid
              GROUP BY
                  date_trunc('year', period), date_trunc('month', period)
          ),
          daily_sums AS (
              SELECT
                  date_trunc('year', period) AS year,
                  date_trunc('month', period) AS month,
                  SUM(delta) AS total_delta
              FROM
                  public.usages
              WHERE
                  type = 'daily'
                  AND user_id = :userUuid
              GROUP BY
                  date_trunc('year', period), date_trunc('month', period)
          ),
          combined_monthly_and_daily AS (
              SELECT
                  COALESCE(m.year, d.year) AS year,
                  COALESCE(m.month, d.month) AS month,
                  COALESCE(m.total_delta, 0) + COALESCE(d.total_delta, 0) AS total_delta
              FROM
                  monthly_sums m
                  FULL JOIN daily_sums d ON m.year = d.year AND m.month = d.month
          ),
          combined_sums AS (
              SELECT
                  y.year,
                  NULL AS month,
                  y.total_delta AS total_delta
              FROM
                  yearly_sums y
              UNION ALL
              SELECT
                  cmd.year,
                  cmd.month,
                  cmd.total_delta
              FROM
                  combined_monthly_and_daily cmd
                  LEFT JOIN yearly_sums ys ON cmd.year = ys.year
              WHERE
                  ys.year IS NULL -- Exclude months and days where a yearly row exists
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
      totalYearlyDelta: Number(result[0].total_yearly_delta || 0),
      totalMonthlyDelta: Number(result[0].total_monthly_delta || 0),
    };
  }

  toDomain(model: UsageModel): Usage {
    return Usage.build({
      ...model.toJSON(),
    });
  }
}
