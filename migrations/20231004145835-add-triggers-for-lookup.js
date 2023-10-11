'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * INSERT TRIGGERS
     */
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION insert_file_to_look_up_table()
      RETURNS TRIGGER AS $$
      DECLARE
        user_record users%ROWTYPE;
      BEGIN
        -- Retrieve the user's information
        SELECT * INTO user_record FROM users WHERE id = NEW.user_id;
    
        -- Insert a new row into the lookup table
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
        -- Retrieve the user's information
        SELECT * INTO user_record FROM users WHERE id = NEW.user_id;
    
        -- Insert a new row into the lookup table
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

    /**
     * UPDATE TRIGGERS
     */
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_file_in_look_up_table()
      RETURNS TRIGGER AS $$
      DECLARE
        user_record users%ROWTYPE;
      BEGIN
        SELECT * INTO user_record FROM users WHERE id = NEW.user_id;
        -- If the name has been changed, update the lookup table
        IF NEW.status = 'EXISTS' AND OLD.plain_name != NEW.plain_name THEN
          UPDATE look_up
          SET 
            name = NEW.plain_name,
            tokenized_name = to_tsvector(NEW.plain_name)
          WHERE 
            item_type = 'file' 
            AND item_id = NEW.uuid 
            AND user_id = user_record.uuid;
        -- If the file status changes to deleted / trashed
        ELSIF OLD.status = 'EXISTS' AND NEW.status != 'EXISTS' THEN
          -- Remove the lookup entry
          DELETE FROM look_up
          WHERE
            item_type = 'file' 
            AND item_id = NEW.uuid 
            AND user_id = user_record.uuid;
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
        -- If the name has been changed, update the lookup table
        IF NEW.deleted = false AND NEW.removed = false AND OLD.plain_name != NEW.plain_name THEN
          UPDATE look_up
          SET 
            name = NEW.plain_name,
            tokenized_name = to_tsvector(NEW.plain_name)
          WHERE 
            item_type = 'folder' 
            AND item_id = NEW.uuid 
            AND user_id = user_record.uuid;
        -- If the file status changes to deleted / trashed
        ELSIF OLD.deleted = false AND NEW.removed = false AND (NEW.deleted = true OR NEW.removed = true) THEN
          -- Remove the lookup entry
          DELETE FROM look_up
          WHERE
            item_type = 'folder' 
            AND item_id = NEW.uuid 
            AND user_id = user_record.uuid;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE TRIGGER update_look_up_table_after_folder_updated
      AFTER UPDATE ON folders
      FOR EACH ROW
      EXECUTE FUNCTION update_folder_in_look_up_table();
    `);

    /**
     * DELETE TRIGGERS
     */
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION delete_file_from_look_up_table()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Delete the lookup entry
        DELETE FROM look_up
        WHERE
          item_type = 'file' 
          AND item_id = OLD.uuid 
          AND user_id = OLD.user_id;
    
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
        -- Delete the lookup entry
        DELETE FROM look_up
        WHERE
          item_type = 'folder' 
          AND item_id = OLD.uuid 
          AND user_id = OLD.user_id;
    
        RETURN OLD;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE TRIGGER delete_folder_from_look_up_table_after_folder_deleted
      AFTER DELETE ON folders
      FOR EACH ROW
      EXECUTE FUNCTION delete_folder_from_look_up_table();
    `);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.sequelize.query(
      'drop trigger delete_folder_from_look_up_table_after_folder_deleted on folders;',
    );
    await queryInterface.sequelize.query(
      'drop trigger delete_file_from_look_up_table_after_file_deleted on files;',
    );
    await queryInterface.sequelize.query(
      'drop trigger update_look_up_table_after_folder_updated on folders;',
    );
    await queryInterface.sequelize.query(
      'drop trigger update_look_up_table_after_file_updated on files;',
    );
    await queryInterface.sequelize.query(
      'drop trigger insert_folder_to_look_up_table_after_folder_created on folders;',
    );
    await queryInterface.sequelize.query(
      'drop trigger insert_file_to_look_up_table_after_file_created on files;',
    );
  },
};
