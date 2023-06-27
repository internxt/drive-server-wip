'use strict';

const { v4 } = require('uuid');
const { Op } = require('sequelize');

const referralCode = v4();
const testUser = {
  user_id: 'JohnDoe userId',
  name: 'John',
  lastname: 'Doe',
  uuid: v4(),
  email: 'john@doe.com',
  username: 'john@doe.com',
  bridge_user: 'john@doe.com',
  password: 'johndoepassword',
  mnemonic: 'john doe mnemonic',
  h_key: 'john doe salt',
  referrer: null,
  referral_code: referralCode,
  credit: 0,
  welcome_pack: true,
  register_completed: true,
};

const referredTestUser = {
  user_id: 'JohnDoe userId',
  name: 'John',
  lastname: 'Doe',
  uuid: v4(),
  email: 'johnTwo@doe.com',
  username: 'johnTwo@doe.com',
  bridge_user: 'johnTwo@doe.com',
  password: 'johndoepassword',
  mnemonic: 'john doe mnemonic',
  h_key: 'john doe salt',
  referrer: referralCode,
  referral_code: v4(),
  credit: 0,
  welcome_pack: true,
  register_completed: true,
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const existingUsers = await queryInterface.sequelize.query(
      'SELECT email FROM users WHERE email IN (:emails)',
      {
        replacements: { emails: [testUser.email, referredTestUser.email] },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      },
    );

    const newUsers = [testUser, referredTestUser].filter(
      (user) => !existingUsers.find((u) => u.email === user.email),
    );

    if (newUsers.length > 0) {
      await queryInterface.bulkInsert('users', newUsers, { returning: true });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', {
        email: { [Op.in]: [testUser.email, referredTestUser.email] },
      }, {});
  },
};
