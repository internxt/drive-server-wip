'use strict';

const { v4 } = require('uuid');

const LIMIT_LABEL = 'referral-access';

const TIER_LABELS = [
  'free_individual',
  'essential_individual',
  'essential_lifetime_individual',
  'premium_individual',
  'premium_lifetime_individual',
  'ultimate_individual',
  'ultimate_lifetime_individual',
  'standard_business',
  'pro_business',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [tiers] = await queryInterface.sequelize.query(
        `SELECT id, label FROM tiers WHERE label IN (:tierLabels)`,
        {
          replacements: { tierLabels: TIER_LABELS },
          transaction,
        },
      );

      if (tiers.length === 0) {
        throw new Error('No matching tiers found in database');
      }

      const [limits] = await queryInterface.sequelize.query(
        `SELECT id, value FROM limits WHERE label = :limitLabel`,
        { replacements: { limitLabel: LIMIT_LABEL }, transaction },
      );

      if (limits.length === 0) {
        throw new Error(`No limits found for label "${LIMIT_LABEL}"`);
      }

      const enabledLimit = limits.find((l) => l.value === 'true');

      if (!enabledLimit) {
        throw new Error(
          `No enabled limit found for label "${LIMIT_LABEL}" with value "true"`,
        );
      }

      const tierLimitRelations = tiers.map((tier) => ({
        id: v4(),
        tier_id: tier.id,
        limit_id: enabledLimit.id,
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
        { replacements: { limitLabel: LIMIT_LABEL }, transaction },
      );

      const limitIds = limits.map((l) => l.id);

      if (limitIds.length > 0) {
        await queryInterface.sequelize.query(
          `DELETE FROM tiers_limits WHERE limit_id IN (:limitIds)`,
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
