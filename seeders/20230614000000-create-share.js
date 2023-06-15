// migracion de shares
'use strict';

const { v4 } = require('uuid');
const { Op } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Obtén los usuarios desde la base de datos
    const users = await queryInterface.sequelize.query(
      'SELECT * FROM users WHERE email IN (:emails)',
      {
        replacements: { emails: ['john@doe.com', 'johnTwo@doe.com'] },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    const shareOne = {
      id: 1,
      folder_id: 1, // ID del folder compartido
      user_id: users[0].id, // ID del usuario que comparte el folder
      bucket: 'bucketOne',
      file_token: v4(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    await queryInterface.bulkInsert('shares', [shareOne]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('shares', null, {});
  },
};
