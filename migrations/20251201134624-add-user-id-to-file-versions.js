'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('file_versions', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addIndex('file_versions', ['user_id', 'status'], {
      name: 'file_versions_user_id_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('file_versions', 'file_versions_user_id_status_idx');
    await queryInterface.removeColumn('file_versions', 'user_id');
  },
};
