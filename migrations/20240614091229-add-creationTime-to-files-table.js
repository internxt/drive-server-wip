'use strict';

const tableName = 'files';
const newColumn = 'creation_time';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.DATE,
      defaultValue: Sequelize.fn('NOW'),
      allowNull: false,
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE files RENAME COLUMN creation_time TO creation_time_temp;
      ALTER TABLE files RENAME COLUMN created_at TO creation_time;
      ALTER TABLE files RENAME COLUMN creation_time_temp TO created_at;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
