'use strict';

const tableName = 'folders';
const columName = 'depth';
const indexName = `${tableName}_${columName}_index`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, columName, {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${tableName} (${columName})`,
    );

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION calculate_folder_depth(parentId UUID)
      RETURNS INT AS $$
      DECLARE
          depth INT;
      BEGIN
          depth := 0;

          IF parentId IS NOT NULL THEN
              SELECT f.depth + 1 INTO depth FROM folders f WHERE f.uuid = parentId;
          END IF;

          RETURN depth;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION before_insert_update_folder_depth()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          NEW.depth := calculate_folder_depth(NEW.parent_uuid);
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.parent_uuid IS DISTINCT FROM OLD.parent_uuid THEN
                NEW.depth := calculate_folder_depth(NEW.parent_uuid);
            END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE TRIGGER before_insert_folder_depth
      BEFORE INSERT ON folders
      FOR EACH ROW
      EXECUTE FUNCTION before_insert_update_folder_depth();

      CREATE OR REPLACE TRIGGER before_update_folder_depth
      BEFORE UPDATE ON folders
      FOR EACH ROW
      EXECUTE FUNCTION before_insert_update_folder_depth();
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_child_folders_depth(parentId UUID, parentDepth INT)
      RETURNS VOID AS $$
      DECLARE
          child RECORD;
      BEGIN
          FOR child IN
              SELECT uuid FROM folders WHERE parent_uuid = parentId
          LOOP
              UPDATE folders SET depth = parentDepth + 1 WHERE uuid = child.uuid;

              -- Recursivamente actualizar la profundidad de las carpetas hijas
              PERFORM update_child_folders_depth(child.uuid, parentDepth + 1);
          END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION after_update_folder_depth()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.depth IS DISTINCT FROM OLD.depth THEN
              PERFORM update_child_folders_depth(NEW.uuid, NEW.depth);
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE TRIGGER after_update_folder_depth
      AFTER UPDATE ON folders
      FOR EACH ROW
      EXECUTE FUNCTION after_update_folder_depth();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS after_update_folder_depth on folders;',
    );
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS after_update_folder_depth;',
    );

    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS update_child_folders_depth;',
    );

    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS before_insert_folder_depth on folders;',
    );
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS before_update_folder_depth on folders;',
    );
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS before_insert_update_folder_depth;',
    );

    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS calculate_folder_depth;',
    );

    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`,
    );
    await queryInterface.removeColumn(tableName, columName);
  },
};