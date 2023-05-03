'use strict';

const tableName = 'users_usage';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      user_uuid: {
        // Sequelize.STRING(36) is the same as Sequelize.UUID, 
        // in postgres Sequelize.UUID is a bpchar(36).
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'users', key: 'uuid' },
      },
      drive_usage: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      trash_usage: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  }
};
