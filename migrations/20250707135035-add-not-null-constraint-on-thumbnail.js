'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('thumbnails', 'file_uuid', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'files',
        key: 'uuid',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('thumbnails', 'file_uuid', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'files',
        key: 'uuid',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },
};
