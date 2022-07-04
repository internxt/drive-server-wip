module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('send_links_items', 'path', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'size',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('send_links_items', 'path');
  },
};
