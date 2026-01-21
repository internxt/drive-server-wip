'use strict';

const CLI_LIMIT_LABEL = 'cli-access';
const TIER_LABEL = 'ultimate_lifetime_individual';

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

      const enabledLimitId = limits.find((l) => l.value === 'true')?.id;
      const disabledLimitId = limits.find((l) => l.value === 'false')?.id;

      if (!enabledLimitId || !disabledLimitId) {
        throw new Error('CLI access enabled or disabled limit not found');
      }

      const [tiers] = await queryInterface.sequelize.query(
        `SELECT id FROM tiers WHERE label = :label`,
        { replacements: { label: TIER_LABEL }, transaction },
      );

      if (tiers.length === 0) {
        console.log(`Tier ${TIER_LABEL} not found, skipping`);
        await transaction.commit();
        return;
      }

      const tierId = tiers[0].id;

      await queryInterface.sequelize.query(
        `UPDATE tiers_limits
         SET limit_id = :enabledLimitId, updated_at = NOW()
         WHERE tier_id = :tierId
           AND limit_id = :disabledLimitId`,
        {
          replacements: { enabledLimitId, disabledLimitId, tierId },
          transaction,
        },
      );

      await transaction.commit();
      console.log(`Successfully granted CLI access to ${TIER_LABEL}`);
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

      const enabledLimitId = limits.find((l) => l.value === 'true')?.id;
      const disabledLimitId = limits.find((l) => l.value === 'false')?.id;

      if (!enabledLimitId || !disabledLimitId) {
        throw new Error('CLI access limits not found');
      }

      const [tiers] = await queryInterface.sequelize.query(
        `SELECT id FROM tiers WHERE label = :label`,
        { replacements: { label: TIER_LABEL }, transaction },
      );

      if (tiers.length === 0) {
        await transaction.commit();
        return;
      }

      const tierId = tiers[0].id;

      await queryInterface.sequelize.query(
        `UPDATE tiers_limits
         SET limit_id = :disabledLimitId, updated_at = NOW()
         WHERE tier_id = :tierId
           AND limit_id = :enabledLimitId`,
        {
          replacements: { enabledLimitId, disabledLimitId, tierId },
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
