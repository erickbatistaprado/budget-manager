import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(
    (entry): string[] => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(filename);
      return /\.tsx$/.test(filename) ? [filename] : [];
    }
  );
}

it('keeps native control styling inside the UI kit', (): void => {
  const root = path.join(process.cwd(), 'src');
  const violations: string[] = [];
  for (const file of [
    ...sourceFiles(path.join(root, 'app')),
    ...sourceFiles(path.join(root, 'components')),
  ]) {
    if (file.includes(`${path.sep}ui${path.sep}`)) continue;
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    function visit(node: ts.Node): void {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === 'react-datepicker'
      ) {
        violations.push(
          `${path.relative(root, file)}: direct react-datepicker import`
        );
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        const attributes = node.attributes.properties;
        const hasClassName = attributes.some(
          (attribute): boolean =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(source) === 'className'
        );
        const fileInput = attributes.some(
          (attribute): boolean =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(source) === 'type' &&
            attribute.initializer !== undefined &&
            ts.isStringLiteral(attribute.initializer) &&
            attribute.initializer.text === 'file'
        );
        const nativeDate =
          tag === 'input' &&
          attributes.some(
            (attribute): boolean =>
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(source) === 'type' &&
              attribute.initializer !== undefined &&
              ts.isStringLiteral(attribute.initializer) &&
              attribute.initializer.text === 'date'
          );
        if (nativeDate)
          violations.push(`${path.relative(root, file)}: native date input`);
        if (tag === 'dialog')
          violations.push(
            `${path.relative(root, file)}: own <dialog>, use SidePanel`
          );
        const centsStep = attributes.some(
          (attribute): boolean =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(source) === 'step' &&
            attribute.initializer !== undefined &&
            /0\.01/.test(attribute.initializer.getText(source))
        );
        if (centsStep)
          violations.push(
            `${path.relative(root, file)}: number field for money, use MoneyInput`
          );
        if (
          hasClassName &&
          (tag === 'button' ||
            tag === 'select' ||
            (tag === 'input' && !fileInput))
        ) {
          const location = source.getLineAndCharacterOfPosition(
            node.getStart(source)
          );
          violations.push(
            `${path.relative(root, file)}:${location.line + 1}: styled <${tag}>`
          );
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(violations).toEqual([]);
});
