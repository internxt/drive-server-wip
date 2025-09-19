'use strict';

const MIGRATION_DATA_ID = {
  TIERS: {
    ESSENTIAL_LIFETIME_INDIVIDUAL: '8a7b6c5d-4e3f-2a1b-9c8d-7e6f5a4b3c2d',
    PREMIUM_LIFETIME_INDIVIDUAL: '9b8c7d6e-5f4a-3b2c-ad9e-8f7a6b5c4d3e',
    ULTIMATE_LIFETIME_INDIVIDUAL: 'ac9d8e7f-6a5b-4c3d-be0f-9a8b7c6d5e4f',
  },
  TIER_LIMIT_RELATIONS: {
    ESSENTIAL_LIFETIME_WEBDAV: 'bd0e9f8a-7b6c-5d4e-cf1a-0b9c8d7e6f5a',
    PREMIUM_LIFETIME_WEBDAV: 'ce1f0a9b-8c7d-6e5f-da2b-1c0d9e8f7a6b',
    ULTIMATE_LIFETIME_WEBDAV: 'df2a1b0c-9d8e-7f6a-eb3c-2d1e0f9a8b7c',
  },
};

module.exports = {
  async up(queryInterface) {
    const tiersData = [
      {
        id: MIGRATION_DATA_ID.TIERS.ESSENTIAL_LIFETIME_INDIVIDUAL,
        label: 'essential_lifetime_individual',
        context: 'Essential Lifetime - 1TB',
      },
      {
        id: MIGRATION_DATA_ID.TIERS.PREMIUM_LIFETIME_INDIVIDUAL,
        label: 'premium_lifetime_individual',
        context: 'Premium Lifetime - 3TB',
      },
      {
        id: MIGRATION_DATA_ID.TIERS.ULTIMATE_LIFETIME_INDIVIDUAL,
        label: 'ultimate_lifetime_individual',
        context: 'Ultimate Lifetime - 5TB',
      },
    ];

    // Find WebDAV limits by label and value
    const [webdavDisabledResults] = await queryInterface.sequelize.query(
      `SELECT id FROM limits WHERE label = 'webdav-access' AND value = 'false' LIMIT 1`,
    );
    const [webdavEnabledResults] = await queryInterface.sequelize.query(
      `SELECT id FROM limits WHERE label = 'webdav-access' AND value = 'true' LIMIT 1`,
    );

    if (
      webdavDisabledResults.length === 0 ||
      webdavEnabledResults.length === 0
    ) {
      throw new Error('WebDAV access limits not found.');
    }

    await queryInterface.bulkInsert(
      'tiers',
      tiersData.map((tier) => ({
        id: tier.id,
        label: tier.label,
        context: tier.context,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );

    const webdavDisabledId = webdavDisabledResults[0].id;
    const webdavEnabledId = webdavEnabledResults[0].id;

    const tierLimitRelations = [
      // Essential and Premium Lifetime: no webdav access
      {
        id: MIGRATION_DATA_ID.TIER_LIMIT_RELATIONS.ESSENTIAL_LIFETIME_WEBDAV,
        tier_id: MIGRATION_DATA_ID.TIERS.ESSENTIAL_LIFETIME_INDIVIDUAL,
        limit_id: webdavDisabledId,
      },
      {
        id: MIGRATION_DATA_ID.TIER_LIMIT_RELATIONS.PREMIUM_LIFETIME_WEBDAV,
        tier_id: MIGRATION_DATA_ID.TIERS.PREMIUM_LIFETIME_INDIVIDUAL,
        limit_id: webdavDisabledId,
      },
      // Ultimate Lifetime: webdav access enabled
      {
        id: MIGRATION_DATA_ID.TIER_LIMIT_RELATIONS.ULTIMATE_LIFETIME_WEBDAV,
        tier_id: MIGRATION_DATA_ID.TIERS.ULTIMATE_LIFETIME_INDIVIDUAL,
        limit_id: webdavEnabledId,
      },
    ];

    await queryInterface.bulkInsert(
      'tiers_limits',
      tierLimitRelations.map((relation) => ({
        id: relation.id,
        tier_id: relation.tier_id,
        limit_id: relation.limit_id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  },

  async down(queryInterface) {
    const tierIds = [
      MIGRATION_DATA_ID.TIERS.ESSENTIAL_LIFETIME_INDIVIDUAL,
      MIGRATION_DATA_ID.TIERS.PREMIUM_LIFETIME_INDIVIDUAL,
      MIGRATION_DATA_ID.TIERS.ULTIMATE_LIFETIME_INDIVIDUAL,
    ];

    await queryInterface.sequelize.query(
      `DELETE FROM tiers_limits WHERE tier_id IN (:tierIds)`,
      { replacements: { tierIds } },
    );

    await queryInterface.sequelize.query(
      `DELETE FROM tiers WHERE id IN (:tierIds)`,
      { replacements: { tierIds } },
    );
  },
};
