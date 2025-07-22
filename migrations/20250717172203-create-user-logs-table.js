'use strict';

const tableName = 'audit_logs';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.DataTypes.UUIDV4,
      },
      entity_type: {
        type: Sequelize.ENUM('user', 'workspace'),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
      },
      action: {
        type: Sequelize.ENUM(
          // User actions
          'storage-changed',
          'email-changed',
          'password-changed',
          '2fa-enabled',
          '2fa-disabled',
          'account-reset',
          'account-recovery',
          // Workspace actions
          'workspace-created',
          'workspace-storage-changed',
          'workspace-deleted',
        ),
        allowNull: false,
      },
      performer_type: {
        type: Sequelize.ENUM('user', 'gateway', 'system'),
        allowNull: false,
      },
      performer_id: {
        type: Sequelize.DataTypes.UUID,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.DataTypes.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.DataTypes.NOW,
      },
    });

    await queryInterface.addIndex(tableName, ['entity_id']);
    await queryInterface.addIndex(tableName, ['performer_type']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  },
};
