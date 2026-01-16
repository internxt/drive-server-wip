'use strict';

const FILE_VERSION_LABELS = {
  ENABLED: 'file-version-enabled',
  MAX_SIZE: 'file-version-max-size',
  RETENTION_DAYS: 'file-version-retention-days',
  MAX_NUMBER: 'file-version-max-number',
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE limits
       SET value = 'false', updated_at = NOW()
       FROM tiers_limits tl, tiers t
       WHERE tl.limit_id = limits.id
       AND t.id = tl.tier_id
       AND t.label = 'essential_individual'
       AND limits.label = :enabledLabel`,
      { replacements: { enabledLabel: FILE_VERSION_LABELS.ENABLED } },
    );

    await queryInterface.sequelize.query(
      `UPDATE limits
       SET value = '0', updated_at = NOW()
       FROM tiers_limits tl, tiers t
       WHERE tl.limit_id = limits.id
       AND t.id = tl.tier_id
       AND t.label = 'essential_individual'
       AND limits.label IN (:counterLabels)`,
      {
        replacements: {
          counterLabels: [
            FILE_VERSION_LABELS.MAX_SIZE,
            FILE_VERSION_LABELS.RETENTION_DAYS,
            FILE_VERSION_LABELS.MAX_NUMBER,
          ],
        },
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE limits
       SET value = 'true', updated_at = NOW()
       FROM tiers_limits tl, tiers t
       WHERE tl.limit_id = limits.id
       AND t.id = tl.tier_id
       AND t.label = 'essential_individual'
       AND limits.label = :enabledLabel`,
      { replacements: { enabledLabel: FILE_VERSION_LABELS.ENABLED } },
    );

    await queryInterface.sequelize.query(
      `UPDATE limits
       SET value = :maxSize, updated_at = NOW()
       FROM tiers_limits tl, tiers t
       WHERE tl.limit_id = limits.id
       AND t.id = tl.tier_id
       AND t.label = 'essential_individual'
       AND limits.label = :label`,
      {
        replacements: {
          maxSize: String(1 * 1024 * 1024),
          label: FILE_VERSION_LABELS.MAX_SIZE,
        },
      },
    );

    await queryInterface.sequelize.query(
      `UPDATE limits
       SET value = '10', updated_at = NOW()
       FROM tiers_limits tl, tiers t
       WHERE tl.limit_id = limits.id
       AND t.id = tl.tier_id
       AND t.label = 'essential_individual'
       AND limits.label = :label`,
      { replacements: { label: FILE_VERSION_LABELS.RETENTION_DAYS } },
    );

    await queryInterface.sequelize.query(
      `UPDATE limits
       SET value = '1', updated_at = NOW()
       FROM tiers_limits tl, tiers t
       WHERE tl.limit_id = limits.id
       AND t.id = tl.tier_id
       AND t.label = 'essential_individual'
       AND limits.label = :label`,
      { replacements: { label: FILE_VERSION_LABELS.MAX_NUMBER } },
    );
  },
};
