'use strict';

const MIGRATION_DATA_ID = {
  TIERS: {
    FREE_INDIVIDUAL: '3a8f239e-9c4d-494a-9255-de65ab909483',
    ESSENTIAL_INDIVIDUAL: '47d76ff1-a6df-4334-a300-b11f50ea6bfd',
    PREMIUM_INDIVIDUAL: '899e07f7-0e8c-427b-9613-dee0c5c705a7',
    ULTIMATE_INDIVIDUAL: '23bd8f2c-ae81-4f18-b18a-55a36e66547d',
    STANDARD_BUSINESS: 'f9760f5c-4eb5-4400-b7ed-92763659269c',
    PRO_BUSINESS: '746b5656-fe1a-47a1-9547-ee410c4010e8',
  },
  LIMITS: {
    WEBDAV_DISABLED: '3d39f296-d341-4c04-aadf-1fa9bba727e7',
    WEBDAV_ENABLED: '0e0a6edf-5fae-4dd4-9eba-9d97b3f5f661',
  },
  TIER_LIMIT_RELATIONS: {
    FREE_WEBDAV: '4a1c57b5-a5a7-40ef-8234-5fb41062f174',
    ESSENTIAL_WEBDAV: '2b39d46f-40f8-4227-8335-fb6323e931c0',
    PREMIUM_WEBDAV: '9d89a189-9b35-428a-bf0c-b88d3b0bf3ee',
    ULTIMATE_WEBDAV: 'f028052d-4e71-4636-9d31-2227dcd7cb91',
    STANDARD_WEBDAV: '18297f5d-144d-48a3-ac11-7fc1f905b1be',
    PRO_WEBDAV: 'aeeaaa9a-f7cb-4bbe-85da-75bd3e8ff46f',
  },
};

module.exports = {
  async up(queryInterface) {
    const tiersData = [
      {
        id: MIGRATION_DATA_ID.TIERS.FREE_INDIVIDUAL,
        label: 'free_individual',
        context: 'Free - 1GB',
      },
      {
        id: MIGRATION_DATA_ID.TIERS.ESSENTIAL_INDIVIDUAL,
        label: 'essential_individual',
        context: 'Essential - 1TB',
      },
      {
        id: MIGRATION_DATA_ID.TIERS.PREMIUM_INDIVIDUAL,
        label: 'premium_individual',
        context: 'Premium - 3TB',
      },
      {
        id: MIGRATION_DATA_ID.TIERS.ULTIMATE_INDIVIDUAL,
        label: 'ultimate_individual',
        context: 'Ultimate - 5TB',
      },
      {
        id: MIGRATION_DATA_ID.TIERS.STANDARD_BUSINESS,
        label: 'standard_business',
        context: 'Standard - 1TB per user',
      },
      {
        id: MIGRATION_DATA_ID.TIERS.PRO_BUSINESS,
        label: 'pro_business',
        context: 'Pro - 2TB per user',
      },
    ];

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

    // Insert webdav-access limits
    await queryInterface.bulkInsert('limits', [
      {
        id: MIGRATION_DATA_ID.LIMITS.WEBDAV_DISABLED,
        label: 'webdav-access',
        name: 'WebDAV access disabled',
        type: 'boolean',
        value: 'false',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: MIGRATION_DATA_ID.LIMITS.WEBDAV_ENABLED,
        label: 'webdav-access',
        name: 'WebDAV access enabled',
        type: 'boolean',
        value: 'true',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Create tier-limit relationships
    const tierLimitRelations = [
      // Free, Essential, Premium: no webdav access
      {
        id: MIGRATION_DATA_ID.TIER_LIMIT_RELATIONS.FREE_WEBDAV,
        tier_id: MIGRATION_DATA_ID.TIERS.FREE_INDIVIDUAL,
        limit_id: MIGRATION_DATA_ID.LIMITS.WEBDAV_DISABLED,
      },
      {
        id: MIGRATION_DATA_ID.TIER_LIMIT_RELATIONS.ESSENTIAL_WEBDAV,
        tier_id: MIGRATION_DATA_ID.TIERS.ESSENTIAL_INDIVIDUAL,
        limit_id: MIGRATION_DATA_ID.LIMITS.WEBDAV_DISABLED,
      },
      {
        id: MIGRATION_DATA_ID.TIER_LIMIT_RELATIONS.PREMIUM_WEBDAV,
        tier_id: MIGRATION_DATA_ID.TIERS.PREMIUM_INDIVIDUAL,
        limit_id: MIGRATION_DATA_ID.LIMITS.WEBDAV_DISABLED,
      },
      // Ultimate, Standard Business, Pro Business: webdav access
      {
        id: MIGRATION_DATA_ID.TIER_LIMIT_RELATIONS.ULTIMATE_WEBDAV,
        tier_id: MIGRATION_DATA_ID.TIERS.ULTIMATE_INDIVIDUAL,
        limit_id: MIGRATION_DATA_ID.LIMITS.WEBDAV_ENABLED,
      },
      {
        id: MIGRATION_DATA_ID.TIER_LIMIT_RELATIONS.STANDARD_WEBDAV,
        tier_id: MIGRATION_DATA_ID.TIERS.STANDARD_BUSINESS,
        limit_id: MIGRATION_DATA_ID.LIMITS.WEBDAV_ENABLED,
      },
      {
        id: MIGRATION_DATA_ID.TIER_LIMIT_RELATIONS.PRO_WEBDAV,
        tier_id: MIGRATION_DATA_ID.TIERS.PRO_BUSINESS,
        limit_id: MIGRATION_DATA_ID.LIMITS.WEBDAV_ENABLED,
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
      MIGRATION_DATA_ID.TIERS.FREE_INDIVIDUAL,
      MIGRATION_DATA_ID.TIERS.ESSENTIAL_INDIVIDUAL,
      MIGRATION_DATA_ID.TIERS.PREMIUM_INDIVIDUAL,
      MIGRATION_DATA_ID.TIERS.ULTIMATE_INDIVIDUAL,
      MIGRATION_DATA_ID.TIERS.STANDARD_BUSINESS,
      MIGRATION_DATA_ID.TIERS.PRO_BUSINESS,
    ];

    const limitIds = [
      MIGRATION_DATA_ID.LIMITS.WEBDAV_DISABLED,
      MIGRATION_DATA_ID.LIMITS.WEBDAV_ENABLED,
    ];

    await queryInterface.sequelize.query(
      `DELETE FROM tiers_limits WHERE tier_id IN (:tierIds)`,
      { replacements: { tierIds } },
    );

    await queryInterface.sequelize.query(
      `DELETE FROM tiers WHERE id IN (:tierIds)`,
      { replacements: { tierIds } },
    );

    await queryInterface.sequelize.query(
      `DELETE FROM limits WHERE id IN (:limitIds)`,
      { replacements: { limitIds } },
    );
  },
};
