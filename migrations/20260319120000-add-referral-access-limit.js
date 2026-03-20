'use strict';

const { v4 } = require('uuid');

const LIMIT_LABEL = 'referral-access';
const ENABLED_USER_EMAIL = 'demo.user@cello.so';

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
            type: 'boolean',
            value: 'false',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: enabledLimitId,
            label: LIMIT_LABEL,
            type: 'boolean',
            value: 'true',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        { transaction },
      );

      const [tiers] = await queryInterface.sequelize.query(
        `SELECT id FROM tiers`,
        { transaction },
      );

      if (tiers.length === 0) {
        throw new Error('No tiers found in database');
      }

      const tierLimitRelations = tiers.map((tier) => ({
        id: v4(),
        tier_id: tier.id,
        limit_id: disabledLimitId,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      await queryInterface.bulkInsert('tiers_limits', tierLimitRelations, {
        transaction,
      });

      const [users] = await queryInterface.sequelize.query(
        `SELECT uuid FROM users WHERE email = :email`,
        { replacements: { email: ENABLED_USER_EMAIL }, transaction },
      );

      if (users.length > 0) {
        await queryInterface.bulkInsert(
          'user_overridden_limits',
          [
            {
              id: v4(),
              user_id: users[0].uuid,
              limit_id: enabledLimitId,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          { transaction },
        );
      }

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
          `DELETE FROM user_overridden_limits WHERE limit_id IN (:limitIds)`,
          { replacements: { limitIds }, transaction },
        );

        await queryInterface.sequelize.query(
          `DELETE FROM tiers_limits WHERE limit_id IN (:limitIds)`,
          { replacements: { limitIds }, transaction },
        );
      }

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
