'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION get_folder_ancestors_excluding_root_children(folder_id UUID, u_id INT)
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
          AND f.parent_id IS NOT NULL
        )
        SELECT * FROM hier
        WHERE parent_id IS NOT NULL; -- Exclude the root folder itself
      END;
      $$ LANGUAGE plpgsql;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'drop function get_folder_ancestors_excluding_root_children;',
    );
  },
};
