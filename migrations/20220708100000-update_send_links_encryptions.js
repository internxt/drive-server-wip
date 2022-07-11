function convertStringToBinary(string) {
  const codeUnits = new Uint16Array(string.length);
  for (let i = 0; i < codeUnits.length; i++) {
    codeUnits[i] = string.charCodeAt(i);
  }
  const charCodes = new Uint8Array(codeUnits.buffer);
  let result = '';
  for (let i = 0; i < charCodes.byteLength; i++) {
    result += String.fromCharCode(charCodes[i]);
  }
  return result;
}

function getStringFromBinary(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const charCodes = new Uint16Array(bytes.buffer);
  let result = '';
  for (let i = 0; i < charCodes.length; i++) {
    result += String.fromCharCode(charCodes[i]);
  }
  return result;
}
const ENCRYPTION_DATE_RELEASE = '2022-07-05 13:55:00';

// SELECT TO VALIDATE IN DATABASE
// SELECT s.title, s.subject, si.name FROM send_links_items si INNER JOIN send_links s ON s.id = si.link_id WHERE s.created_at < "2022-07-05 13:55:00" AND si.name IS NOT NULL AND s.title IS NOT NULL AND s.subject IS NOT NULL;
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('send_links', 'title', {
      type: Sequelize.STRING(650),
      allowNull: true,
    });
    await queryInterface.changeColumn('send_links', 'subject', {
      type: Sequelize.STRING(650),
      allowNull: true,
    });
    await queryInterface.changeColumn('send_links_items', 'name', {
      type: Sequelize.STRING(650),
    });
    const [sendLinks, columns] = await queryInterface.sequelize.query(
      `SELECT * FROM send_links WHERE created_at < "${ENCRYPTION_DATE_RELEASE}" AND title IS NOT NULL AND subject IS NOT NULL `,
    );
    sendLinks.forEach(async (sendLink) => {
      const title = btoa(convertStringToBinary(sendLink.title));
      const subject = btoa(convertStringToBinary(sendLink.subject));

      await queryInterface.sequelize.query(`
        UPDATE send_links
        SET title = '${title}', subject = '${subject}' WHERE id = '${sendLink.id}'
      `);
    });

    const [sendLinksItems, columnsItems] = await queryInterface.sequelize.query(
      `SELECT * FROM send_links_items WHERE created_at < "${ENCRYPTION_DATE_RELEASE}" AND name IS NOT NULL`,
    );

    sendLinksItems.forEach(async (sendLinkItem) => {
      const name = btoa(convertStringToBinary(sendLinkItem.name));

      await queryInterface.sequelize.query(`
          UPDATE send_links_items
          SET name = '${name}' WHERE id = '${sendLinkItem.id}'
        `);
    });
  },

  down: async (queryInterface, Sequelize) => {
    const [sendLinks, columns] = await queryInterface.sequelize.query(
      `SELECT * FROM send_links WHERE created_at < "${ENCRYPTION_DATE_RELEASE}" AND title IS NOT NULL AND subject IS NOT NULL`,
    );
    sendLinks.forEach((sendLink) => {
      const title = getStringFromBinary(atob(sendLink.title));
      const subject = getStringFromBinary(atob(sendLink.subject));
      const titleParsed = title.includes('"') ? `'${title}'` : `"${title}"`;
      const subjectParsed = subject.includes('"')
        ? `'${subject}'`
        : `"${subject}"`;
      queryInterface.sequelize.query(`
        UPDATE send_links
        SET title = ${titleParsed}, subject = ${subjectParsed} WHERE id = "${sendLink.id}"
      `);
    });

    const [sendLinksItems, columnsItems] = await queryInterface.sequelize.query(
      `SELECT * FROM send_links_items WHERE created_at < "${ENCRYPTION_DATE_RELEASE}" AND name IS NOT NULL`,
    );

    sendLinksItems.forEach(async (sendLinkItem) => {
      const name = getStringFromBinary(atob(sendLinkItem.name));
      const nameParsed = name.includes('"') ? `'${name}'` : `"${name}"`;
      await queryInterface.sequelize.query(`
            UPDATE send_links_items
            SET name = ${nameParsed} WHERE id = "${sendLinkItem.id}"
          `);
    });

    await queryInterface.changeColumn('send_links', 'title', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.changeColumn('send_links', 'subject', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.changeColumn('send_links_items', 'name', {
      type: Sequelize.STRING(255),
    });
  },
};
