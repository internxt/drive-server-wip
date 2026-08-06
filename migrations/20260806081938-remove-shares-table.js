'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('shares');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('shares', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      token: {
        type: Sequelize.STRING(255),
      },
      user: {
        type: Sequelize.STRING(255),
      },
      file: {
        type: Sequelize.STRING(24),
      },
      mnemonic: {
        type: Sequelize.BLOB('medium'),
      },
      is_folder: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      views: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      },
      encryption_key: {
        type: Sequelize.STRING(400),
      },
      bucket: {
        type: Sequelize.STRING(24),
        allowNull: false,
      },
      file_token: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
      },
      file_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'files',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      folder_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'folders',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      times_valid: {
        type: Sequelize.INTEGER,
        defaultValue: -1,
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      code: {
        type: Sequelize.STRING(255),
      },
      hashed_password: {
        type: Sequelize.TEXT,
      },
      folder_uuid: {
        type: Sequelize.UUID,
        references: {
          model: 'folders',
          key: 'uuid',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      file_uuid: {
        type: Sequelize.UUID,
        references: {
          model: 'files',
          key: 'uuid',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    });

    await queryInterface.addIndex('shares', ['file_id'], {
      name: 'idx_shares_file_id',
    });
    await queryInterface.addIndex('shares', ['file_uuid'], {
      name: 'idx_shares_file_uuid',
    });
    await queryInterface.addIndex('shares', ['file'], {
      name: 'shares_file_IDX',
    });
    await queryInterface.addIndex('shares', ['user'], {
      name: 'shares_user_IDX',
    });
    await queryInterface.addIndex('shares', ['token'], {
      name: 'token_UNIQUE',
      unique: true,
    });
  },
};
