'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      -- seats
      WITH workspace_seats AS (
        SELECT 
          w.number_of_seats as seats,
          w.id
        FROM 
          workspaces w
      ),

      -- members
      workspace_members AS (
        SELECT 
          wu.workspace_id, 
          COUNT(wu.member_id) AS members
        FROM 
          workspace_users wu
        GROUP BY 
          wu.workspace_id
      )

      UPDATE workspace_users wu
      SET space_limit = (wu.space_limit * ws.seats) - (wu.space_limit * (wm.members - 1))
      FROM workspace_seats ws
      INNER JOIN workspace_members wm ON ws.id = wm.workspace_id
      WHERE wu.workspace_id = ws.id
      AND wu.member_id = (SELECT owner_id FROM workspaces w WHERE w.id = wu.workspace_id);
    `);
  },

  async down() {},
};
