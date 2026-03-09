'use strict';

const { v4 } = require('uuid');

const LIMIT_LABEL = 'trash-retention-days';

const TIER_CONFIGS = [
  { tierLabel: 'essential_individual', retentionDays: '7' },
  { tierLabel: 'essential_lifetime_individual', retentionDays: '7' },
  { tierLabel: 'premium_individual', retentionDays: '15' },
  { tierLabel: 'premium_lifetime_individual', retentionDays: '15' },
  { tierLabel: 'ultimate_individual', retentionDays: '30' },
  { tierLabel: 'ultimate_lifetime_individual', retentionDays: '30' },
  { tierLabel: 'standard_business', retentionDays: '15' },
  { tierLabel: 'pro_business', retentionDays: '30' },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [tiers] = await queryInterface.sequelize.query(
        `SELECT id, label FROM tiers WHERE label IN (:tierLabels)`,
        {
          replacements: { tierLabels: TIER_CONFIGS.map((c) => c.tierLabel) },
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

      const tierByLabel = Object.fromEntries(tiers.map((t) => [t.label, t]));
      const limitByValue = Object.fromEntries(limits.map((l) => [l.value, l]));

      const tierLimitRelations = [];

      for (const { tierLabel, retentionDays } of TIER_CONFIGS) {
        const tier = tierByLabel[tierLabel];
        const limit = limitByValue[retentionDays];

        if (!tier) {
          throw new Error(`Tier not found: ${tierLabel}`);
        }

        if (!limit) {
          throw new Error(
            `Limit not found for label "${LIMIT_LABEL}" with value "${retentionDays}"`,
          );
        }

        tierLimitRelations.push({
          id: v4(),
          tier_id: tier.id,
          limit_id: limit.id,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

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
