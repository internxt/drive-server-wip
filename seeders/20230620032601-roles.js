const { Op } = require('sequelize');

const uuid = 'd290f1ee-6c54-4b01-90e6-d801748f0851';
const uuid2 = 'd290f1ee-6c54-4b01-90e6-d801748f0852';

module.exports = {
  up: async (queryInterface) => {
    const roles = await queryInterface.sequelize.query(`SELECT * FROM roles`, {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });

    if (roles.length === 0) {
      await queryInterface.bulkInsert('roles', [
        {
          id: uuid,
          name: 'role_1',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: uuid2,
          name: 'role_2',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete(
      'roles',
      {
        id: {
          [Op.in]: [uuid, uuid2],
        },
      },
      {},
    );
  },
};
