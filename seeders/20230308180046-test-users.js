'use strict';

const { v4 } = require('uuid');
const { Op } = require('sequelize');

const referralCode = v4();
const testUser = {
  user_id: 'JohnDoe userId',
  name: 'John',
  lastname: 'Doe',
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
  email: 'johnTwo@doe.com',
  username: 'johnTwo@doe.com',
  bridge_user: 'johnTwo@doe.com',
  password: 'johndoepassword',
  mnemonic: 'john doe mnemonic',
  h_key: 'john doe salt',
  referrer: referralCode,
  referral_code: v4(),
  uuid: null,
  credit: 0,
  welcome_pack: true,
  register_completed: true,
};

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
    await queryInterface.bulkInsert('users', [testUser, referredTestUser]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('users', {
      email: { [Op.in]: [testUser.email, referredTestUser.email] }
    }, {});
  }
};
