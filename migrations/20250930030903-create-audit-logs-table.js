'use strict';

const tableName = 'audit_logs';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      entity_type: {
        type: Sequelize.ENUM('user', 'workspace'),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      performer_type: {
        type: Sequelize.ENUM('user', 'gateway', 'system'),
        allowNull: false,
      },
      performer_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex(tableName, ['entity_id']);
    await queryInterface.addIndex(tableName, ['performer_type']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  },
};
