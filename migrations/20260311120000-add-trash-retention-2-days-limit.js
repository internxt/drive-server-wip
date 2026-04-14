'use strict';

const limitLabel = 'trash-retention-days';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('limits', [
      {
        id: 'b3e1c2d4-a5f6-4789-bcde-f01234567890',
        label: limitLabel,
        type: 'counter',
        value: '2',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DELETE FROM limits WHERE label = :limitLabel AND value = '2'`,
      { replacements: { limitLabel } },
    );
  },
};
