'use strict';

const tableName = 'pre_created_users';
const newColumn = 'tier_id';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'tiers', key: 'id' },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
