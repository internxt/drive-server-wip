'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tiers = await queryInterface.sequelize.query(
      "SELECT id FROM tiers WHERE label = '10gb_individual' LIMIT 1",
      { type: Sequelize.QueryTypes.SELECT },
    );

    if (tiers.length > 0) {
      const tierId = tiers[0].id;

      await queryInterface.sequelize.query(
        `INSERT INTO paid_plans (plan_id, tier_id, description, created_at, updated_at) 
           VALUES ('free_000000', '${tierId}', 'Free Tier 10gb' ,NOW(), NOW())`,
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DELETE FROM paid_plans WHERE plan_id = 'free_000000'",
    );
  },
};
