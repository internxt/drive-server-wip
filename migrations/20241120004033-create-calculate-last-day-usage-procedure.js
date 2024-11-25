'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE PROCEDURE calculate_last_day_usage()
        LANGUAGE plpgsql
        AS $$
        BEGIN
        INSERT INTO public.usages (id, user_id, delta, period, type, created_at, updated_at)
        SELECT
            uuid_generate_v4() AS id,
            u.uuid::uuid AS user_id,
            SUM(
                CASE 
                    WHEN f.status = 'DELETED' AND date_trunc('day', f.created_at) = date_trunc('day', f.updated_at) THEN 0
                    WHEN f.status = 'DELETED' THEN -f.size
                    ELSE f.size
                END
            ) AS delta,
            CURRENT_DATE - INTERVAL '1 day' AS period,
            'monthly' AS type,
            NOW() AS created_at,
            NOW() AS updated_at
        FROM
            files f
        JOIN users u ON u.id = f.user_id
        LEFT JOIN (
            SELECT user_id, MAX(period) AS last_period
            FROM public.usages
            GROUP BY user_id
        ) mru
        ON u.uuid::uuid = mru.user_id::uuid
        WHERE
            (mru.last_period IS NOT NULL AND mru.last_period != CURRENT_DATE - INTERVAL '1 day')
            AND (
                (f.status != 'DELETED' AND f.created_at BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE - INTERVAL '1 millisecond')
                OR
                (f.status = 'DELETED' AND f.updated_at BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE - INTERVAL '1 millisecond')
                OR
                (f.status != 'DELETED' AND f.modification_time BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE - INTERVAL '1 millisecond')
            )
        GROUP BY
            u.uuid;
        END;
        $$;
  `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP PROCEDURE IF EXISTS calculate_last_day_usage;
    `);
  },
};
