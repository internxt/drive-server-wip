'use strict';

const { v4 } = require('uuid');

const LIMIT_LABEL = 'max-upload-file-size';

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('limits', [
      {
        id: v4(),
        label: LIMIT_LABEL,
        type: 'counter',
        value: String(100 * MB),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: v4(),
        label: LIMIT_LABEL,
        type: 'counter',
        value: String(1 * GB),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: v4(),
        label: LIMIT_LABEL,
        type: 'counter',
        value: String(10 * GB),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: v4(),
        label: LIMIT_LABEL,
        type: 'counter',
        value: String(50 * GB),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: v4(),
        label: LIMIT_LABEL,
        type: 'counter',
        value: String(100 * GB),
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
