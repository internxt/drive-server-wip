'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION folder_deleted_trigger()
      RETURNS trigger AS $$
      BEGIN
          IF OLD.removed = false AND NEW.removed = true THEN
              INSERT INTO deleted_folders (folder_id, processed, created_at, updated_at, processed_at)
              VALUES (OLD.uuid, false, NOW(), NOW(), NULL)
              ON CONFLICT (folder_id) DO NOTHING;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION folder_deleted_trigger()
      RETURNS trigger AS $$
      BEGIN
          IF OLD.removed = false AND NEW.removed = true THEN
              INSERT INTO deleted_folders (folder_id, processed, created_at, updated_at, processed_at)
              VALUES (OLD.uuid, false, NOW(), NOW(), NULL);
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  },
};
