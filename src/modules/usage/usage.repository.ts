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

  async getUserUsage(userUuid: string) {
    const query = `
    WITH years_with_yearly AS (
      SELECT DISTINCT date_trunc('year', period) AS year
        FROM public.usages
        WHERE type = 'yearly' AND user_id = :userUuid
    ),
    aggregated_data AS (
        -- Aggregate yearly data where it exists
        SELECT
            date_trunc('year', period) AS year,
            SUM(delta) AS total_delta
        FROM public.usages
        WHERE type = 'yearly' AND user_id = :userUuid
        GROUP BY date_trunc('year', period)
        
        UNION ALL
        
        -- Aggregate monthly + daily data for years without yearly data
        SELECT
            date_trunc('year', period) AS year,
            SUM(delta) AS total_delta
        FROM public.usages
        WHERE type IN ('monthly', 'daily')
          AND user_id = :userUuid
          AND date_trunc('year', period) NOT IN (SELECT year FROM years_with_yearly)
        GROUP BY date_trunc('year', period)
    )
    SELECT
        SUM(CASE WHEN year < date_trunc('year', CURRENT_DATE) THEN total_delta ELSE 0 END) AS previous_years_total,
        SUM(CASE WHEN year = date_trunc('year', CURRENT_DATE) THEN total_delta ELSE 0 END) AS current_year_total
    FROM aggregated_data;
    `;

    const [result] = (await this.usageModel.sequelize.query(query, {
      replacements: { userUuid },
    })) as unknown as [
      {
        previous_years_total: number;
        current_year_total: number;
      }[],
    ];

    return (
      Number(result[0].previous_years_total || 0) +
      Number(result[0].current_year_total || 0)
    );
  }

  toDomain(model: UsageModel): Usage {
    return Usage.build({
      ...model.toJSON(),
    });
  }
}
