'use strict';

const CLI_LIMIT_LABEL = 'cli-access';
const LEGACY_TIER_LABELS = [
  '200gb_individual',
  '2tb_individual',
  '5tb_individual',
  '10tb_individual',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Find CLI access limits
      const [limits] = await queryInterface.sequelize.query(
        `SELECT id, value FROM limits WHERE label = :limitLabel`,
        { replacements: { limitLabel: CLI_LIMIT_LABEL }, transaction },
      );

      if (limits.length === 0) {
        throw new Error('CLI access limits not found in database');
      }

      const disabledLimitId = limits.find((l) => l.value === 'false')?.id;
      const enabledLimitId = limits.find((l) => l.value === 'true')?.id;

      if (!disabledLimitId || !enabledLimitId) {
        throw new Error('CLI access enabled or disabled limit not found');
      }

      // Find legacy tier IDs
      const [legacyTiers] = await queryInterface.sequelize.query(
        `SELECT id, label FROM tiers WHERE label IN (:labels)`,
        {
          replacements: { labels: LEGACY_TIER_LABELS },
          transaction,
        },
      );

      if (legacyTiers.length === 0) {
        console.log('No legacy tiers found, skipping CLI access restriction');
        await transaction.commit();
        return;
      }

      const legacyTierIds = legacyTiers.map((t) => t.id);

      console.log(
        `Restricting CLI access for ${legacyTiers.length} legacy tiers: ${legacyTiers.map((t) => t.label).join(', ')}`,
      );

      // Update tiers_limits: change from enabled to disabled for legacy tiers
      await queryInterface.sequelize.query(
        `UPDATE tiers_limits
         SET limit_id = :disabledLimitId, updated_at = NOW()
         WHERE tier_id IN (:tierIds)
           AND limit_id = :enabledLimitId`,
        {
          replacements: {
            disabledLimitId,
            enabledLimitId,
            tierIds: legacyTierIds,
          },
          transaction,
        },
      );

      await transaction.commit();

      console.log('Successfully restricted CLI access for legacy tiers');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [limits] = await queryInterface.sequelize.query(
        `SELECT id, value FROM limits WHERE label = :limitLabel`,
        { replacements: { limitLabel: CLI_LIMIT_LABEL }, transaction },
      );

      const disabledLimitId = limits.find((l) => l.value === 'false')?.id;
      const enabledLimitId = limits.find((l) => l.value === 'true')?.id;

      if (!disabledLimitId || !enabledLimitId) {
        throw new Error('CLI access limits not found');
      }

      // Find legacy tier IDs
      const [legacyTiers] = await queryInterface.sequelize.query(
        `SELECT id FROM tiers WHERE label IN (:labels)`,
        {
          replacements: { labels: LEGACY_TIER_LABELS },
          transaction,
        },
      );

      if (legacyTiers.length === 0) {
        await transaction.commit();
        return;
      }

      const legacyTierIds = legacyTiers.map((t) => t.id);

      // Re-enable CLI access for legacy tiers
      await queryInterface.sequelize.query(
        `UPDATE tiers_limits
         SET limit_id = :enabledLimitId, updated_at = NOW()
         WHERE tier_id IN (:tierIds)
           AND limit_id = :disabledLimitId`,
        {
          replacements: {
            disabledLimitId,
            enabledLimitId,
            tierIds: legacyTierIds,
          },
          transaction,
        },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
