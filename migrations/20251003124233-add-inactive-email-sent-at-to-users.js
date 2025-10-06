'use strict';

const tableName = 'users';
const columnName = 'inactive_email_sent_at';
const indexName = 'users_inactive_email_query_idx';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, columnName, {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'Timestamp del último email de inactividad enviado al usuario',
    });

    await queryInterface.addIndex(tableName, [
      'tier_id',
      'email_verified',
      'updated_at',
      columnName,
    ], {
      name: indexName,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(tableName, indexName);
    await queryInterface.removeColumn(tableName, columnName);
  },
};
