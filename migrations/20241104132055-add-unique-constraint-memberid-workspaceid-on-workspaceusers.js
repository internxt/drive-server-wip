'use strict';

const tableName = 'workspace_users';
const constraintName = 'workspace_users_member_id_workspace_id_key';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint(tableName, {
      fields: ['member_id', 'workspace_id'],
      type: 'unique',
      name: constraintName,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(tableName, constraintName);
  },
};
