'use strict';

const tableName = 'usages';
const indexName = 'usage_user_type_period_index';

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
        type: Sequelize.UUID,
        allowNull: false,
      },
      delta: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      period: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
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

    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY ${indexName} ON ${tableName} (user_id, type, period)`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY ${indexName}`,
    );
    await queryInterface.dropTable(tableName);
  },
};
