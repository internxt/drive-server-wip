'use strict';

const MAX_ATTEMPTS = 10;

module.exports = {
  up: async (queryInterface) => {
    console.info('Starting cleanup of duplicate removed folders...');

    const [pairs] = await queryInterface.sequelize.query(`
      SELECT parent_uuid, plain_name
      FROM folders
      WHERE deleted = false
        AND parent_uuid IS NOT NULL
        AND plain_name IS NOT NULL
      GROUP BY parent_uuid, plain_name
      HAVING COUNT(*) > 1;
    `);

    console.info(
      `Found ${pairs.length} duplicate (parent_uuid, plain_name) pairs among removed folders.`,
    );

    let renamed = 0;

    for (const { parent_uuid, plain_name } of pairs) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT id FROM folders
         WHERE parent_uuid = $1 AND plain_name = $2
           AND deleted = false
         ORDER BY id`,
        { bind: [parent_uuid, plain_name] },
      );

      for (let i = 1; i < rows.length; i++) {
        const { id } = rows[i];
        let attempts = 0;

        while (attempts < MAX_ATTEMPTS) {
          try {
            await queryInterface.sequelize.query(
              `UPDATE folders SET plain_name = $1 WHERE id = $2`,
              { bind: [`${plain_name}_${id}`, id] },
            );
            renamed++;
            break;
          } catch (err) {
            attempts++;
            console.error(
              `[ERROR]: Failed to rename folder id=${id} (attempt ${attempts}/${MAX_ATTEMPTS}): ${err.message}`,
            );
            if (attempts >= MAX_ATTEMPTS) throw err;
          }
        }
      }
    }

    console.info(
      `=== Cleanup Complete: renamed ${renamed} removed folders ===`,
    );
  },

  down: async () => {},
};
