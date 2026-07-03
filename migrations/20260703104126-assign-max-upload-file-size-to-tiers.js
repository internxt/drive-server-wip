'use strict';

const { v4 } = require('uuid');

const LIMIT_LABEL = 'max-upload-file-size';
const MB = 1024 * 1024;
const GB = 1024 * MB;

const TIER_CONFIGS = [
  // ===== B2C =====
  { tierLabel: 'free_individual', value: String(100 * MB) },
  // Essential -> 10GB
  { tierLabel: 'essential_individual', value: String(10 * GB) },
  { tierLabel: 'essential_lifetime_individual', value: String(10 * GB) },
  // Stack Social / B2C Legacy
  { tierLabel: '10tb_individual', value: String(10 * GB) },
  { tierLabel: '200gb_individual', value: String(10 * GB) },
  { tierLabel: '2tb_individual', value: String(10 * GB) },
  { tierLabel: '5tb_individual', value: String(10 * GB) },
  // Premium -> 50GB
  { tierLabel: 'premium_individual', value: String(50 * GB) },
  { tierLabel: 'premium_lifetime_individual', value: String(50 * GB) },
  // Ultimate -> 100GB
  { tierLabel: 'ultimate_individual', value: String(100 * GB) },
  { tierLabel: 'ultimate_lifetime_individual', value: String(100 * GB) },

  // ===== B2B =====
  { tierLabel: 'standard_business', value: String(50 * GB) },
  { tierLabel: 'pro_business', value: String(100 * GB) },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [tiers] = await queryInterface.sequelize.query(
        'SELECT id, label FROM tiers WHERE label IN (:tierLabels)',
        {
          replacements: { tierLabels: TIER_CONFIGS.map((c) => c.tierLabel) },
          transaction,
        },
      );

      const [limits] = await queryInterface.sequelize.query(
        'SELECT id, value FROM limits WHERE label = :limitLabel',
        { replacements: { limitLabel: LIMIT_LABEL } },
      );

      if (limits.length === 0) {
        throw new Error(`No limits found for label "${LIMIT_LABEL}"`);
      }

      const tierByLabel = Object.fromEntries(tiers.map((t) => [t.label, t]));
      const limitByValue = Object.fromEntries(limits.map((l) => [l.value, l]));

      const tierLimitRelations = [];

      for (const { tierLabel, value } of TIER_CONFIGS) {
        const tier = tierByLabel[tierLabel];

        if (!tier) {
          console.warn(`Tier not found, skipping: ${tierLabel}`);
          continue;
        }

        const limit = limitByValue[value];

        if (!limit) {
          throw new Error(
            `Limit not found for label "${LIMIT_LABEL}" with value "${value}"`,
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
        'SELECT id FROM limits WHERE label = :limitLabel',
        { replacements: { limitLabel: LIMIT_LABEL }, transaction },
      );

      const limitIds = limits.map((l) => l.id);

      if (limitIds.length > 0) {
        await queryInterface.sequelize.query(
          'DELETE FROM tiers_limits WHERE limit_id IN (:limitIds)',
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
