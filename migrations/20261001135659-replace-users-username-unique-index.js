'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS users_username_unique_idx
      ON users (username)
    `);

    // Failed concurrent build leaves an INVALID index that IF NOT EXISTS skips
    const [[newIndex]] = await queryInterface.sequelize.query(`
      SELECT ix.indisvalid FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE i.relname = 'users_username_unique_idx'
    `);
    if (!newIndex?.indisvalid) {
      throw new Error('users_username_unique_idx is invalid, drop it and rerun');
    }

    await queryInterface.sequelize.query(
      'DROP INDEX CONCURRENTLY IF EXISTS username',
    );

    // ALTER TABLE locks the table even with IF EXISTS
    const [[oldConstraint]] = await queryInterface.sequelize.query(`
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'users'::regclass AND conname = 'users_username_key'
    `);
    if (oldConstraint) {
      await queryInterface.sequelize.query(
        'ALTER TABLE users DROP CONSTRAINT users_username_key',
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS username ON users (username)',
    );
    await queryInterface.sequelize.query(
      'DROP INDEX CONCURRENTLY IF EXISTS users_username_unique_idx',
    );
  },
};
