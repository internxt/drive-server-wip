'use strict';

const { v4 } = require('uuid');

const LIMIT_LABEL = 'referral-access';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('limits', [
      {
        id: v4(),
        label: LIMIT_LABEL,
        type: 'boolean',
        value: 'false',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: v4(),
        label: LIMIT_LABEL,
        type: 'boolean',
        value: 'true',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM limits WHERE label = :limitLabel`,
      { replacements: { limitLabel: LIMIT_LABEL } },
    );
  },
};
