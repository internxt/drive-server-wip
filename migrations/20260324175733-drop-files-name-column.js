'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE
        attempts INT := 0;
      BEGIN
        LOOP
          BEGIN
            SET LOCAL lock_timeout = '500ms';
            ALTER TABLE files DROP COLUMN IF EXISTS name;
            EXIT;
          EXCEPTION WHEN lock_not_available THEN
            attempts := attempts + 1;
            RAISE NOTICE 'Lock not available, retrying (attempt %)...', attempts;
            IF attempts >= 10 THEN
              RAISE EXCEPTION 'Could not acquire lock after % attempts', attempts;
            END IF;
            PERFORM pg_sleep(1);
          END;
        END LOOP;
      END $$;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('files', 'name', {
      type: Sequelize.STRING(650),
      allowNull: true,
    });
  },
};
