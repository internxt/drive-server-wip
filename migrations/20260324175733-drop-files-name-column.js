'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE files DROP COLUMN IF EXISTS name',
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('files', 'name', {
      type: Sequelize.STRING(650),
      allowNull: true,
    });
  },
};
