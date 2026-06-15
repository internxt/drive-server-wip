'use strict';

const { v4 } = require('uuid');

const PHOTOS_ACCESS_LIMIT_LABEL = 'photos-access';

const PHOTOS_ACCESS_ENABLED_TIER_LABELS = [
  'ultimate_individual',
  'ultimate_lifetime_individual',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const disabledLimitId = v4();
      const enabledLimitId = v4();

      await queryInterface.bulkInsert(
        'limits',
        [
          {
            id: disabledLimitId,
            label: PHOTOS_ACCESS_LIMIT_LABEL,
            name: 'Photos access disabled',
            type: 'boolean',
            value: 'false',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: enabledLimitId,
            label: PHOTOS_ACCESS_LIMIT_LABEL,
            name: 'Photos access enabled',
            type: 'boolean',
            value: 'true',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        { transaction },
      );

      const [tiers] = await queryInterface.sequelize.query(
        `SELECT id, label FROM tiers`,
        { transaction },
      );

      // Photos access is disabled by default, enabled only for ultimate tiers
      const tierLimitRelations = tiers.map((tier) => ({
        id: v4(),
        tier_id: tier.id,
        limit_id: PHOTOS_ACCESS_ENABLED_TIER_LABELS.includes(tier.label)
          ? enabledLimitId
          : disabledLimitId,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      await queryInterface.bulkInsert('tiers_limits', tierLimitRelations, {
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [limits] = await queryInterface.sequelize.query(
        `SELECT id FROM limits WHERE label = :limitLabel`,
        {
          replacements: { limitLabel: PHOTOS_ACCESS_LIMIT_LABEL },
          transaction,
        },
      );

      const limitIds = limits.map((l) => l.id);

      if (limitIds.length > 0) {
        await queryInterface.sequelize.query(
          `DELETE FROM tiers_limits WHERE limit_id IN (:limitIds)`,
          { replacements: { limitIds }, transaction },
        );

        await queryInterface.sequelize.query(
          `DELETE FROM limits WHERE id IN (:limitIds)`,
          { replacements: { limitIds }, transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
