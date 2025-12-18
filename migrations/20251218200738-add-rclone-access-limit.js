'use strict';

const { v4 } = require('uuid');

const LIMIT_LABEL = 'rclone-access';
const FREE_INDIVIDUAL_TIER_LABEL = 'free_individual';
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
      const disabledLimitId = v4();
      const enabledLimitId = v4();

      await queryInterface.bulkInsert(
        'limits',
        [
          {
            id: disabledLimitId,
            label: LIMIT_LABEL,
            name: 'Rclone access disabled',
            type: 'boolean',
            value: 'false',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: enabledLimitId,
            label: LIMIT_LABEL,
            name: 'Rclone access enabled',
            type: 'boolean',
            value: 'true',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        { transaction },
      );

      // Get all tiers
      const [tiers] = await queryInterface.sequelize.query(
        `SELECT id, label FROM tiers`,
        { transaction },
      );

      if (tiers.length === 0) {
        throw new Error('No tiers found in database');
      }

      // Assign rclone access based on tier type
      // Disabled for: free_individual and legacy tiers (200gb, 2tb, 5tb, 10tb)
      // Enabled for: all current paid plans (essential, premium, ultimate, business, lifetime)
      const tierLimitRelations = tiers.map((tier) => {
        const isFree = tier.label === FREE_INDIVIDUAL_TIER_LABEL;
        const isLegacy = LEGACY_TIER_LABELS.includes(tier.label);

        return {
          id: v4(),
          tier_id: tier.id,
          limit_id: isFree || isLegacy ? disabledLimitId : enabledLimitId,
          created_at: new Date(),
          updated_at: new Date(),
        };
      });

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
      // Delete tier-limit relationships for rclone-access
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

      // Delete the rclone-access limits
      await queryInterface.sequelize.query(
        `DELETE FROM limits WHERE label = :limitLabel`,
        { replacements: { limitLabel: LIMIT_LABEL }, transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
