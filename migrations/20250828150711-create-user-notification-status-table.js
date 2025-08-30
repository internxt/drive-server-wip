'use strict';

const tableName = 'user_notification_status';
const uniqueConstraintName =
  'user_notification_status_user_notification_unique';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      user_id: {
        // UUID in the users table is VARCHAR(36)
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'uuid',
        },
        onDelete: 'CASCADE',
      },
      notification_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'notifications',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      delivered_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addConstraint(tableName, {
      fields: ['user_id', 'notification_id'],
      type: 'unique',
      name: uniqueConstraintName,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(tableName, uniqueConstraintName);
    await queryInterface.dropTable(tableName);
  },
};
