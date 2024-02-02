'use strict';

const tableName = 'tiers_limits';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      tier_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tiers', key: 'id' },
      },
      limit_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'limits', key: 'id' },
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  },
};
