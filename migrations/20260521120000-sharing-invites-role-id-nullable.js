'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('sharing_invites', 'role_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'roles',
        key: 'id',
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('sharing_invites', 'role_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id',
      },
    });
  },
};
