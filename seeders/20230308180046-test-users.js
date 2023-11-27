'use strict';

const { v4 } = require('uuid');
const { Op } = require('sequelize');

const referralCode = v4();
const testUser = {
  user_id: 'JohnDoe userId',
  name: 'John',
  lastname: 'Doe',
  uuid: '123e4567-e89b-12d3-a456-426614174000',
  email: 'john@doe.com',
  username: 'john@doe.com',
  bridge_user: 'john@doe.com',
  password: 'johndoepassword',
  mnemonic: 'john doe mnemonic',
  h_key: 'john doe salt',
  referrer: null,
  referral_code: referralCode,
  uuid: '87204d6b-c4a7-4f38-bd99-f7f47964a643',
  credit: 0,
  welcome_pack: true,
  register_completed: true,
};

const referredTestUser = {
  user_id: 'JohnDoe userId',
  name: 'John',
  lastname: 'Doe',
  uuid: '09b073a3-ffc0-42dd-aa6a-dea4702bfbd6',
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
  async up(queryInterface) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */
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

  async down(queryInterface) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete(
      'users',
      {
        email: { [Op.in]: [testUser.email, referredTestUser.email] },
      },
      {},
    );
  },
};

module.exports.users = { testUser, referredTestUser };
