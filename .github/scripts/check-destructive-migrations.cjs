// Static safety net, never executes the migrations: parses each file and flags data-destroying
// operations outside its top-level `down` migration. Index drops are allowed on purpose.
const fs = require('node:fs');
const acorn = require('acorn');
const walk = require('acorn-walk');

const DESTRUCTIVE_NAMES = new Set([
  'dropTable',
  'dropAllTables',
  'dropSchema',
  'dropAllSchemas',
  'dropEnum',
  'dropAllEnums',
  'removeColumn',
  'bulkDelete',
  'bulkUpdate',
  'destroy',
  'truncate',
  'drop',
  'sync',
  'delete',
  'down',
  'eval',
  'Function',
  'require',
]);

const ALLOWED_REQUIRES = new Set(['sequelize', 'uuid']);

const DESTRUCTIVE_SQL = [
  /\bDELETE\s+FROM\b/i,
  /\bTRUNCATE\b/i,
  /\bEXECUTE\b(?!\s+(?:FUNCTION|PROCEDURE)\b)/i,
  /\bDROP\s+(?!INDEX\b|CONSTRAINT\b|DEFAULT\b|NOT\s+NULL\b|IDENTITY\b|EXPRESSION\b)\w+/i,
];

// Postgres treats comments as whitespace and string contents as data, so both are blanked before
// matching. Dollar-quoted bodies (functions, DO blocks) are executable SQL and are also checked raw.
const tokenizeSql = (sql) => {
  let statements = '';
  const dollarBodies = [];
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    const dollarTag = rest.match(/^\$[A-Za-z_]*\$/);
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
      statements += ' ';
    } else if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      statements += ' ';
    } else if (dollarTag) {
      const tag = dollarTag[0];
      const end = sql.indexOf(tag, i + tag.length);
      dollarBodies.push(sql.slice(i + tag.length, end === -1 ? sql.length : end));
      i = end === -1 ? sql.length : end + tag.length;
      statements += ' ';
    } else if (/^[Ee]'/.test(rest)) {
      i += 2;
      while (i < sql.length && sql[i] !== "'") i += sql[i] === '\\' ? 2 : 1;
      i += 1;
      statements += " '' ";
    } else if (sql[i] === "'") {
      i += 1;
      while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) i += sql[i] === "'" ? 2 : 1;
      i += 1;
      statements += " '' ";
    } else if (sql[i] === '"') {
      const end = sql.indexOf('"', i + 1);
      i = end === -1 ? sql.length : end + 1;
      statements += ' quoted_identifier ';
    } else {
      statements += sql[i];
      i += 1;
    }
  }
  return { statements, dollarBodies };
};

const destructiveSqlIn = (sql) => {
  const { statements, dollarBodies } = tokenizeSql(sql);
  const blankedBodies = dollarBodies.map((body) => body.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, ' '));
  for (const text of [statements, ...blankedBodies]) {
    const match = DESTRUCTIVE_SQL.map((pattern) => text.match(pattern)).find(Boolean);
    if (match) return match[0];
  }
  return null;
};

const isModuleExports = (node) =>
  (node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.object.name === 'module' &&
    node.property.name === 'exports') ||
  (node.type === 'Identifier' && node.name === 'exports');

// Indexing data (rows[i], byLabel[label], rows[rows.length - 1]) is fine; concatenating or
// formatting a name (qi['drop' + 'Table'], qi[`${a}${b}`], qi[name()]) is how a method is hidden.
const buildsPropertyName = (node) =>
  node.type === 'TemplateLiteral' ||
  node.type === 'CallExpression' ||
  (node.type === 'BinaryExpression' && node.operator === '+') ||
  node.type === 'ConditionalExpression' ||
  node.type === 'LogicalExpression';

const propertyName = (node) => (node.type === 'Identifier' ? node.name : node.value);

const topLevelDownMigrations = (ast) => {
  const downs = new Set();
  for (const statement of ast.body) {
    const expression = statement.type === 'ExpressionStatement' && statement.expression;
    if (!expression || expression.type !== 'AssignmentExpression') continue;
    const { left, right } = expression;
    if (isModuleExports(left) && right.type === 'ObjectExpression') {
      right.properties
        .filter((property) => property.type === 'Property' && !property.computed && propertyName(property.key) === 'down')
        .forEach((property) => downs.add(property.value));
    }
    if (left.type === 'MemberExpression' && isModuleExports(left.object) && !left.computed && left.property.name === 'down') {
      downs.add(right);
    }
  }
  return downs;
};

const findingsIn = (source) => {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const downs = topLevelDownMigrations(ast);
  const findings = [];
  const report = (node, reason) => findings.push(`line ${node.loc.start.line}: ${reason}`);
  const checkName = (node, name) => {
    if (DESTRUCTIVE_NAMES.has(name)) report(node, `use of "${name}"`);
  };
  const checkSql = (node, text) => {
    const match = destructiveSqlIn(text);
    if (match) report(node, `SQL "${match}"`);
  };

  walk.recursive(ast, null, {
    Function(node, state, visit) {
      if (!downs.has(node)) walk.base.Function(node, state, visit);
    },
    Property(node, state, visit) {
      if (downs.has(node.value)) return;
      if (!node.computed) checkName(node.key, propertyName(node.key));
      walk.base.Property(node, state, visit);
    },
    MemberExpression(node, state, visit) {
      if (!node.computed) {
        checkName(node.property, node.property.name);
      } else if (buildsPropertyName(node.property)) {
        report(node, 'property name built at runtime, cannot be verified');
      }
      walk.base.MemberExpression(node, state, visit);
    },
    CallExpression(node, state, visit) {
      const [argument] = node.arguments;
      const isRequire = node.callee.type === 'Identifier' && node.callee.name === 'require';
      if (isRequire && argument?.type === 'Literal' && ALLOWED_REQUIRES.has(argument.value)) return;
      walk.base.CallExpression(node, state, visit);
    },
    ImportExpression(node) {
      report(node, 'dynamic import');
    },
    Identifier(node) {
      checkName(node, node.name);
    },
    Literal(node) {
      if (typeof node.value !== 'string') return;
      checkName(node, node.value);
      checkSql(node, node.value);
    },
    TemplateLiteral(node, state, visit) {
      checkSql(node, node.quasis.map((quasi) => quasi.value.cooked).join(' '));
      walk.base.TemplateLiteral(node, state, visit);
    },
  });

  return findings;
};

let blocked = false;
for (const file of process.argv.slice(2)) {
  let findings;
  try {
    findings = findingsIn(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    findings = [`could not be parsed (${error.message})`];
  }
  for (const finding of findings) {
    blocked = true;
    console.log(`::error file=${file}::Destructive migration, ${finding}`);
  }
}

process.exit(blocked ? 1 : 0);
