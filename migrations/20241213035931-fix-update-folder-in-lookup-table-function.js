'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
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
        -- If the folder is restored
        ELSIF NEW.deleted = false and NEW.removed = false AND (old.deleted = true or old.removed = true) THEN
          INSERT INTO look_up (id, name, tokenized_name, item_id, item_type, user_id)
          VALUES (uuid_generate_v4(), NEW.plain_name, to_tsvector(NEW.plain_name), NEW.uuid, 'folder', user_record.uuid);
        -- If the file status changes to deleted / trashed
        ELSIF (OLD.deleted = false OR OLD.removed = false) AND (NEW.deleted = true OR NEW.removed = true) THEN
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
    `);
  },

  async down(queryInterface, Sequelize) {},
};
