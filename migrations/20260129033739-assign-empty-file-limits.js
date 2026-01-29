'use strict';

const { v4 } = require('uuid');

const LIMIT_LABEL = 'max-zero-size-files';

const ENABLED_TIER_LABELS = [
  'essential_individual',
  'premium_individual',
  'ultimate_individual',
  'standard_business',
  'pro_business',
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
        { replacements: { limitLabel: LIMIT_LABEL }, transaction },
      );

      if (limits.length === 0) {
        throw new Error('max-zero-size-files limits not found in database');
      }

      const zeroLimitId = limits.find((l) => l.value === '0')?.id;
      const enabledLimitId = limits.find((l) => l.value === '1000')?.id;

      if (!zeroLimitId || !enabledLimitId) {
        throw new Error('max-zero-size-files limits (0 and 1000) not found');
      }

      const [tiers] = await queryInterface.sequelize.query(
        `SELECT id, label FROM tiers`,
        { transaction },
      );

      if (tiers.length === 0) {
        throw new Error('No tiers found in database');
      }

      const tierLimitRelations = tiers.map((tier) => {
        const isEnabled = ENABLED_TIER_LABELS.includes(tier.label);

        return {
          id: v4(),
          tier_id: tier.id,
          limit_id: isEnabled ? enabledLimitId : zeroLimitId,
          created_at: new Date(),
          updated_at: new Date(),
        };
      });

      console.log(
        `Assigning max-zero-size-files limits for ${tiers.length} tiers`,
      );

      await queryInterface.bulkInsert('tiers_limits', tierLimitRelations, {
        transaction,
      });

      await transaction.commit();

      console.log('Successfully assigned max-zero-size-files limits');
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
