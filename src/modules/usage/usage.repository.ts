import { InjectModel } from '@nestjs/sequelize';
import { Injectable } from '@nestjs/common';
import { UsageModel } from './usage.model';
import { Usage, UsageType } from './usage.domain';
import { Op, QueryTypes } from 'sequelize';
import { Time } from '../../lib/time';

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

  public async getLatestTemporalUsage(userUuid: string): Promise<Usage | null> {
    const latestUsage = await this.usageModel.findOne({
      where: {
        userId: userUuid,
        [Op.or]: [
          { type: UsageType.Monthly },
          { type: UsageType.Yearly },
          { type: UsageType.Daily },
        ],
      },
      order: [['period', 'DESC']],
    });

    return latestUsage ? this.toDomain(latestUsage) : null;
  }

  public async createFirstUsageCalculation(userUuid: string): Promise<Usage> {
    const currentDate = Time.startOf(Time.now(), 'day');
    const yesterday = Time.startOf(Time.dateWithTimeAdded(-1, 'day'), 'day');
    const periodFormatted = Time.formatAsDateOnly(yesterday);

    const selectResult = await this.usageModel.sequelize.query(
      `
      SELECT
          uuid_generate_v4() as id,
          u.uuid AS user_id,
          COALESCE(
          SUM(CASE
            WHEN f.status != 'DELETED' OR (f.status = 'DELETED' AND f.updated_at >= :currentDate) THEN f.size
          	ELSE 0
          END), 0) AS delta,
          :yesterday AS period,
          'daily' AS type
      FROM
          users u
      LEFT JOIN public.files f ON u.id = f.user_id AND f.created_at < :currentDate
      WHERE
          u.uuid = :userUuid
      GROUP BY
          u.uuid
      `,
      {
        replacements: {
          userUuid,
          currentDate: currentDate.toISOString(),
          yesterday: periodFormatted,
        },
        type: QueryTypes.SELECT,
      },
    );

    const data = selectResult[0] as any;

    const [newUsage] = await this.usageModel.findOrCreate({
      where: {
        userId: data.user_id,
        type: data.type,
        period: periodFormatted,
      },
      defaults: {
        id: data.id,
        userId: data.user_id,
        delta: data.delta,
        period: periodFormatted,
        type: data.type,
      },
    });

    return newUsage ? this.toDomain(newUsage) : null;
  }

  public async calculateAggregatedUsage(userUuid: string): Promise<number> {
    const query = `
      WITH yearly_years AS (
        SELECT DISTINCT date_trunc('year', period) AS year
        FROM public.usages
        WHERE type = 'yearly' AND user_id = :userUuid
      ),
      monthly_months AS (
        SELECT DISTINCT date_trunc('month', period) AS month
        FROM public.usages
        WHERE type = 'monthly'
          AND user_id = :userUuid
          AND date_trunc('year', period) NOT IN (SELECT year FROM yearly_years)
      ),
      aggregated_usage_data AS (
        -- Yearly values
        SELECT 
          delta,
          period
        FROM public.usages
        WHERE type = 'yearly' AND user_id = :userUuid

        UNION ALL

        -- Monthly values (exclude years with yearly)
        SELECT 
          delta,
          period
        FROM public.usages
        WHERE type = 'monthly'
          AND user_id = :userUuid
          AND date_trunc('year', period) NOT IN (SELECT year FROM yearly_years)

        UNION ALL

        -- Daily/replacement (exclude years with yearly AND months with monthly)
        SELECT 
          delta,
          period
        FROM public.usages
        WHERE type IN ('daily', 'replacement')
          AND user_id = :userUuid
          AND date_trunc('year', period) NOT IN (SELECT year FROM yearly_years)
          AND date_trunc('month', period) NOT IN (SELECT month FROM monthly_months)
      )
      SELECT
        COALESCE(SUM(delta), 0) AS calculated_total
      FROM aggregated_usage_data;
    `;

    const result = (await this.usageModel.sequelize.query(query, {
      replacements: { userUuid },
      type: QueryTypes.SELECT,
    })) as unknown as [
      {
        calculated_total: number;
      }[],
    ];

    return Number((result[0] as any).calculated_total);
  }

  toDomain(model: UsageModel): Usage {
    return Usage.build({
      ...model.toJSON(),
    });
  }
}
