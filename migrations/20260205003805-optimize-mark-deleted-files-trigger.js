module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TRIGGER mark_deleted_files_on_delete_optimized_v3
      BEFORE UPDATE ON folders
      FOR EACH ROW
      WHEN (OLD.removed IS DISTINCT FROM NEW.removed)
      EXECUTE PROCEDURE mark_deleted_files_v3();
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS mark_deleted_files_on_delete_v3 ON folders;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TRIGGER mark_deleted_files_on_delete_v3
      BEFORE UPDATE ON folders
      FOR EACH ROW
      EXECUTE PROCEDURE mark_deleted_files_v3();
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS mark_deleted_files_on_delete_optimized_v3 ON folders;
    `);
  },
};
