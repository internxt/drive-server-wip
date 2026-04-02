'use strict';

module.exports = {
  async up(queryInterface) {
    // Drop triggers on files
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS insert_file_to_look_up_table_after_file_created ON files;',
    );
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS update_look_up_table_after_file_updated ON files;',
    );
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS delete_file_from_look_up_table_after_file_deleted ON files;',
    );

    // Drop triggers on folders
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS insert_folder_to_look_up_table_after_folder_created ON folders;',
    );
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS update_look_up_table_after_folder_updated ON folders;',
    );
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS delete_folder_from_look_up_table_after_folder_deleted ON folders;',
    );

    // Drop trigger functions
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS insert_file_to_look_up_table();',
    );
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS update_file_in_look_up_table();',
    );
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS delete_file_from_look_up_table();',
    );
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS insert_folder_to_look_up_table();',
    );
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS update_folder_in_look_up_table();',
    );
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS delete_folder_from_look_up_table();',
    );

    await queryInterface.dropTable('look_up');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('look_up', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tokenized_name: {
        type: Sequelize.DataTypes.TSVECTOR,
        allowNull: false,
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      item_type: {
        type: Sequelize.STRING(36),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'users', key: 'uuid' },
        onDelete: 'CASCADE',
      },
    });

    await queryInterface.addIndex('look_up', {
      fields: ['user_id'],
      name: 'user_uuid_look_up_index',
    });

    await queryInterface.addIndex('look_up', {
      fields: ['item_id'],
      name: 'item_id_look_up_index',
    });

    // Recreate trigger functions and triggers
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION insert_file_to_look_up_table()
      RETURNS TRIGGER AS $$
      DECLARE
        user_record users%ROWTYPE;
      BEGIN
        SELECT * INTO user_record FROM users WHERE id = NEW.user_id;
        INSERT INTO look_up (id, name, tokenized_name, item_id, item_type, user_id)
        VALUES (uuid_generate_v4(), NEW.plain_name, to_tsvector(NEW.plain_name), NEW.uuid, 'file', user_record.uuid);
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE TRIGGER insert_file_to_look_up_table_after_file_created
      AFTER INSERT ON files
      FOR EACH ROW
      WHEN (NEW.status = 'EXISTS')
      EXECUTE FUNCTION insert_file_to_look_up_table();
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION insert_folder_to_look_up_table()
      RETURNS TRIGGER AS $$
      DECLARE
        user_record users%ROWTYPE;
      BEGIN
        SELECT * INTO user_record FROM users WHERE id = NEW.user_id;
        INSERT INTO look_up (id, name, tokenized_name, item_id, item_type, user_id)
        VALUES (uuid_generate_v4(), NEW.plain_name, to_tsvector(NEW.plain_name), NEW.uuid, 'folder', user_record.uuid);
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE TRIGGER insert_folder_to_look_up_table_after_folder_created
      AFTER INSERT ON folders
      FOR EACH ROW
      WHEN (NEW.deleted = false and new.removed = false and new.plain_name is not null and new.plain_name != '')
      EXECUTE FUNCTION insert_folder_to_look_up_table();
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_file_in_look_up_table()
      RETURNS TRIGGER AS $$
      DECLARE
        user_record users%ROWTYPE;
      BEGIN
        SELECT * INTO user_record FROM users WHERE id = NEW.user_id;
        IF NEW.status = 'EXISTS' AND OLD.plain_name != NEW.plain_name THEN
          UPDATE look_up
          SET name = NEW.plain_name, tokenized_name = to_tsvector(NEW.plain_name)
          WHERE item_type = 'file' AND item_id = NEW.uuid AND user_id = user_record.uuid;
        ELSIF NEW.status = 'EXISTS' AND old.status != 'EXISTS' THEN
          INSERT INTO look_up (id, name, tokenized_name, item_id, item_type, user_id)
          VALUES (uuid_generate_v4(), NEW.plain_name, to_tsvector(NEW.plain_name), NEW.uuid, 'file', user_record.uuid);
        ELSIF OLD.status = 'EXISTS' AND NEW.status != 'EXISTS' THEN
          DELETE FROM look_up WHERE item_type = 'file' AND item_id = NEW.uuid AND user_id = user_record.uuid;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE TRIGGER update_look_up_table_after_file_updated
      AFTER UPDATE ON files
      FOR EACH ROW
      EXECUTE FUNCTION update_file_in_look_up_table();
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_folder_in_look_up_table()
      RETURNS TRIGGER AS $$
      DECLARE
        user_record users%ROWTYPE;
      BEGIN
        SELECT * INTO user_record FROM users WHERE id = NEW.user_id;
        IF NEW.deleted = false AND NEW.removed = false AND OLD.plain_name != NEW.plain_name THEN
          UPDATE look_up
          SET name = NEW.plain_name, tokenized_name = to_tsvector(NEW.plain_name)
          WHERE item_type = 'folder' AND item_id = NEW.uuid AND user_id = user_record.uuid;
        ELSIF NEW.deleted = false and NEW.removed = false AND (old.deleted = true or old.removed = true) THEN
          INSERT INTO look_up (id, name, tokenized_name, item_id, item_type, user_id)
          VALUES (uuid_generate_v4(), NEW.plain_name, to_tsvector(NEW.plain_name), NEW.uuid, 'folder', user_record.uuid);
        ELSIF (OLD.deleted = false OR OLD.removed = false) AND (NEW.deleted = true OR NEW.removed = true) THEN
          DELETE FROM look_up WHERE item_type = 'folder' AND item_id = NEW.uuid AND user_id = user_record.uuid;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE TRIGGER update_look_up_table_after_folder_updated
      AFTER UPDATE ON folders
      FOR EACH ROW
      EXECUTE FUNCTION update_folder_in_look_up_table();
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION delete_file_from_look_up_table()
      RETURNS TRIGGER AS $$
      BEGIN
        DELETE FROM look_up WHERE item_type = 'file' AND item_id = OLD.uuid;
        RETURN OLD;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE TRIGGER delete_file_from_look_up_table_after_file_deleted
      AFTER DELETE ON files
      FOR EACH ROW
      EXECUTE FUNCTION delete_file_from_look_up_table();
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION delete_folder_from_look_up_table()
      RETURNS TRIGGER AS $$
      BEGIN
        DELETE FROM look_up WHERE item_type = 'folder' AND item_id = OLD.uuid;
        RETURN OLD;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE TRIGGER delete_folder_from_look_up_table_after_folder_deleted
      AFTER DELETE ON folders
      FOR EACH ROW
      EXECUTE FUNCTION delete_folder_from_look_up_table();
    `);
  },
};
