'use strict';

const { v4 } = require('uuid');

const FREE_INDIVIDUAL_TIER_ID = 'f9a0c809-33b3-49b6-b8d3-957d95575bb2';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [limits] = await queryInterface.sequelize.query(
        `SELECT id, label, value FROM limits WHERE label = 'cli-access'`,
        { transaction },
      );

      if (limits.length === 0) {
        throw new Error('CLI access limits not found in database');
      }

      const enabledLimit = limits.find((l) => l.value === 'true');
      const disabledLimit = limits.find((l) => l.value === 'false');

      if (!enabledLimit || !disabledLimit) {
        throw new Error('CLI access enabled or disabled limit not found');
      }

      const [tiers] = await queryInterface.sequelize.query(
        `SELECT id, label FROM tiers`,
        { transaction },
      );

      // All paid tiers should have cli access
      const tierLimitRelations = tiers.map((tier) => {
        const isFreeIndividual = tier.id === FREE_INDIVIDUAL_TIER_ID;
        return {
          id: v4(),
          tier_id: tier.id,
          limit_id: isFreeIndividual ? disabledLimit.id : enabledLimit.id,
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
      const [limits] = await queryInterface.sequelize.query(
        `SELECT id FROM limits WHERE label = 'cli-access'`,
        { transaction },
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
