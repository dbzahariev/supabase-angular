const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'backup-2026-verification.txt');
const report = fs.openSync(reportPath, 'w');
function record(text) {
  fs.writeSync(report, text);
}

record(`Проверка на backup_2026.json\nСтартирано: ${new Date().toISOString()}\n\n`);
console.log(`TXT доклад: ${reportPath}`);

const child = spawn(process.execPath, [path.join(__dirname, 'verify-backup-2026.cjs')], {
  cwd: root,
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  stdio: ['inherit', 'pipe', 'pipe'],
  windowsHide: true,
});

// Record both test failures and source/network errors, while keeping terminal output.
for (const [stream, terminal] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
  stream.setEncoding('utf8');
  stream.on('data', text => {
    record(text);
    terminal.write(text);
  });
}

child.on('error', error => {
  const message = `Тестовете не могат да стартират: ${error.message}\n`;
  record(message);
  process.stderr.write(message);
});

child.on('close', (code, signal) => {
  const exitCode = code ?? 1;
  record(`\nЗавършено: ${new Date().toISOString()}\nКод на завършване: ${exitCode}${signal ? `; сигнал: ${signal}` : ''}\n`);
  fs.closeSync(report);
  console.log(`\nДокладът е записан: ${reportPath}`);
  process.exitCode = exitCode;
});
