const uuidv4 = require('uuid').v4;

module.exports = {
  up: async (queryInterface) => {
    const roles = await queryInterface.sequelize.query(`SELECT * FROM roles`, {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });

    if (roles.length === 0) {
      await queryInterface.bulkInsert('roles', [
        {
          id: uuidv4(),
          name: 'EDITOR',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: uuidv4(),
          name: 'READER',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('roles', null, {});
  },
};