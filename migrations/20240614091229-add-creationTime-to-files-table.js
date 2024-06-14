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
      UPDATE files
      SET "creation_time" = created_at,
          "created_at" = CASE
              WHEN created_at > NOW() THEN NOW()
              ELSE created_at
          END;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
