'use strict';

const tableName = 'users';
const newColumn = 'tier_id';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.UUID,
      references: { model: 'tiers', key: 'id' },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
