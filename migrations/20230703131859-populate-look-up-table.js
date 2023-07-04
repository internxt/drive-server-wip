'use strict';

const { v4 } = require('uuid');

const users = {};

async function insert(table, queryInterface, Sequelize) {
  const batchSize = 10000;
  let offset = 0;
  let allDataInserted = false;

  const query = `
    SELECT uuid, plain_name, user_id FROM ${table}
    WHERE plain_name IS NOT NULL AND uuid IS NOT NULL AND user_id IS NOT NULL
    LIMIT :limit 
    OFFSET :offset
  `;

  while (!allDataInserted) {
    const result = await queryInterface.sequelize.query(query, {
      replacements: { limit: batchSize, offset, table },
    });

    const items = result[0];

    if (items.length > 0) {
      const promises = items.map(async ({ uuid, plain_name, user_id }) => {
        let userUuid = users[user_id];

        if (!users[user_id]) {
          const result = await queryInterface.sequelize.query(
            'SELECT uuid FROM users WHERE id = :id and uuid IS NOT NULL LIMIT 1',
            {
              replacements: { id: user_id },
            },
          );
          console.log(result[0][0]);
          users[user_id] = result[0][0].uuid;
          userUuid = result[0][0].uuid;
        }

        return {
          id: v4(),
          item_id: uuid,
          item_type: table === 'folders' ? 'FOLDER' : 'FILE',
          name: plain_name,
          tokenized_name: Sequelize.literal(
            `to_tsvector('simple', '${plain_name}')`,
          ),
          user_id: userUuid,
        };
      });

      const entries = await Promise.all(promises);

      await queryInterface.bulkInsert('look_up', entries, {});
      offset += batchSize;
    } else {
      allDataInserted = true;
    }
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await insert('files', queryInterface, Sequelize);
    await insert('folders', queryInterface, Sequelize);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
