module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE FUNCTION mark_deleted_files_v3() RETURNS TRIGGER AS $$
      BEGIN
        IF (OLD.removed = false AND NEW.removed = true) THEN
          UPDATE files SET removed = true, removed_at = NOW() WHERE files.folder_id = OLD.id;
          UPDATE folders SET removed = true, removed_at = NOW() WHERE folders.parent_id = OLD.id; 
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';
    `);
    await queryInterface.sequelize.query(`
      CREATE TRIGGER mark_deleted_files_on_delete_v3
      BEFORE UPDATE on folders
      FOR EACH ROW
      EXECUTE PROCEDURE mark_deleted_files_v3();
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'DROP TRIGGER mark_deleted_files_on_delete_v3 on folders;',
    );
    await queryInterface.sequelize.query('DROP FUNCTION mark_deleted_files_v3;');
  },
};