module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('send_links_items', 'path', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'size',
    });

    await queryInterface.sequelize.query(
      'UPDATE send_links_items SET path = id WHERE path IS NULL',
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('send_links_items', 'path');
  },
};
