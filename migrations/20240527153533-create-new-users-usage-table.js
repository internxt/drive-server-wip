'use strict';

const tableName = 'users_usage';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS ${tableName};`);
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'uuid',
        },
        onUpdate: 'cascade',
        onDelete: 'cascade',
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      usage: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
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
