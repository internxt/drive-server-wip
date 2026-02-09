'use strict';

const tableName = 'file_versions';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, 'source_last_updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, 'source_last_updated_at');
  },
};
