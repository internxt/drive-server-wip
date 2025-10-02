'use strict';

const { v4 } = require('uuid');

const MIGRATION_DATA_ID = {
  TIERS: {
    FREE_INDIVIDUAL: 'f9a0c809-33b3-49b6-b8d3-957d95575bb2',
    ESSENTIAL_INDIVIDUAL: '47d76ff1-a6df-4334-a300-b11f50ea6bfd',
    PREMIUM_INDIVIDUAL: '899e07f7-0e8c-427b-9613-dee0c5c705a7',
    ULTIMATE_INDIVIDUAL: '23bd8f2c-ae81-4f18-b18a-55a36e66547d',
    ESSENTIAL_LIFETIME_INDIVIDUAL: '8a7b6c5d-4e3f-2a1b-9c8d-7e6f5a4b3c2d',
    PREMIUM_LIFETIME_INDIVIDUAL: '9b8c7d6e-5f4a-3b2c-ad9e-8f7a6b5c4d3e',
    ULTIMATE_LIFETIME_INDIVIDUAL: 'ac9d8e7f-6a5b-4c3d-be0f-9a8b7c6d5e4f',
    STANDARD_BUSINESS: 'f9760f5c-4eb5-4400-b7ed-92763659269c',
    PRO_BUSINESS: '746b5656-fe1a-47a1-9547-ee410c4010e8',
  },
  LIMITS: {
    CLI_ACCESS_DISABLED: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    CLI_ACCESS_ENABLED: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  },
};

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Insert cli-access limits
      await queryInterface.bulkInsert(
        'limits',
        [
          {
            id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_DISABLED,
            label: 'cli-access',
            name: 'CLI access disabled',
            type: 'boolean',
            value: 'false',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_ENABLED,
            label: 'cli-access',
            name: 'CLI access enabled',
            type: 'boolean',
            value: 'true',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        { transaction },
      );

      // Create tier-limit relationships for CLI access
      const tierLimitRelations = [
        // Free, Essential, Premium (annual & lifetime): no CLI access
        {
          id: v4(),
          tier_id: MIGRATION_DATA_ID.TIERS.FREE_INDIVIDUAL,
          limit_id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_DISABLED,
        },
        {
          id: v4(),
          tier_id: MIGRATION_DATA_ID.TIERS.ESSENTIAL_INDIVIDUAL,
          limit_id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_DISABLED,
        },
        {
          id: v4(),
          tier_id: MIGRATION_DATA_ID.TIERS.PREMIUM_INDIVIDUAL,
          limit_id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_DISABLED,
        },
        {
          id: v4(),
          tier_id: MIGRATION_DATA_ID.TIERS.ESSENTIAL_LIFETIME_INDIVIDUAL,
          limit_id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_DISABLED,
        },
        {
          id: v4(),
          tier_id: MIGRATION_DATA_ID.TIERS.PREMIUM_LIFETIME_INDIVIDUAL,
          limit_id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_DISABLED,
        },
        // Ultimate (annual & lifetime), Standard Business, Pro Business: CLI access enabled
        {
          id: v4(),
          tier_id: MIGRATION_DATA_ID.TIERS.ULTIMATE_INDIVIDUAL,
          limit_id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_ENABLED,
        },
        {
          id: v4(),
          tier_id: MIGRATION_DATA_ID.TIERS.ULTIMATE_LIFETIME_INDIVIDUAL,
          limit_id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_ENABLED,
        },
        {
          id: v4(),
          tier_id: MIGRATION_DATA_ID.TIERS.STANDARD_BUSINESS,
          limit_id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_ENABLED,
        },
        {
          id: v4(),
          tier_id: MIGRATION_DATA_ID.TIERS.PRO_BUSINESS,
          limit_id: MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_ENABLED,
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
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const limitIds = [
      MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_DISABLED,
      MIGRATION_DATA_ID.LIMITS.CLI_ACCESS_ENABLED,
    ];

    await queryInterface.sequelize.query(
      `DELETE FROM tiers_limits WHERE limit_id IN (:limitIds)`,
      { replacements: { limitIds } },
    );

    await queryInterface.sequelize.query(
      `DELETE FROM limits WHERE id IN (:limitIds)`,
      { replacements: { limitIds } },
    );
  },
};
