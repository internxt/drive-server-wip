module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION mark_deleted_files_v3() RETURNS TRIGGER AS $$
      BEGIN
        IF (OLD.removed = false AND NEW.removed = true) THEN
          UPDATE files SET removed = true, removed_at = NOW(), status = 'DELETED', updated_at = NOW() WHERE files.folder_id = OLD.id;
          UPDATE folders SET removed = true, removed_at = NOW() WHERE folders.parent_id = OLD.id; 
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';
    `);
  },

  down: async (queryInterface) => {},
};
