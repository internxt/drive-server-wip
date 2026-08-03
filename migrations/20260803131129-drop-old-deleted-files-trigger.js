'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, _Sequelize) {
    await queryInterface.sequelize.query(`
      -- fail fast if the lock cannot be acquired within 5 seconds
      SET lock_timeout = '5s';

      DROP TRIGGER IF EXISTS on_file_deleted ON public.files;
      DROP FUNCTION IF EXISTS public.file_deleted_trigger();
    `);
  },

  async down (queryInterface, _Sequelize) {
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

      CREATE TRIGGER on_file_deleted
        AFTER UPDATE ON public.files
        FOR EACH ROW
        WHEN ((new.status = 'DELETED'::enum_files_status))
        EXECUTE FUNCTION file_deleted_trigger ();
    `);
  }
};
