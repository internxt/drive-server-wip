'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const tiersData = [
      { id: uuidv4(), label: '10gb_individual', context: 'Plan 10GB' },
      { id: uuidv4(), label: '200gb_individual', context: 'Plan 200GB' },
      { id: uuidv4(), label: '2tb_individual', context: 'Plan 2TB' },
      { id: uuidv4(), label: '5tb_individual', context: 'Plan 5TB' },
      { id: uuidv4(), label: '10tb_individual', context: 'Plan 10TB' },
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

    const limitsData = [
      {
        tierLabel: '10gb_individual',
        limits: [
          { label: 'max-shared-items', type: 'counter', value: '10' },
          { label: 'max-shared-invites', type: 'counter', value: '5' },
          { label: 'file-versioning', type: 'boolean', value: 'false' },
          { label: 'max-file-upload-size', type: 'counter', value: '1' },
          { label: 'max-trash-storage-days', type: 'counter', value: '7' },
          { label: 'max-back-up-devices', type: 'counter', value: '1' },
        ],
      },
      {
        tierLabel: '200gb_individual',
        limits: [
          { label: 'max-shared-items', type: 'counter', value: '50' },
          { label: 'max-shared-invites', type: 'counter', value: '50' },
          { label: 'file-versioning', type: 'boolean', value: 'false' },
          { label: 'max-file-upload-size', type: 'counter', value: '5' },
          { label: 'max-trash-storage-days', type: 'counter', value: '90' },
          { label: 'max-back-up-devices', type: 'counter', value: '5' },
        ],
      },
      {
        tierLabel: '2tb_individual',
        limits: [
          { label: 'max-shared-items', type: 'counter', value: '50' },
          { label: 'max-shared-invites', type: 'counter', value: '50' },
          { label: 'file-versioning', type: 'boolean', value: 'true' },
          { label: 'max-file-upload-size', type: 'counter', value: '20' },
          { label: 'max-trash-storage-days', type: 'counter', value: '90' },
          { label: 'max-back-up-devices', type: 'counter', value: '10' },
        ],
      },
      {
        tierLabel: '5tb_individual',
        limits: [
          { label: 'max-shared-items', type: 'counter', value: '1000' },
          { label: 'max-shared-invites', type: 'counter', value: '100' },
          { label: 'file-versioning', type: 'boolean', value: 'true' },
          { label: 'max-file-upload-size', type: 'counter', value: '20' },
          { label: 'max-trash-storage-days', type: 'counter', value: '180' },
          { label: 'max-back-up-devices', type: 'counter', value: '20' },
        ],
      },
      {
        tierLabel: '10tb_individual',
        limits: [
          { label: 'max-shared-items', type: 'counter', value: '1000' },
          { label: 'max-shared-invites', type: 'counter', value: '100' },
          { label: 'file-versioning', type: 'boolean', value: 'true' },
          { label: 'max-file-upload-size', type: 'counter', value: '20' },
          { label: 'max-trash-storage-days', type: 'counter', value: '365' },
          { label: 'max-back-up-devices', type: 'counter', value: '20' },
        ],
      },
    ];

    let tierAndLimitsRelations = [];

    const flattenedLimits = limitsData.flatMap((plan) => {
      return plan.limits.map((limit) => {
        const uuid = uuidv4();

        tierAndLimitsRelations.push({
          id: uuidv4(),
          limit_id: uuid,
          tier_id: tiersData.find((tier) => tier.label === plan.tierLabel).id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        return {
          id: uuid,
          label: limit.label,
          type: limit.type,
          value: limit.value,
          created_at: new Date(),
          updated_at: new Date(),
        };
      });
    });

    await queryInterface.bulkInsert('limits', flattenedLimits);

    await queryInterface.bulkInsert('tiers_limits', tierAndLimitsRelations);
  },

  async down(queryInterface) {
    const tierLabels = [
      '10gb_individual',
      '200gb_individual',
      '2tb_individual',
      '5tb_individual',
      '10tb_individual',
    ];

    await queryInterface.sequelize.query(
      `DELETE FROM tiers_limits WHERE tier_id IN (SELECT id FROM tiers WHERE label IN (:tierLabels))`,
      { replacements: { tierLabels } },
    );

    await queryInterface.sequelize.query(
      `DELETE FROM tiers WHERE label IN (:tierLabels)`,
      { replacements: { tierLabels } },
    );

    // Delete any orphaned limits that are no longer associated with any tier
    await queryInterface.sequelize.query(`
      DELETE FROM limits WHERE id NOT IN (SELECT limit_id FROM tiers_limits)
    `);
  },
};
