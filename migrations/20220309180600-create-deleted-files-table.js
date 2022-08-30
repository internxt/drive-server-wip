module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      // eslint-disable-next-line max-len
      'create table if not exists deleted_files (file_id varchar(24),user_id integer, folder_id integer, bucket varchar(24));',
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('drop table deleted_files;');
  },
};
