'use strict';
const { v4 } = require('uuid');

const limitLabel = 'cli-access';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('limits', [
      {
        id: v4(),
        label: limitLabel,
        name: 'CLI access disabled',
        type: 'boolean',
        value: 'false',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: v4(),
        label: limitLabel,
        name: 'CLI access enabled',
        type: 'boolean',
        value: 'true',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DELETE FROM limits WHERE label = :limitLabel`,
      { replacements: { limitLabel } },
    );
  },
};
