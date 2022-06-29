module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('send_links', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      views: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      sender: {
        type: Sequelize.STRING,
      },
      receivers: {
        type: Sequelize.STRING,
      },
      code: {
        type: Sequelize.STRING(400),
      },
      title: {
        type: Sequelize.STRING,
      },
      subject: {
        type: Sequelize.STRING,
      },
      user_id: {
        type: Sequelize.INTEGER,
        references: { model: 'users', key: 'id' },
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      expiration_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable('send_links_items', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
      },
      type: {
        type: Sequelize.STRING,
      },
      link_id: {
        type: Sequelize.UUID,
        references: {
          model: 'send_links',
          key: 'id',
        },
      },
      network_id: {
        type: Sequelize.STRING,
      },
      encryption_key: {
        type: Sequelize.STRING(400),
      },
      size: {
        type: Sequelize.INTEGER.UNSIGNED,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('send_links_items');
    await queryInterface.dropTable('send_links');
  },
};
