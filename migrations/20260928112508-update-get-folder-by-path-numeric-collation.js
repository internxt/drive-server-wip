'use strict';

const buildFunction = (plainNameCondition) => `
  CREATE OR REPLACE FUNCTION get_folder_by_path(p_user_id integer, p_path text, p_parent_uuid uuid)
    RETURNS SETOF folders AS $$
    DECLARE
      folder_uuid UUID;
      current_folder TEXT;
      next_path TEXT;
    BEGIN
      p_path := trim(both '/' FROM p_path);

      IF p_path = '' THEN
        RETURN QUERY
        SELECT * FROM folders
        WHERE uuid = p_parent_uuid AND user_id = p_user_id;
        RETURN;
      END IF;

      current_folder := split_part(p_path, '/', 1);
      next_path := substring(p_path FROM length(current_folder) + 2);

      SELECT f.uuid INTO folder_uuid
      FROM folders f
      WHERE f.parent_uuid = p_parent_uuid
        AND f.user_id = p_user_id
        AND f.deleted = false
        AND f.removed = false
        AND ${plainNameCondition};

      IF NOT FOUND THEN
        RETURN QUERY SELECT * FROM folders WHERE FALSE;
      END IF;

      RETURN QUERY
      SELECT * FROM get_folder_by_path(p_user_id, next_path, folder_uuid);
    END;
    $$ LANGUAGE plpgsql;
`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // COLLATE "custom_numeric" needed to hit folders_parentuuid_plainname_numeric_unique
    await queryInterface.sequelize.query(
      buildFunction(
        'f.plain_name COLLATE "custom_numeric" = current_folder COLLATE "custom_numeric"',
      ),
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      buildFunction('f.plain_name = current_folder'),
    );
  },
};
