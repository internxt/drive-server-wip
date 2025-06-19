'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('thumbnails', 'file_uuid', {
      type: Sequelize.UUID,
      allowNull: true, // Initially nullable to allow population
      references: {
        model: 'files',
        key: 'uuid',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.addIndex('thumbnails', ['file_uuid'], {
      name: 'thumbnails_file_uuid_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('thumbnails', 'thumbnails_file_uuid_idx');

    await queryInterface.removeColumn('thumbnails', 'file_uuid');
  },
};
