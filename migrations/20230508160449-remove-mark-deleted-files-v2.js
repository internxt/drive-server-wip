module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'DROP TRIGGER mark_deleted_files_on_delete_v2 on folders;',
    );
    await queryInterface.sequelize.query('DROP FUNCTION mark_deleted_files_v2;');
  },

  down: async (queryInterface) => { },
};
