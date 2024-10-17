'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `
      CREATE OR REPLACE FUNCTION get_folder_by_path(p_user_id integer, p_path text, p_parent_uuid uuid)
        RETURNS SETOF folders AS $$
        DECLARE
          folder_uuid UUID;
          current_folder TEXT;
          next_path TEXT;
        BEGIN
          -- Remove leading/trailing slashes
          p_path := trim(both '/' FROM p_path);

          -- Base case: If the path is empty, return the parent_id (current folder's data)
          IF p_path = '' THEN
            RETURN QUERY
            SELECT * FROM folders 
            WHERE uuid = p_parent_uuid AND user_id = p_user_id;
            RETURN;
          END IF;

          -- Get the next folder name and the remaining path
          current_folder := split_part(p_path, '/', 1);
          next_path := substring(p_path FROM length(current_folder) + 2);

          -- Try to find the current folder based on its name, parent_id, and user_id
          SELECT f.uuid INTO folder_uuid
          FROM folders f
          WHERE f.parent_uuid = p_parent_uuid
            AND f.user_id = p_user_id
            AND f.deleted = false
            AND f.removed = false
            AND (f.name = current_folder or f.plain_name = current_folder);

          -- If no folder is found, return an empty result
          IF NOT FOUND THEN
            RETURN QUERY SELECT * FROM folders WHERE FALSE; -- Return an empty result
          END IF;

          -- Recursive call: Process the remaining path
          RETURN QUERY
          SELECT * FROM get_folder_by_path(p_user_id, next_path, folder_uuid);
        END;
        $$ LANGUAGE plpgsql;
      `,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS get_folder_by_path;',
    );
  },
};
