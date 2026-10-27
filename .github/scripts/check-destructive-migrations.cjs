// Static safety net, never executes the migrations: parses each file and flags data-destroying
// operations outside its `down` migration. Index drops are allowed on purpose.
const fs = require('node:fs');
const acorn = require('acorn');
const walk = require('acorn-walk');

const DESTRUCTIVE_METHODS = new Set([
  'dropTable',
  'dropAllTables',
  'dropSchema',
  'dropAllSchemas',
  'dropEnum',
  'dropAllEnums',
  'removeColumn',
  'bulkDelete',
  'bulkUpdate',
]);

const DESTRUCTIVE_SQL = [
  /\bDELETE\s+FROM\b/i,
  /\bTRUNCATE\b/i,
  /\bDROP\s+(?!INDEX\b|CONSTRAINT\b|DEFAULT\b|NOT\s+NULL\b|IDENTITY\b|EXPRESSION\b)\w+/i,
];

const isDownMigration = (node) =>
  (node.type === 'Property' && (node.key.name ?? node.key.value) === 'down') ||
  (node.type === 'AssignmentExpression' &&
    node.left.type === 'MemberExpression' &&
    (node.left.property.name ?? node.left.property.value) === 'down');

const findingsIn = (source) => {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const findings = [];
  const report = (node, reason) => findings.push(`line ${node.loc.start.line}: ${reason}`);

  const checkSql = (node, text) => {
    const statements = text
      .replace(/'(?:[^']|'')*'/g, "''")
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const match = DESTRUCTIVE_SQL.map((pattern) => statements.match(pattern)).find(Boolean);
    if (match) report(node, `SQL "${match[0]}"`);
  };

  walk.recursive(ast, null, {
    Property(node, state, visit) {
      if (!isDownMigration(node)) walk.base.Property(node, state, visit);
    },
    AssignmentExpression(node, state, visit) {
      if (!isDownMigration(node)) walk.base.AssignmentExpression(node, state, visit);
    },
    CallExpression(node, state, visit) {
      const { callee } = node;
      if (callee.type === 'MemberExpression') {
        if (callee.computed && callee.property.type !== 'Literal') {
          report(node, 'dynamic method call, cannot be verified');
        }
        const method = callee.property.name ?? callee.property.value;
        if (DESTRUCTIVE_METHODS.has(method)) report(node, `${method}()`);
      }
      walk.base.CallExpression(node, state, visit);
    },
    Literal(node) {
      if (typeof node.value === 'string') checkSql(node, node.value);
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
