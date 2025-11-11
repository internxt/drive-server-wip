'use strict';

const tableName = 'user_overridden_limits';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'users', key: 'uuid' },
        onDelete: 'CASCADE',
      },
      limit_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'limits', key: 'id' },
        onDelete: 'CASCADE',
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

    // Add unique constraint to ensure one limit override per user per limit
    await queryInterface.addConstraint(tableName, {
      fields: ['user_id', 'limit_id'],
      type: 'unique',
      name: 'user_overridden_limits_user_id_limit_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  },
};
