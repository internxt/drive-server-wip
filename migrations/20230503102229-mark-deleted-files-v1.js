module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE FUNCTION mark_deleted_files_v1() RETURNS TRIGGER AS $$
      BEGIN
        UPDATE files SET removed = true WHERE files.folder_id = OLD.id;
        RETURN OLD;
      END;
      $$ LANGUAGE 'plpgsql';
    `);
    await queryInterface.sequelize.query(`
      CREATE TRIGGER mark_deleted_files_on_delete_v1 
      BEFORE DELETE on folders
      FOR EACH ROW
      EXECUTE PROCEDURE mark_deleted_files_v1();
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'DROP TRIGGER mark_deleted_files_on_delete_v1 on folders;',
    );
    await queryInterface.sequelize.query('DROP FUNCTION mark_deleted_files_v1;');
  },
};
