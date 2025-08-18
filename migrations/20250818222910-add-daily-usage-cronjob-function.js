'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
    CREATE OR REPLACE PROCEDURE calculate_daily_usage()
    LANGUAGE plpgsql AS $$
    BEGIN
        INSERT INTO public.usages (
            id, 
            user_id, 
            delta, 
            period, 
            type, 
            created_at, 
            updated_at
        )
        SELECT 
            uuid_generate_v4() AS id,
            u.uuid::uuid AS user_id,
            SUM(
                CASE
                    -- Files created and deleted same day don't count torwards daily usage
                    WHEN f.status = 'DELETED' AND date_trunc('day', f.created_at) = date_trunc('day', f.updated_at) THEN 0
                    WHEN f.status = 'DELETED' THEN -f.size
                    ELSE f.size
                END
            ) AS delta,
            CURRENT_DATE - INTERVAL '1 day' AS period,
            'daily' AS type,
            NOW() AS created_at,
            NOW() AS updated_at
        FROM files f
        INNER JOIN users u ON u.id = f.user_id
        LEFT JOIN (
            SELECT 
                user_id, 
                MAX(period) AS last_recorded_period
            FROM public.usages
            WHERE type = 'daily'
            GROUP BY user_id
        ) last_usage ON u.uuid::uuid = last_usage.user_id::uuid
        WHERE 
            -- Only process users who don't have yesterday's usage calculated yet
            (last_usage.last_recorded_period IS NULL OR last_usage.last_recorded_period != CURRENT_DATE - INTERVAL '1 day')
            AND 
            (
                -- Files created yesterday
                (f.status != 'DELETED' 
                AND f.created_at >= CURRENT_DATE - INTERVAL '1 day'
                AND f.created_at < CURRENT_DATE)
                OR 
                -- Files deleted yesterday
                (f.status = 'DELETED' 
                AND f.updated_at >= CURRENT_DATE - INTERVAL '1 day'
                AND f.updated_at < CURRENT_DATE)
            )
        GROUP BY u.uuid;
    END;
    $$;
  `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP PROCEDURE IF EXISTS calculate_daily_usage;
    `);
  },
};
