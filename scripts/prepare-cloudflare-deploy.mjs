import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const projectRoot = process.cwd();
const configPath = resolve(projectRoot, 'dist', 'server', 'wrangler.json');
const migrationSource = resolve(projectRoot, 'drizzle');
const migrationTarget = resolve(dirname(configPath), 'migrations');

const databaseId = process.env.SYSTEM_MAP_D1_DATABASE_ID?.trim();
const databaseName = process.env.SYSTEM_MAP_D1_DATABASE_NAME?.trim() || 'system-map';
const workerName = process.env.SYSTEM_MAP_WORKER_NAME?.trim() || 'system-map';

if (!databaseId) {
  throw new Error('缺少 SYSTEM_MAP_D1_DATABASE_ID。請先建立 D1，再設定這個環境變數。');
}

if (!existsSync(configPath)) {
  throw new Error('找不到 dist/server/wrangler.json。請先執行 npm run build。');
}

if (!existsSync(migrationSource)) {
  throw new Error('找不到 drizzle migration 目錄。');
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));
config.name = workerName;
config.topLevelName = workerName;
config.d1_databases = [
  {
    binding: 'DB',
    database_name: databaseName,
    database_id: databaseId,
    migrations_dir: 'migrations',
  },
];

mkdirSync(migrationTarget, { recursive: true });
cpSync(migrationSource, migrationTarget, { recursive: true, force: true });
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

console.log(`Cloudflare 設定完成：Worker=${workerName}，D1=${databaseName}`);
