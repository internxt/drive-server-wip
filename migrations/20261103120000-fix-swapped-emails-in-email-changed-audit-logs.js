'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // A row is swapped when its stored oldEmail is the new email of the change
    // attempt accepted at the same moment. Rows written after the fix never
    // match, so this is safe to run before or after deploying it.
    await queryInterface.sequelize.query(`
      UPDATE audit_logs al
      SET metadata = al.metadata || jsonb_build_object(
        'oldEmail', al.metadata->'newEmail',
        'newEmail', al.metadata->'oldEmail'
      )
      FROM users_attempt_change_email a
      WHERE al.action = 'email-changed'
        AND a.user_uuid = al.entity_id::text
        AND a.status = 'verified'
        AND a.new_email = al.metadata->>'oldEmail'
        AND a.updated_at BETWEEN al.created_at - INTERVAL '1 minute' AND al.created_at + INTERVAL '1 minute'
    `);
  },

  async down() {},
};
