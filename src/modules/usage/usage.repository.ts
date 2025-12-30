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

    const selectResult = (await this.usageModel.sequelize.query(
      `
      SELECT
          uuid_generate_v4() as id,
          :userUuid AS user_id,
          COALESCE(SUM(delta), 0) AS delta,
          :yesterday AS period,
          'daily' AS type
      FROM (
          -- Files
          SELECT
              CASE
                  WHEN f.status != 'DELETED' OR (f.status = 'DELETED' AND f.updated_at >= :currentDate) THEN f.size
                  ELSE 0
              END as delta
          FROM files f
          JOIN users u ON u.id = f.user_id
          WHERE u.uuid = :userUuid AND f.created_at < :currentDate

          UNION ALL

          -- File Versions
          SELECT
              CASE
                  WHEN fv.status != 'DELETED' OR (fv.status = 'DELETED' AND fv.updated_at >= :currentDate) THEN fv.size
                  ELSE 0
              END as delta
          FROM file_versions fv
          WHERE fv.user_id = :userUuid AND fv.created_at < :currentDate
      ) combined
      `,
      {
        replacements: {
          userUuid,
          currentDate: currentDate.toISOString(),
          yesterday: periodFormatted,
        },
        type: QueryTypes.SELECT,
      },
    )) as [
      {
        id: string;
        user_id: string;
        delta: string;
        period: string;
        type: string;
      },
    ];

    const data = selectResult[0];

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
      WITH 
      has_yearly AS (
        SELECT EXTRACT(YEAR FROM period)::int AS year
        FROM usages
        WHERE user_id = :userUuid AND type = 'yearly'
      ),
      has_monthly AS (
        SELECT 
          EXTRACT(YEAR FROM period)::int AS year,
          EXTRACT(MONTH FROM period)::int AS month
        FROM usages
        WHERE user_id = :userUuid AND type = 'monthly'
      ),
      combined_deltas AS (
        -- Always include yearly
        SELECT delta 
        FROM usages
        WHERE user_id = :userUuid AND type = 'yearly'
        
        UNION ALL
        
        -- Monthly only if no yearly for that year
        SELECT delta 
        FROM usages m
        WHERE user_id = :userUuid AND type = 'monthly'
          AND NOT EXISTS (
            SELECT 1 FROM has_yearly 
            WHERE year = EXTRACT(YEAR FROM m.period)::int
          )
        
        UNION ALL
        
        -- Daily/replacement only if no monthly or yearly for that period
        SELECT delta 
        FROM usages d
        WHERE user_id = :userUuid AND type IN ('daily', 'replacement')
          AND NOT EXISTS (
            SELECT 1 FROM has_yearly 
            WHERE year = EXTRACT(YEAR FROM d.period)::int
          )
          AND NOT EXISTS (
            SELECT 1 FROM has_monthly 
            WHERE year = EXTRACT(YEAR FROM d.period)::int
              AND month = EXTRACT(MONTH FROM d.period)::int
          )
      )
      SELECT SUM(delta) AS calculated_total
      FROM combined_deltas;
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
