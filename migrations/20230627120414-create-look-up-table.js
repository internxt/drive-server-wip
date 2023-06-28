'use strict';

const fuzzySearchTableName = 'look_up';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(fuzzySearchTableName, {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fileId: {
        type: Sequelize.STRING(36),
        allowNull: true,
        references: { model: 'files', key: 'uuid' },
      },
      folderId: {
        type: Sequelize.STRING(36),
        allowNull: true,
        references: { model: 'folders', key: 'uuid' },
      },
      user_uuid: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'users', key: 'uuid' },
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.sequelize.query('create extension pg_trgm');
  },

  async down(queryInterface) {
    await queryInterface.dropTable(fuzzySearchTableName);

    await queryInterface.sequelize.query('drop extension pg_trgm');
  },
};
