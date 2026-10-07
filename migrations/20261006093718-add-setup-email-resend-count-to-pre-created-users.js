'use strict';

const tableName = 'pre_created_users';
const resendCountColumn = 'setup_email_resend_count';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, resendCountColumn, {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, resendCountColumn);
  },
};
