'use strict';

const { v4: uuidv4 } = require('uuid');

const TRASH_RETENTION_LABEL = 'trash-retention-days';

const TIER_CONFIGS = [
  { tierLabel: 'essential_individual', retentionDays: '7' },
  { tierLabel: 'essential_lifetime_individual', retentionDays: '7' },
  { tierLabel: 'premium_individual', retentionDays: '15' },
  { tierLabel: 'premium_lifetime_individual', retentionDays: '15' },
  { tierLabel: 'ultimate_individual', retentionDays: '30' },
  { tierLabel: 'ultimate_lifetime_individual', retentionDays: '30' },
  { tierLabel: 'standard_business', retentionDays: '15' },
  { tierLabel: 'pro_business', retentionDays: '30' },
];

module.exports = {
  async up(queryInterface) {
    const tierLabels = TIER_CONFIGS.map((c) => c.tierLabel);

    const [tiers] = await queryInterface.sequelize.query(
      `SELECT id, label FROM tiers WHERE label IN (:tierLabels)`,
      { replacements: { tierLabels } },
    );

    const limits = [];
    const tierLimitRelations = [];

    for (const config of TIER_CONFIGS) {
      const tier = tiers.find((t) => t.label === config.tierLabel);
      if (!tier) continue;

      const limitId = uuidv4();

      limits.push({
        id: limitId,
        label: TRASH_RETENTION_LABEL,
        type: 'counter',
        value: config.retentionDays,
        created_at: new Date(),
        updated_at: new Date(),
      });

      tierLimitRelations.push({
        id: uuidv4(),
        limit_id: limitId,
        tier_id: tier.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    await queryInterface.bulkInsert('limits', limits);
    await queryInterface.bulkInsert('tiers_limits', tierLimitRelations);
  },

  async down(queryInterface) {
    const [limits] = await queryInterface.sequelize.query(
      `SELECT id FROM limits WHERE label = :label`,
      { replacements: { label: TRASH_RETENTION_LABEL } },
    );

    const limitIds = limits.map((l) => l.id);

    if (limitIds.length > 0) {
      await queryInterface.sequelize.query(
        `DELETE FROM tiers_limits WHERE limit_id IN (:limitIds)`,
        { replacements: { limitIds } },
      );

      await queryInterface.sequelize.query(
        `DELETE FROM limits WHERE id IN (:limitIds)`,
        { replacements: { limitIds } },
      );
    }
  },
};
