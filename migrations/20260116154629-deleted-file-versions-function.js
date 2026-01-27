'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.insert_into_deleted_file_versions()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
          IF OLD.status != 'DELETED' AND NEW.status = 'DELETED'
             AND NEW.network_file_id IS NOT NULL
             AND NEW.size IS NOT NULL
             AND NEW.size > 0 THEN
            IF NOT EXISTS (SELECT 1 FROM deleted_file_versions WHERE file_version_id = NEW.id) THEN
                INSERT INTO deleted_file_versions (
                  file_version_id,
                  network_file_id,
                  size,
                  processed,
                  enqueued,
                  created_at,
                  updated_at
                ) VALUES (
                  NEW.id,
                  NEW.network_file_id,
                  NEW.size,
                  false,
                  false,
                  NOW(),
                  NOW()
                );
            END IF;
          END IF;
          RETURN NEW;
      END;
      $function$
      ;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS public.insert_into_deleted_file_versions();
    `);
  },
};
