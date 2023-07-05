'use strict';

const lookUpTableName = 'look_up';

async function createInsertFileTrigger(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION insert_file_to_look_up_table()
    RETURNS TRIGGER AS $$
    DECLARE
      userUuid varchar(36);
    BEGIN
      SELECT uuid INTO userUuid
      FROM users 
      WHERE id = NEW.user_id;

      INSERT INTO look_up (id, name, tokenized_name, item_id, item_type, user_id)
      VALUES (uuid_generate_v4(), NEW.plain_name, to_tsvector(NEW.plain_name), NEW.uuid, 'FILE', userUuid)
      ON CONFLICT DO NOTHING;

      RETURN NEW;
    END;
    $$ LANGUAGE 'plpgsql';

    CREATE TRIGGER insert_file_to_look_up_table_after_file_inserted
    AFTER INSERT ON files
    FOR EACH ROW
    EXECUTE FUNCTION insert_file_to_look_up_table();
  `);
}

async function createInsertFolderTrigger(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION insert_folder_to_look_up_table()
    RETURNS TRIGGER AS $$
    DECLARE
      userUuid varchar(36);
    BEGIN
      SELECT uuid INTO userUuid
      FROM users 
      WHERE id = NEW.user_id;

      INSERT INTO look_up (id, name, tokenized_name, item_id, item_type, user_id)
      VALUES (uuid_generate_v4(), NEW.plain_name, to_tsvector(NEW.plain_name), NEW.uuid, 'FOLDER', userUuid)
      ON CONFLICT DO NOTHING;

      RETURN NEW;
    END;
    $$ LANGUAGE 'plpgsql';

    CREATE TRIGGER insert_folder_to_look_up_table_after_folder_inserted
    AFTER INSERT ON folders
    FOR EACH ROW
    EXECUTE FUNCTION insert_folder_to_look_up_table();
  `);
}

async function createUpdateFolderTrigger(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION update_folder_to_look_up_table()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE look_up
      SET 
        name = NEW.plain_name,
        tokenized_name = to_tsvector(NEW.plain_name),
      WHERE id = NEW.uuid;

      RETURN NEW;
    END;
    $$ LANGUAGE 'plpgsql';

    CREATE TRIGGER update_to_look_up_table_after_folder_renamed
    AFTER UPDATE ON folders
    FOR EACH ROW
    WHEN (OLD.plain_name IS DISTINCT FROM NEW.plain_name)
    EXECUTE FUNCTION update_folder_to_look_up_table();
  `);
}

async function createUpdateFileTrigger(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION update_file_to_look_up_table()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE look_up
      SET 
        name = NEW.plain_name,
        tokenized_name = to_tsvector(NEW.plain_name),
      WHERE id = NEW.uuid;

      RETURN NEW;
    END;
    $$ LANGUAGE 'plpgsql';

    CREATE TRIGGER update_to_look_up_table_after_file_renamed
    AFTER UPDATE ON files
    FOR EACH ROW
    WHEN (OLD.plain_name IS DISTINCT FROM NEW.plain_name)
    EXECUTE FUNCTION update_file_to_look_up_table();
  `);
}

async function createDeleteFileTrigger(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION delete_file_to_look_up_table()
    RETURNS TRIGGER AS $$
    BEGIN
      DELETE FROM look_up
      WHERE id = NEW.uuid;

      RETURN NEW;
    END;
    $$ LANGUAGE 'plpgsql';

    CREATE TRIGGER delete_to_look_up_table_after_file_deleted
    AFTER UPDATE ON files
    FOR EACH ROW
    WHEN NEW.status = 'TRASHED'
    EXECUTE FUNCTION delete_file_to_look_up_table();
  `);
}

async function createDeleteFolderTrigger(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION delete_folder_to_look_up_table()
    RETURNS TRIGGER AS $$
    BEGIN
      DELETE FROM look_up
      WHERE id = NEW.uuid;

      RETURN NEW;
    END;
    $$ LANGUAGE 'plpgsql';

    CREATE TRIGGER delete_to_look_up_table_after_folder_deleted
    AFTER UPDATE ON folders
    FOR EACH ROW
    WHEN NEW.status = 'TRASHED'
    EXECUTE FUNCTION delete_folder_to_look_up_table();
  `);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize
      .transaction({ autocommit: false })
      .then(async (transaction) => {
        try {
          await queryInterface.createTable(lookUpTableName, {
            id: {
              type: Sequelize.STRING,
              primaryKey: true,
              allowNull: false,
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
              type: Sequelize.STRING(36),
              allowNull: false,
              unique: true,
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

          await queryInterface.sequelize.query('create extension pg_trgm');

          await createInsertFileTrigger(queryInterface);
          await createInsertFolderTrigger(queryInterface);

          await createUpdateFileTrigger(queryInterface);
          await createUpdateFolderTrigger(queryInterface);

          await createDeleteFileTrigger(queryInterface);
          await createDeleteFolderTrigger(queryInterface);

          await transaction.commit();
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('look_up', 'user_uuid_look_up_index');

    await queryInterface.dropTable(lookUpTableName);

    await queryInterface.sequelize.query('drop extension pg_trgm');

    await queryInterface.sequelize.query(`
      DROP TRIGGER insert_file_to_look_up_table_after_file_inserted ON files;
      DROP FUNCTION insert_file_to_look_up_table();

      DROP TRIGGER insert_folder_to_look_up_table_after_folder_inserted ON folders;
      DROP FUNCTION insert_folder_to_look_up_table();
    `);
  },
};
