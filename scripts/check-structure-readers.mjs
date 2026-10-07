/** C5 mechanical reads use the composition kernel (including refreshed Cell
 * caches). Raw terrain/type reads are individually reviewed, counted and pinned
 * to their enclosing function, so adding another raw reader requires review. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { parse as parseSfc } from '@vue/compiler-sfc';

const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const called = (node) =>
  ts.isIdentifier(node) ? node.text : ts.isPropertyAccessExpression(node) ? node.name.text : '';
const mechanical =
  /^(?:cellHasTerrainFlag|terrainFlagsOfCell|cellTerrainFlags|cellHasTMFlag|terrainMechFlagsOfCell|cellTerrainMechFlags|composedCellFlags|knownCellFlags|readCellProperties|isStableBaseFloor|structureBlocking|cellProjectileBlocked|cellProjectileFlags|cellLiquidBlocked|isOpenableStructureDoor|structureAppearance|hasStructureCellBinding|terrainBlocks\w+|terrainPassableOrSecretDoor|genericPathCost)$/;
const rawCalls =
  /^(?:cellHasTerrainType|terrainAllowsMove|terrainFlags|terrainMechFlags|baseCellFlags|baseCellMechFlags|burnedTerrainFlagsOfCell|discoveredTerrainFlagsOfCell)$/;
export function terrainReaderInventory(root) {
  const rows = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['test', 'tests', 'testing'].includes(entry.name)) walk(file);
      } else if (/\.(?:tsx?|vue)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
        inspect(file);
    }
  }
  function inspect(file) {
    let code = readFileSync(file, 'utf8');
    if (file.endsWith('.vue')) {
      const { descriptor } = parseSfc(code);
      code = [descriptor.script, descriptor.scriptSetup]
        .filter(Boolean)
        .map((block) => '\n'.repeat(block.loc.start.line - 1) + block.content)
        .join('\n');
    }
    const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    const relative = path.relative(root, file).replace(/\\/g, '/');
    const catalogNames = new Set(['TERRAIN_FLAGS']);
    for (const statement of source.statements)
      if (
        ts.isImportDeclaration(statement) &&
        statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)
      )
        for (const item of statement.importClause.namedBindings.elements)
          if ((item.propertyName?.text ?? item.name.text) === 'TERRAIN_FLAGS')
            catalogNames.add(item.name.text);
    // Pin a catalog lookup itself when a caller destructures or aliases its
    // result. Otherwise `const {flags} = catalog[type]` could evade .flags reads.
    const isCatalog = (node) =>
      (ts.isIdentifier(node) && catalogNames.has(node.text)) ||
      (ts.isPropertyAccessExpression(node) && node.name.text === 'TERRAIN_FLAGS');
    let addedAlias;
    do {
      addedAlias = false;
      function collectAliases(node) {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.initializer &&
          isCatalog(node.initializer) &&
          !catalogNames.has(node.name.text)
        ) {
          catalogNames.add(node.name.text);
          addedAlias = true;
        }
        ts.forEachChild(node, collectAliases);
      }
      collectAliases(source);
    } while (addedAlias);
    const catalogFields = ['flags', 'mechFlags', 'chanceToIgnite'];
    const rawFields = [
      'layers',
      'terrain',
      'rememberedLayers',
      'rememberedTerrainFlags',
      'rememberedTMFlags'
    ];
    function visit(node, scope = '<module>') {
      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isMethodDeclaration(node) ||
          ts.isGetAccessor(node) ||
          ts.isSetAccessor(node)) &&
        node.name
      )
        scope = node.name.getText(source);
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      )
        scope = node.name.getText(source);
      let kind;
      if (
        ts.isCallExpression(node) &&
        /^(setTerrain|setTerrainLayer|refreshTerrainProperties)$/.test(called(node.expression))
      )
        kind = 'write';
      else if (ts.isCallExpression(node) && mechanical.test(called(node.expression)))
        kind = 'mechanical';
      else if (ts.isCallExpression(node) && rawCalls.test(called(node.expression))) kind = 'raw';
      else if (ts.isElementAccessExpression(node)) {
        const field = ts.isStringLiteral(node.argumentExpression)
          ? node.argumentExpression.text
          : '';
        if (['isPassable', 'isOpaque'].includes(field)) kind = 'mechanical';
        else if (rawFields.includes(field)) kind = 'raw';
        else if (
          isCatalog(node.expression) &&
          !(
            ts.isPropertyAccessExpression(node.parent) &&
            catalogFields.includes(node.parent.name.text)
          )
        )
          kind = 'raw';
      } else if (ts.isBindingElement(node)) {
        const field = (node.propertyName ?? node.name).getText(source).replace(/^['"]|['"]$/g, '');
        if (['isPassable', 'isOpaque'].includes(field)) kind = 'mechanical';
        else if (rawFields.includes(field)) kind = 'raw';
      } else if (ts.isPropertyAccessExpression(node)) {
        if (['isPassable', 'isOpaque'].includes(node.name.text)) kind = 'mechanical';
        else if (rawFields.includes(node.name.text)) kind = 'raw';
        else if (
          catalogFields.includes(node.name.text) &&
          [...catalogNames].some((n) =>
            new RegExp(`\\b${n}\\b`).test(node.expression.getText(source))
          )
        )
          kind = 'raw';
      }
      if (kind) {
        let parent = node;
        while (parent.parent && !ts.isStatement(parent) && !ts.isVariableDeclaration(parent))
          parent = parent.parent;
        const statement = normalize(parent.getText(source));
        const write =
          /^(?:[^=]+\.(?:layers|terrain|isPassable|isOpaque)(?:\[[^\]]+\])?\s*=)/.test(statement) ||
          (ts.isBinaryExpression(node.parent) &&
            node.parent.left === node &&
            node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken);
        const expression = normalize(node.getText(source));
        rows.push({
          file: relative,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          scope,
          expression,
          statement,
          kind: write ? 'write' : kind,
          key: createHash('sha256')
            .update(`${relative}|${scope}|${expression}|${statement}`)
            .digest('hex')
        });
      }
      ts.forEachChild(node, (child) => visit(child, scope));
    }
    visit(source);
  }
  walk(path.join(root, 'src'));
  return rows.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.expression.localeCompare(b.expression)
  );
}
export function checkStructureReaders(root) {
  const manifest = JSON.parse(
    readFileSync(path.join(root, 'scripts/structure-readers.json'), 'utf8')
  );
  const expected = new Map(manifest.raw.map((row) => [row.key, row.count]));
  const actual = new Map();
  for (const row of terrainReaderInventory(root))
    if (row.kind !== 'mechanical') actual.set(row.key, (actual.get(row.key) ?? 0) + 1);
  const errors = [];
  for (const [key, count] of actual)
    if (expected.get(key) !== count)
      errors.push(`Unreviewed raw terrain reader (${count}): ${key}`);
  for (const key of expected.keys())
    if (!actual.has(key)) errors.push(`Stale raw terrain reader: ${key}`);
  const grid = readFileSync(path.join(root, 'src/engine/Map/Grid.ts'), 'utf8');
  if (!/flags\s*=\s*composedCellFlags\(this,\s*flags\)/.test(grid))
    errors.push('Cell cache bypasses composition');
  const df = readFileSync(path.join(root, 'src/engine/Map/DungeonFeature.ts'), 'utf8');
  if (!/return composedCellFlags\(cell,\s*f\)/.test(df))
    errors.push('Four-layer flags bypass composition');
  return errors;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const errors = checkStructureReaders(process.cwd());
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('C5 terrain reader inventory and mechanical composition verified.');
}
