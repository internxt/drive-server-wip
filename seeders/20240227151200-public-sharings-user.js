'use strict';
const { v4 } = require('uuid');
const { Op } = require('sequelize');

const referralCode = v4();

const PublicSharingUser = {
  user_id: 'Public Shared Items User',
  name: 'Internxt',
  lastname: 'Internxt',
  email: 'public-sharings@internxt.com',
  username: 'public-sharings@internxt.com',
  bridge_user: 'public-sharings@internxt.com',
  password: 'publicSharingUser',
  mnemonic: 'internxt public sharings mnemonic',
  h_key: 'internxt salt',
  referrer: null,
  referral_code: referralCode,
  uuid: '00000000-0000-0000-0000-000000000000',
  credit: 0,
  welcome_pack: true,
  register_completed: true,
};

module.exports = {
  async up(queryInterface) {
    const existingUsers = await queryInterface.sequelize.query(
      'SELECT email FROM users WHERE email = :email',
      {
        replacements: { email: PublicSharingUser.email },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      },
    );

    const newUsers = [PublicSharingUser].filter(
      (user) => !existingUsers.find((u) => u.email === user.email),
    );

    if (newUsers.length > 0) {
      await queryInterface.bulkInsert('users', newUsers, { returning: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'users',
      {
        email: { [Op.in]: [PublicSharingUser.email] },
      },
      {},
    );
  },
};

module.exports.users = { PublicSharingUser };
