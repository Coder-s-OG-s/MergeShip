const fs = require('fs');
const ts = require('typescript');
const source = fs.readFileSync('src/app/(app)/maintainer/mentorship/page.tsx', 'utf8');
const file = ts.createSourceFile(
  'page.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const diagnostics = file.parseDiagnostics.map((d) => ({
  line: d.start ? file.getLineAndCharacterOfPosition(d.start).line + 1 : null,
  message: d.messageText,
}));
console.log(JSON.stringify(diagnostics, null, 2));
