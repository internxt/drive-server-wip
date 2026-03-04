'use strict';

const limitLabel = 'trash-retention-days';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('limits', [
      {
        id: '67c7517b-fe32-4ec9-b856-fe2ceba82e6b',
        label: limitLabel,
        type: 'counter',
        value: '7',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'add1f38b-f646-495c-a7d2-03a57aa71483',
        label: limitLabel,
        type: 'counter',
        value: '15',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'e72db477-588b-4d76-9d15-b87818af6e31',
        label: limitLabel,
        type: 'counter',
        value: '30',
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
