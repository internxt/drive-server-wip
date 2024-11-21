'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE PROCEDURE generate_daily_usage()
      LANGUAGE plpgsql
      AS $$
      DECLARE
          last_millisecond_of_yesterday TIMESTAMP; 
      BEGIN
          last_millisecond_of_yesterday := ((CURRENT_DATE - INTERVAL '1 day') + INTERVAL '23 hours 59 minutes 59.999999 seconds')::timestamp;

          INSERT INTO public.usages (id, user_id, delta, period, type, created_at, updated_at)
          SELECT
              uuid_generate_v4() AS new_uuid,
              u.uuid::uuid AS user_id,
              SUM(
                  CASE 
                      /* Files created and deleted on the same day are omitted */
                      WHEN status = 'DELETED' AND date_trunc('day', f.created_at) = date_trunc('day', f.updated_at) THEN 0
                      WHEN f.status = 'DELETED' THEN -f.size
                      ELSE f.size
                  END
              ) AS delta,
              CURRENT_DATE - INTERVAL '1 day' AS period,
              'daily' AS type,
              NOW() AS created_at,
              NOW() AS updated_at
          FROM
              files f
          JOIN
              users u ON u.id = f.user_id
          WHERE
              (
                (f.status != 'DELETED' AND f.created_at BETWEEN CURRENT_DATE - INTERVAL '1 day' AND last_millisecond_of_yesterday)
                OR
                (f.status = 'DELETED' AND f.updated_at BETWEEN CURRENT_DATE - INTERVAL '1 day' AND last_millisecond_of_yesterday)
                OR
                -- Remember to remove/modify this when we index also not deleted files using updated_at. Macos modify the size of the files.
                (f.status != 'DELETED' AND f.modification_time BETWEEN CURRENT_DATE - INTERVAL '1 day' AND last_millisecond_of_yesterday)
              )
          GROUP BY
              u.uuid;
      END;
      $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP PROCEDURE IF EXISTS generate_daily_usage;
    `);
  },
};
