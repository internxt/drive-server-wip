'use strict';

const tableName = 'pre_created_users';
const resendCountColumn = 'setup_email_resend_count';
const resendDateColumn = 'setup_email_resend_date';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, resendCountColumn, {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn(tableName, resendDateColumn, {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, resendDateColumn);
    await queryInterface.removeColumn(tableName, resendCountColumn);
  },
};
