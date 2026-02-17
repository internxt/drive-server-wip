'use strict';

const { v4: uuidv4 } = require('uuid');

const FILE_VERSION_LABELS = {
  ENABLED: 'file-version-enabled',
  MAX_SIZE: 'file-version-max-size',
  RETENTION_DAYS: 'file-version-retention-days',
  MAX_NUMBER: 'file-version-max-number',
};

// Existing records that need to be updated
const PREMIUM_TIER_LABELS = ['premium_individual', 'standard_business'];
const ULTIMATE_TIER_LABELS = ['ultimate_individual', 'pro_business'];

const LIFETIME_TIER_CONFIGS = [
  {
    tierLabel: 'premium_lifetime_individual',
    limits: [
      { label: FILE_VERSION_LABELS.ENABLED, type: 'boolean', value: 'true' },
      {
        label: FILE_VERSION_LABELS.MAX_SIZE,
        type: 'counter',
        value: String(10 * 1024 * 1024),
      },
      {
        label: FILE_VERSION_LABELS.RETENTION_DAYS,
        type: 'counter',
        value: '15',
      },
      { label: FILE_VERSION_LABELS.MAX_NUMBER, type: 'counter', value: '10' },
    ],
  },
  {
    tierLabel: 'ultimate_lifetime_individual',
    limits: [
      { label: FILE_VERSION_LABELS.ENABLED, type: 'boolean', value: 'true' },
      {
        label: FILE_VERSION_LABELS.MAX_SIZE,
        type: 'counter',
        value: String(20 * 1024 * 1024),
      },
      {
        label: FILE_VERSION_LABELS.RETENTION_DAYS,
        type: 'counter',
        value: '30',
      },
      { label: FILE_VERSION_LABELS.MAX_NUMBER, type: 'counter', value: '20' },
    ],
  },
];

async function updateTierLimit(
  queryInterface,
  tierIds,
  limitLabel,
  newValue,
  transaction,
) {
  await queryInterface.sequelize.query(
    `UPDATE limits
     SET value = :newValue, updated_at = NOW()
     FROM tiers_limits tl
     WHERE tl.limit_id = limits.id
       AND tl.tier_id IN (:tierIds)
       AND limits.label = :limitLabel`,
    {
      replacements: { tierIds, limitLabel, newValue },
      transaction,
    },
  );
}

async function getTierIds(queryInterface, labels, transaction) {
  const [tiers] = await queryInterface.sequelize.query(
    `SELECT id, label FROM tiers WHERE label IN (:labels)`,
    { replacements: { labels }, transaction },
  );
  return tiers;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const premiumTiers = await getTierIds(
        queryInterface,
        PREMIUM_TIER_LABELS,
        transaction,
      );
      if (premiumTiers.length > 0) {
        const premiumTierIds = premiumTiers.map((t) => t.id);
        await updateTierLimit(
          queryInterface,
          premiumTierIds,
          FILE_VERSION_LABELS.ENABLED,
          'true',
          transaction,
        );
        console.log(
          `Updated file versioning for: ${premiumTiers.map((t) => t.label).join(', ')}`,
        );
      }

      const ultimateTiers = await getTierIds(
        queryInterface,
        ULTIMATE_TIER_LABELS,
        transaction,
      );
      if (ultimateTiers.length > 0) {
        const ultimateTierIds = ultimateTiers.map((t) => t.id);
        await updateTierLimit(
          queryInterface,
          ultimateTierIds,
          FILE_VERSION_LABELS.ENABLED,
          'true',
          transaction,
        );
        console.log(
          `Updated file versioning for: ${ultimateTiers.map((t) => t.label).join(', ')}`,
        );
      }

      const lifetimeTierLabels = LIFETIME_TIER_CONFIGS.map((c) => c.tierLabel);
      const lifetimeTiers = await getTierIds(
        queryInterface,
        lifetimeTierLabels,
        transaction,
      );

      if (lifetimeTiers.length > 0) {
        const limits = [];
        const tierLimitRelations = [];

        for (const config of LIFETIME_TIER_CONFIGS) {
          const tier = lifetimeTiers.find((t) => t.label === config.tierLabel);
          if (!tier) continue;

          for (const limit of config.limits) {
            const limitId = uuidv4();
            limits.push({
              id: limitId,
              label: limit.label,
              type: limit.type,
              value: limit.value,
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
        }

        if (limits.length > 0) {
          await queryInterface.bulkInsert('limits', limits, { transaction });
          await queryInterface.bulkInsert('tiers_limits', tierLimitRelations, {
            transaction,
          });
          console.log(
            `Added file versioning limits for: ${lifetimeTiers.map((t) => t.label).join(', ')}`,
          );
        }
      }

      await transaction.commit();
      console.log('Successfully enabled file versioning for premium plans');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down() {},
};
