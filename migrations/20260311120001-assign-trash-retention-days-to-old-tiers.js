'use strict';

const { v4 } = require('uuid');

const LIMIT_LABEL = 'trash-retention-days';

const TIER_CONFIGS = [
  { tierLabel: 'free_individual', retentionDays: '2' },
  { tierLabel: '200gb_individual', retentionDays: '2' },
  { tierLabel: '2tb_individual', retentionDays: '2' },
  { tierLabel: '5tb_individual', retentionDays: '2' },
  { tierLabel: '10tb_individual', retentionDays: '2' },
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

      const [limits] = await queryInterface.sequelize.query(
        `SELECT id, value FROM limits WHERE label = :limitLabel AND value = '2'`,
        { replacements: { limitLabel: LIMIT_LABEL }, transaction },
      );

      if (limits.length === 0) {
        throw new Error(
          `No limits found for label "${LIMIT_LABEL}" with value "2"`,
        );
      }

      const tierByLabel = Object.fromEntries(tiers.map((t) => [t.label, t]));
      const limitByValue = Object.fromEntries(limits.map((l) => [l.value, l]));

      const tierLimitRelations = [];

      for (const { tierLabel, retentionDays } of TIER_CONFIGS) {
        const tier = tierByLabel[tierLabel];
        const limit = limitByValue[retentionDays];

        if (!tier) {
          console.warn(`Tier not found, skipping: ${tierLabel}`);
          continue;
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
        `SELECT id FROM limits WHERE label = :limitLabel AND value = '2'`,
        { replacements: { limitLabel: LIMIT_LABEL }, transaction },
      );

      const limitIds = limits.map((l) => l.id);

      if (limitIds.length > 0) {
        const tierLabels = TIER_CONFIGS.map((c) => c.tierLabel);

        const [tiers] = await queryInterface.sequelize.query(
          `SELECT id FROM tiers WHERE label IN (:tierLabels)`,
          { replacements: { tierLabels }, transaction },
        );

        const tierIds = tiers.map((t) => t.id);

        if (tierIds.length > 0) {
          await queryInterface.sequelize.query(
            `DELETE FROM tiers_limits WHERE limit_id IN (:limitIds) AND tier_id IN (:tierIds)`,
            { replacements: { limitIds, tierIds }, transaction },
          );
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
