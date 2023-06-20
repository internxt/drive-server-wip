const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const roles = await queryInterface.sequelize.query(`SELECT * FROM roles`, {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    if (!roles || roles.length === 0) {
      throw new Error('No roles found');
    }

    const permissions = [];
    for (let i = 0; i < roles.length; i++) {
      const roleId = roles[i].id;

      for (let j = 0; j < 3; j++) {
        permissions.push({
          id: uuidv4(),
          roleId: roleId,
          type: `Permission${j + 1}`,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }
    await queryInterface.bulkInsert('permissions', permissions, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('permissions', null, {});
  },
};