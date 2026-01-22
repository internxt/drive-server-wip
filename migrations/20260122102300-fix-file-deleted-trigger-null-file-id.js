'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.file_deleted_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
          IF OLD.status != 'DELETED' AND NEW.status = 'DELETED' AND OLD.file_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM deleted_files WHERE file_id = OLD.uuid) THEN
                INSERT INTO deleted_files (file_id, network_file_id, processed, created_at, updated_at, processed_at)
                VALUES (OLD.uuid, OLD.file_id, false, NOW(), NOW(), NULL);
            END IF;
          END IF;
          RETURN NEW;
      END;
      $function$
      ;
    `);
  },

  async down(queryInterface) {
    // Revert to the previous implementation (without checking NEW.file_id).
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.file_deleted_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
          IF OLD.status != 'DELETED' AND NEW.status = 'DELETED' THEN
            IF NOT EXISTS (SELECT 1 FROM deleted_files WHERE file_id = OLD.uuid) THEN
                INSERT INTO deleted_files (file_id, network_file_id, processed, created_at, updated_at, processed_at)
                VALUES (OLD.uuid, OLD.file_id, false, NOW(), NOW(), NULL);
            END IF;
          END IF;
          RETURN NEW;
      END;
      $function$
      ;
    `);
  },
};