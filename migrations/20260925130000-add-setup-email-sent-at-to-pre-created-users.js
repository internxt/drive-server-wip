'use strict';

const tableName = 'pre_created_users';
const newColumn = 'setup_email_sent_at';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
