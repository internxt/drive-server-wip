'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * INSERT TRIGGERS
     */
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION get_folder_ancestors(folder_id UUID, u_id INT)
      RETURNS setof folders AS $$
      BEGIN
        RETURN QUERY
        WITH RECURSIVE hier AS (
          SELECT c.*
          FROM folders c
          WHERE c.removed = FALSE
          AND c.uuid = folder_id
          UNION
          SELECT f.*
          FROM folders f
          INNER JOIN hier fh ON fh.parent_id = f.id
          WHERE f.removed = FALSE
          AND f.user_id = u_id
        )
        SELECT * FROM hier;
      END;
      $$ LANGUAGE plpgsql;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('drop function get_folder_ancestors;');
  },
};
