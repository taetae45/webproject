const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const COVERAGE_DIR = path.join(ROOT, 'coverage', 'v8');
const OUTPUT = path.join(ROOT, 'coverage', 'lcov.info');
const fileData = new Map();
let totalLines = 0;
let coveredLines = 0;

for (const name of fs.readdirSync(COVERAGE_DIR).filter(name => name.endsWith('.json'))) {
    const report = JSON.parse(fs.readFileSync(path.join(COVERAGE_DIR, name), 'utf8'));
    for (const script of report.result || []) {
        if (!script.url.startsWith('file:')) continue;
        const sourceFile = fileURLToPath(script.url);
        if (!sourceFile.startsWith(path.join(ROOT, 'frontend', 'js') + path.sep)) continue;
        const source = fs.readFileSync(sourceFile, 'utf8');
        // Keep carriage returns in each line so offsets remain aligned with V8's UTF-16 positions.
        const lines = source.split('\n');
        const offsets = [];
        let offset = 0;
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            if (line.trim() && !line.trimStart().startsWith('//')) {
                const leading = line.length - line.trimStart().length;
                offsets.push([index + 1, offset + leading]);
            }
            offset += line.length + 1;
        }

        const ranges = (script.functions || []).flatMap(fn => fn.ranges || []);
        let byLine = fileData.get(sourceFile);
        if (!byLine) fileData.set(sourceFile, byLine = new Map());
        for (const [line, position] of offsets) {
            const containing = ranges.filter(range => range.startOffset <= position && position < range.endOffset);
            const mostSpecific = containing.sort((a, b) => (a.endOffset - a.startOffset) - (b.endOffset - b.startOffset))[0];
            const hits = mostSpecific?.count || 0;
            byLine.set(line, Math.max(byLine.get(line) || 0, hits));
        }
    }
}

const records = [];
for (const [sourceFile, lines] of [...fileData].sort(([a], [b]) => a.localeCompare(b))) {
    const relative = path.relative(ROOT, sourceFile).split(path.sep).join('/');
    totalLines += lines.size;
    coveredLines += [...lines.values()].filter(hits => hits > 0).length;
    records.push('TN:');
    records.push(`SF:${relative}`);
    for (const [line, hits] of [...lines].sort(([a], [b]) => a - b)) records.push(`DA:${line},${hits}`);
    records.push('end_of_record');
}
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${records.join('\n')}\n`);
console.log(`Wrote ${fileData.size} JavaScript file records to ${path.relative(ROOT, OUTPUT)}`);
console.log(`JavaScript line coverage: ${coveredLines}/${totalLines} (${totalLines ? (coveredLines / totalLines * 100).toFixed(1) : '0.0'}%)`);
