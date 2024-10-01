'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
      DO $$
      DECLARE
          outer_rec RECORD;
          inner_rec RECORD;
          new_name TEXT;
          suffix INT;
          total_duplicates INT;
          renamed_count INT := 0;
      BEGIN
          -- Find and loop over duplicates
          FOR outer_rec IN
              SELECT plain_name, COALESCE(type, '') AS type, folder_id, user_id
              FROM public.files
              WHERE status = 'EXISTS'
                AND plain_name IS NOT NULL
              GROUP BY plain_name, COALESCE(type, ''), folder_id, user_id
              HAVING COUNT(*) > 1
              ORDER BY user_id
          LOOP
              SELECT COUNT(*)
              INTO total_duplicates
              FROM public.files
              WHERE plain_name = outer_rec.plain_name 
                AND COALESCE(type, '') = outer_rec.type 
                AND folder_id = outer_rec.folder_id
                AND user_id = outer_rec.user_id
                AND status = 'EXISTS'
                AND plain_name is not null;

              RAISE NOTICE 'Found % duplicates for plain_name: %, type: %, folder_id: %, user_id: %', 
                  total_duplicates, outer_rec.plain_name, outer_rec.type, outer_rec.folder_id, outer_rec.user_id;
        
              suffix := 1;

              -- Renaming loop
              FOR inner_rec IN
                  SELECT id, plain_name
                  FROM public.files
                  WHERE plain_name = outer_rec.plain_name 
                    AND COALESCE(type, '') = outer_rec.type 
                    AND folder_id = outer_rec.folder_id
                    AND user_id = outer_rec.user_id
                    AND status = 'EXISTS'
                  ORDER BY id
              LOOP
                  -- Prepare the new name for the duplicates
                  new_name := inner_rec.plain_name;

                  -- If it is not the first file, then generate a suffix
                  IF suffix > 1 THEN
                      -- Try diff suffixes until finding one which is free
                      LOOP
                          new_name := inner_rec.plain_name || ' (' || suffix || ')';

                          -- Is the suffix already taken?
                          EXIT WHEN NOT EXISTS (
                              SELECT 1
                              FROM public.files
                              WHERE plain_name = new_name
                                AND folder_id = outer_rec.folder_id
                                AND user_id = outer_rec.user_id
                                AND status = 'EXISTS'
                          );

                          -- If it is taken, try with the next one
                          suffix := suffix + 1;
                      END LOOP;

                      -- Update the row with the new name
                      UPDATE public.files
                      SET plain_name = new_name
                      WHERE id = inner_rec.id;
                      
                      renamed_count := renamed_count + 1; -- Count renamed items
                      RAISE NOTICE 'Renamed plain_name from % to %', inner_rec.plain_name, new_name;
                  END IF;

                  -- Inc suffix for the next duplicate
                  suffix := suffix + 1;
              END LOOP;

              RAISE NOTICE 'Total duplicates found: %, Total renamed: %', 
                          total_duplicates, renamed_count;
          END LOOP;

          RAISE NOTICE 'Renaming completed. Total renamed: %', renamed_count;
      END $$;
    `,
    );
  },

  async down(queryInterface, Sequelize) {
    /**
     * no op
     */
  },
};
