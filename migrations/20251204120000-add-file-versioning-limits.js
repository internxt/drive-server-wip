'use strict';

const { v4: uuidv4 } = require('uuid');

const FILE_VERSION_LABELS = {
  ENABLE: 'file-version-enable',
  MAX_SIZE: 'file-version-max-size',
  RETENTION_DAYS: 'file-version-retention-days',
  MAX_NUMBER: 'file-version-max-number',
};

const TIER_CONFIGS = [
  {
    tierLabel: 'free_individual',
    limits: [
      { label: FILE_VERSION_LABELS.ENABLE, type: 'boolean', value: 'false' },
      { label: FILE_VERSION_LABELS.MAX_SIZE, type: 'counter', value: '0' },
      { label: FILE_VERSION_LABELS.RETENTION_DAYS, type: 'counter', value: '0' },
      { label: FILE_VERSION_LABELS.MAX_NUMBER, type: 'counter', value: '0' },
    ],
  },
  {
    tierLabel: 'essential_individual',
    limits: [
      { label: FILE_VERSION_LABELS.ENABLE, type: 'boolean', value: 'true' },
      { label: FILE_VERSION_LABELS.MAX_SIZE, type: 'counter', value: String(1 * 1024 * 1024) },
      { label: FILE_VERSION_LABELS.RETENTION_DAYS, type: 'counter', value: '10' },
      { label: FILE_VERSION_LABELS.MAX_NUMBER, type: 'counter', value: '1' },
    ],
  },
  {
    tierLabel: 'premium_individual',
    limits: [
      { label: FILE_VERSION_LABELS.ENABLE, type: 'boolean', value: 'true' },
      { label: FILE_VERSION_LABELS.MAX_SIZE, type: 'counter', value: String(10 * 1024 * 1024) },
      { label: FILE_VERSION_LABELS.RETENTION_DAYS, type: 'counter', value: '15' },
      { label: FILE_VERSION_LABELS.MAX_NUMBER, type: 'counter', value: '10' },
    ],
  },
  {
    tierLabel: 'ultimate_individual',
    limits: [
      { label: FILE_VERSION_LABELS.ENABLE, type: 'boolean', value: 'true' },
      { label: FILE_VERSION_LABELS.MAX_SIZE, type: 'counter', value: String(20 * 1024 * 1024) },
      { label: FILE_VERSION_LABELS.RETENTION_DAYS, type: 'counter', value: '30' },
      { label: FILE_VERSION_LABELS.MAX_NUMBER, type: 'counter', value: '20' },
    ],
  },
  {
    tierLabel: 'standard_business',
    limits: [
      { label: FILE_VERSION_LABELS.ENABLE, type: 'boolean', value: 'true' },
      { label: FILE_VERSION_LABELS.MAX_SIZE, type: 'counter', value: String(10 * 1024 * 1024) },
      { label: FILE_VERSION_LABELS.RETENTION_DAYS, type: 'counter', value: '15' },
      { label: FILE_VERSION_LABELS.MAX_NUMBER, type: 'counter', value: '10' },
    ],
  },
  {
    tierLabel: 'pro_business',
    limits: [
      { label: FILE_VERSION_LABELS.ENABLE, type: 'boolean', value: 'true' },
      { label: FILE_VERSION_LABELS.MAX_SIZE, type: 'counter', value: String(20 * 1024 * 1024) },
      { label: FILE_VERSION_LABELS.RETENTION_DAYS, type: 'counter', value: '30' },
      { label: FILE_VERSION_LABELS.MAX_NUMBER, type: 'counter', value: '20' },
    ],
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tierLabels = TIER_CONFIGS.map((config) => config.tierLabel);

    const [tiers] = await queryInterface.sequelize.query(
      `SELECT id, label FROM tiers WHERE label IN (:tierLabels)`,
      { replacements: { tierLabels } },
    );

    const tierLimitRelations = [];

    const limits = TIER_CONFIGS.flatMap((config) => {
      const tier = tiers.find((t) => t.label === config.tierLabel);
      if (!tier) return [];

      return config.limits.map((limit) => {
        const limitId = uuidv4();

        tierLimitRelations.push({
          id: uuidv4(),
          limit_id: limitId,
          tier_id: tier.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        return {
          id: limitId,
          label: limit.label,
          type: limit.type,
          value: limit.value,
          created_at: new Date(),
          updated_at: new Date(),
        };
      });
    });

    await queryInterface.bulkInsert('limits', limits);
    await queryInterface.bulkInsert('tiers_limits', tierLimitRelations);
  },

  async down(queryInterface) {
    const labels = Object.values(FILE_VERSION_LABELS);

    const [limits] = await queryInterface.sequelize.query(
      `SELECT id FROM limits WHERE label IN (:labels)`,
      { replacements: { labels } },
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
