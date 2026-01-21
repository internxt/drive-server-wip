'use strict';

const CLI_LIMIT_LABEL = 'cli-access';

const CLI_DISABLED_TIER_LABELS = [
  // Legacy tiers
  '200gb_individual',
  '2tb_individual',
  '5tb_individual',
  '10tb_individual',
  // Current tiers (except ultimate_individual and pro_business)
  'essential_individual',
  'premium_individual',
  'standard_business',
  'essential_lifetime_individual',
  'premium_lifetime_individual',
  'ultimate_lifetime_individual',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
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

      const [tiersToDisable] = await queryInterface.sequelize.query(
        `SELECT id, label FROM tiers WHERE label IN (:labels)`,
        {
          replacements: { labels: CLI_DISABLED_TIER_LABELS },
          transaction,
        },
      );

      if (tiersToDisable.length === 0) {
        console.log(
          'No tiers found to restrict, skipping CLI access restriction',
        );
        await transaction.commit();
        return;
      }

      const tierIds = tiersToDisable.map((t) => t.id);

      console.log(
        `Restricting CLI access for ${tiersToDisable.length} tiers: ${tiersToDisable.map((t) => t.label).join(', ')}`,
      );

      await queryInterface.sequelize.query(
        `UPDATE tiers_limits
         SET limit_id = :disabledLimitId, updated_at = NOW()
         WHERE tier_id IN (:tierIds)
           AND limit_id = :enabledLimitId`,
        {
          replacements: {
            disabledLimitId,
            enabledLimitId,
            tierIds,
          },
          transaction,
        },
      );

      await transaction.commit();

      console.log('Successfully restricted CLI access for specified tiers');
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

      const [tiers] = await queryInterface.sequelize.query(
        `SELECT id FROM tiers WHERE label IN (:labels)`,
        {
          replacements: { labels: CLI_DISABLED_TIER_LABELS },
          transaction,
        },
      );

      if (tiers.length === 0) {
        await transaction.commit();
        return;
      }

      const tierIds = tiers.map((t) => t.id);

      await queryInterface.sequelize.query(
        `UPDATE tiers_limits
         SET limit_id = :enabledLimitId, updated_at = NOW()
         WHERE tier_id IN (:tierIds)
           AND limit_id = :disabledLimitId`,
        {
          replacements: {
            disabledLimitId,
            enabledLimitId,
            tierIds,
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
