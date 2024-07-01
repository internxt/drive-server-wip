'use strict';

const tableName = 'workspace_users';
const newColumn = 'root_folder_id';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.UUID,
      references: { model: 'folders', key: 'uuid' },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
