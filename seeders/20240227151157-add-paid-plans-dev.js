'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const plans = [
      { name: '200gb_individual', planId: 'prod_NXNUMFRQaiKaIf' },
      { name: '2tb_individual', planId: 'prod_NXNX7KNAAf5mZZ' },
      { name: '2tb_individual', planId: 'prod_NXNYonsdtj7yvn' },
      { name: '5tb_individual', planId: 'prod_NXNaYLBRNJDvOs' },
      { name: '10tb_individual', planId: 'prod_NXNb9cOS28ubg5' },
    ];

    for (let plan of plans) {
      const planAlreadyMapped = await queryInterface.sequelize.query(
        `SELECT id FROM paid_plans WHERE plan_id = '${plan.planId}' LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT },
      );

      if (planAlreadyMapped.length > 0) {
        continue;
      }

      const tiers = await queryInterface.sequelize.query(
        `SELECT id FROM tiers WHERE label = '${plan.name}' LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT },
      );

      if (tiers.length > 0) {
        const tierId = tiers[0].id;

        await queryInterface.sequelize.query(
          `INSERT INTO paid_plans (plan_id, tier_id, description, created_at, updated_at) 
               VALUES ('${plan.planId}', '${tierId}', '${plan.name}' ,NOW(), NOW())`,
        );
      }
    }
  },

  async down(queryInterface) {
    const planIds = [
      'prod_NXNUMFRQaiKaIf',
      'prod_NXNX7KNAAf5mZZ',
      'prod_NXNYonsdtj7yvn',
      'prod_NXNaYLBRNJDvOs',
      'prod_NXNb9cOS28ubg5',
    ];

    for (let planId of planIds) {
      await queryInterface.sequelize.query(
        `DELETE FROM paid_plans WHERE plan_id = '${planId}'`,
      );
    }
  },
};
