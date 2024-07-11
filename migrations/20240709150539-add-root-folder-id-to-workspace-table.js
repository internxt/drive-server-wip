'use strict';

const tableName = 'workspaces';
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
