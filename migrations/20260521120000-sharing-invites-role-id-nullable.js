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
    await queryInterface.changeColumn('sharing_invites', 'encryption_key', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn(
      'sharing_invites',
      'encryption_algorithm',
      {
        type: Sequelize.STRING,
        allowNull: true,
      },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DELETE FROM sharing_invites WHERE type = 'SELF' AND role_id IS NULL`,
    );
    await queryInterface.changeColumn('sharing_invites', 'role_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id',
      },
    });
    await queryInterface.sequelize.query(
      `UPDATE sharing_invites SET encryption_key = '' WHERE encryption_key IS NULL`,
    );
    await queryInterface.changeColumn('sharing_invites', 'encryption_key', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.sequelize.query(
      `UPDATE sharing_invites SET encryption_algorithm = '' WHERE encryption_algorithm IS NULL`,
    );
    await queryInterface.changeColumn(
      'sharing_invites',
      'encryption_algorithm',
      {
        type: Sequelize.STRING,
        allowNull: false,
      },
    );
  },
};
