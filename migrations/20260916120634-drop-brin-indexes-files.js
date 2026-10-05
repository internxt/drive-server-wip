'use strict';

module.exports = {
  async up(queryInterface) {
    // updated_at correlation ~0.35 (pg_stats), too low for BRIN to prune pages effectively.
    await queryInterface.sequelize.query(
      'DROP INDEX CONCURRENTLY IF EXISTS idx_files_brin_updated_at_deleted;',
    );
    await queryInterface.sequelize.query(
      'DROP INDEX CONCURRENTLY IF EXISTS idx_files_deleted_updatedat_brin;',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_brin_updated_at_deleted ON files USING brin (updated_at) WITH (pages_per_range='48') WHERE (status = 'DELETED'::enum_files_status);",
    );
    await queryInterface.sequelize.query(
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_deleted_updatedat_brin ON files USING brin (updated_at) WHERE (status = 'DELETED'::enum_files_status);",
    );
  },
};
