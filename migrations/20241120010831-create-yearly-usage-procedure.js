'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
 CREATE OR REPLACE PROCEDURE generate_yearly_usage()
    LANGUAGE plpgsql
    AS $$
    BEGIN
        WITH monthly_rows AS (
            SELECT
                user_id,
                SUM(delta) AS delta,
                date_trunc('year', CURRENT_DATE) - INTERVAL '1 year' AS period
            FROM
                public.usages
            WHERE
                period >= date_trunc('year', CURRENT_DATE) - INTERVAL '1 year'
                AND period < date_trunc('year', CURRENT_DATE)
                AND type IN ('monthly', 'daily')
            GROUP BY
                user_id
        )
        INSERT INTO
            public.usages (
                id,
                user_id,
                delta,
                period,
                type,
                created_at,
                updated_at
            )
        SELECT
            uuid_generate_v4(),
            user_id,
            delta,
            period,
            'yearly' AS type,
            NOW() AS created_at,
            NOW() AS updated_at
        FROM
            monthly_rows;
        DELETE FROM public.usages
        WHERE
            period >= date_trunc('year', CURRENT_DATE) - INTERVAL '1 year'
            AND period < date_trunc('year', CURRENT_DATE)
            AND type IN ('monthly', 'daily');
    END;
    $$;
  `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP PROCEDURE IF EXISTS generate_yearly_usage;
    `);
  },
};
