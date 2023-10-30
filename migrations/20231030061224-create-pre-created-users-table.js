'use strict';

const tableName = 'pre_created_users';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      password: {
        type: Sequelize.BLOB('medium'),
        allowNull: false,
      },
      mnemonic: {
        type: Sequelize.BLOB('medium'),
      },
      h_key: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      public_key: {
        type: Sequelize.STRING(920),
        allowNull: false,
      },
      private_key: {
        type: Sequelize.STRING(1356),
        allowNull: false,
      },
      revocation_key: {
        type: Sequelize.STRING(476),
        allowNull: false,
      },
      encrypt_version: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      expiration_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable(tableName);
  },
};
