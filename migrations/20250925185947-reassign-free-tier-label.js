'use strict';

const INCORRECT_FREE_TIER_ID = '3a8f239e-9c4d-494a-9255-de65ab909483';

module.exports = {
  async up(queryInterface) {
    const [results] = await queryInterface.sequelize.query(
      `SELECT id FROM tiers WHERE label = '10gb_individual' LIMIT 1`,
    );

    if (results.length === 0) {
      throw new Error('Tier with label 10gb_individual not found');
    }

    const newTierId = results[0].id;

    // Update tier-limit relationships to point to the correct tier
    await queryInterface.sequelize.query(
      `UPDATE tiers_limits
       SET tier_id = '${newTierId}',
           updated_at = NOW()
       WHERE tier_id = '${INCORRECT_FREE_TIER_ID}'`,
    );

    await queryInterface.sequelize.query(
      `DELETE FROM tiers WHERE id = '${INCORRECT_FREE_TIER_ID}'`,
    );

    // Change the already set by default free tier (10gb_individual) to free_individual
    await queryInterface.sequelize.query(
      `UPDATE tiers
       SET label = 'free_individual',
           context = 'Free - 1GB',
           updated_at = NOW()
       WHERE label = '10gb_individual'`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `INSERT INTO tiers (id, label, context, created_at, updated_at)
       VALUES (
         '${INCORRECT_FREE_TIER_ID}',
         'free_individual',
         'Free - 1GB',
         NOW(),
         NOW()
       )`,
    );

    const [results] = await queryInterface.sequelize.query(
      `SELECT id FROM tiers WHERE label = 'free_individual' AND id != '${INCORRECT_FREE_TIER_ID}' LIMIT 1`,
    );

    if (results.length > 0) {
      const currentTierId = results[0].id;

      await queryInterface.sequelize.query(
        `UPDATE tiers_limits
         SET tier_id = '${INCORRECT_FREE_TIER_ID}',
             updated_at = NOW()
         WHERE tier_id = '${currentTierId}'`,
      );
    }

    await queryInterface.sequelize.query(
      `UPDATE tiers
       SET label = '10gb_individual',
           context = 'Plan 10GB',
           updated_at = NOW()
       WHERE label = 'free_individual' AND id != '${INCORRECT_FREE_TIER_ID}'`,
    );
  },
};
