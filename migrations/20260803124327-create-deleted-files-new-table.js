'use strict';

const tableName = 'deleted_files_new';
const indexName = 'deleted_files_new_processed_enqueued_index';
const triggerFunctionName = 'file_deleted_new_trigger';
const triggerName = 'on_file_deleted_new';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      file_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      processed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      created_at: {
        type: Sequelize.DATE,
      },
      updated_at: {
        type: Sequelize.DATE,
      },
      processed_at: {
        type: Sequelize.DATE,
      },
      enqueued: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      enqueued_at: {
        type: Sequelize.DATE,
      },
      network_file_id: {
        type: Sequelize.STRING(24),
        allowNull: false,
        defaultValue: '',
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE public.${tableName}
      SET (autovacuum_vacuum_scale_factor = 0.01);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX ${indexName}
        ON public.${tableName} USING btree (enqueued, processed)
        WHERE ((enqueued = false) AND (processed = false));
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.${triggerFunctionName}()
       RETURNS trigger
       LANGUAGE plpgsql
      AS $function$
            BEGIN
                IF OLD.status != 'DELETED' AND NEW.status = 'DELETED' AND OLD.file_id IS NOT NULL THEN
                  IF NOT EXISTS (SELECT 1 FROM ${tableName} WHERE file_id = OLD.uuid) THEN
                      INSERT INTO ${tableName} (file_id, network_file_id, processed, created_at, updated_at, processed_at)
                      VALUES (OLD.uuid, OLD.file_id, false, NOW(), NOW(), NULL);
                  END IF;
                END IF;
                RETURN NEW;
            END;
            $function$
      ;
    `);

    await queryInterface.sequelize.query(`
      CREATE TRIGGER ${triggerName}
          AFTER UPDATE ON public.files
          FOR EACH ROW
          WHEN ((new.status = 'DELETED'::enum_files_status))
          EXECUTE FUNCTION ${triggerFunctionName}();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS ${triggerName} ON public.files;`,
    );
    await queryInterface.sequelize.query(
      `DROP FUNCTION IF EXISTS public.${triggerFunctionName}();`,
    );
    await queryInterface.dropTable(tableName);
  },
};
