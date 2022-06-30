module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `CREATE TRIGGER if not exists copy_deleted_files_on_delete BEFORE DELETE on folders
			FOR EACH ROW
			BEGIN
			INSERT INTO deleted_files(file_id, user_id, folder_id, bucket) select file_id, user_id, folder_id, bucket from files where files.folder_id = OLD.id;
			END`,
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'drop trigger copy_deleted_files_on_delete;',
    );
  },
};
