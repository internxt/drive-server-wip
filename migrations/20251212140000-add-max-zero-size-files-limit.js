'use strict';

const { v4 } = require('uuid');

const ZERO_SIZE_FILES_LIMIT_LABEL = 'max-zero-size-files';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const limits = [
      {
        id: v4(),
        label: ZERO_SIZE_FILES_LIMIT_LABEL,
        type: 'counter',
        value: '1000',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: v4(),
        label: ZERO_SIZE_FILES_LIMIT_LABEL,
        type: 'counter',
        value: '0',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert('limits', limits);
  },

  async down(queryInterface) {
    const [limits] = await queryInterface.sequelize.query(
      `SELECT id FROM limits WHERE label = :label`,
      { replacements: { label: ZERO_SIZE_FILES_LIMIT_LABEL } },
    );

    const limitIds = limits.map((l) => l.id);

    if (limitIds.length > 0) {
      await queryInterface.sequelize.query(
        `DELETE FROM limits WHERE id IN (:limitIds)`,
        { replacements: { limitIds } },
      );
    }
  },
};
