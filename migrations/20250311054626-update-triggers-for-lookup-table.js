'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION delete_file_from_look_up_table()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Delete the lookup entry
        DELETE FROM look_up
        WHERE
          item_type = 'file' 
          AND item_id = OLD.uuid;

        RETURN OLD;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE OR REPLACE TRIGGER delete_file_from_look_up_table_after_file_deleted
      AFTER DELETE ON files
      FOR EACH ROW
      EXECUTE FUNCTION delete_file_from_look_up_table();

      CREATE OR REPLACE FUNCTION delete_folder_from_look_up_table()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Delete the lookup entry
        DELETE FROM look_up
        WHERE
          item_type = 'folder' 
          AND item_id = OLD.uuid;

        RETURN OLD;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE OR REPLACE TRIGGER delete_folder_from_look_up_table_after_folder_deleted
      AFTER DELETE ON folders
      FOR EACH ROW
      EXECUTE FUNCTION delete_folder_from_look_up_table();
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION delete_file_from_look_up_table()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Delete the lookup entry
        DELETE FROM look_up
        WHERE
          item_type = 'file' 
          AND item_id = OLD.uuid;
    
        RETURN OLD;
      END;
      $$ LANGUAGE 'plpgsql';
    
      CREATE OR REPLACE TRIGGER delete_file_from_look_up_table_after_file_deleted
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
          AND item_id = OLD.uuid;
    
        RETURN OLD;
      END;
      $$ LANGUAGE 'plpgsql';

      CREATE OR REPLACE TRIGGER delete_folder_from_look_up_table_after_folder_deleted
      AFTER DELETE ON folders
      FOR EACH ROW
      EXECUTE FUNCTION delete_folder_from_look_up_table();
    `);
  },
};
