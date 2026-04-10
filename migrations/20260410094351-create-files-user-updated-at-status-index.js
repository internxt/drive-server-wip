'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_updated_at_status
      ON public.files USING btree (user_id, updated_at, status);
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_user_updated_at_status;
    `);
  },
};
