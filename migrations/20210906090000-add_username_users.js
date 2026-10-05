module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'username', {
      type: Sequelize.STRING,
    });
    await queryInterface.addConstraint('users', {
      fields: ['username'],
      type: 'unique',
      name: 'users_username_key',
    });
  },

  down: async (queryInterface) => {
    return queryInterface.removeColumn('users', 'username');
  }
};
