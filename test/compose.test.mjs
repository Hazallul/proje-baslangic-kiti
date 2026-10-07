import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DATABASES } from '../dist/core/catalog/databases.js';
import { SERVICES } from '../dist/core/catalog/services.js';
import {
  composeFile,
  credentialsOf,
  envFile,
  parseEnv,
  portsFromEnv,
  serviceLinks,
} from '../dist/core/generate/compose.js';
import { applyPreset, resolve, setNeed } from '../dist/core/selection.js';
import { baseSelection, withDatabase, withFrontend } from './helpers.mjs';

const mysqlProject = () => resolve(withFrontend(withDatabase(baseSelection(), 'mysql'), 'react'));

describe('compose.yaml', () => {
  it('veritabanı sağlık kontrolü TCP ile yapılır (kurulum sunucusu "hazır" sayılmaz)', () => {
    const compose = composeFile(resolve(withDatabase(baseSelection(), 'mysql')));
    assert.match(compose, /mysqladmin", "ping", "-h", "127\.0\.0\.1"/);
    const pg = composeFile(resolve(withDatabase(baseSelection(), 'postgresql')));
    assert.match(pg, /pg_isready -h 127\.0\.0\.1/);
  });

  it('backend veritabanını bekler ve hata olursa yeniden dener', () => {
    const compose = composeFile(mysqlProject());
    assert.match(compose, /restart: on-failure:5/);
    assert.match(compose, /db:\n\s+condition: service_healthy/);
  });

  it('frontend API adresi .env ile değiştirilebilir', () => {
    assert.match(composeFile(mysqlProject()), /API_URL: "\$\{API_URL:-http:\/\/backend:8080\}"/);
  });

  it('her veritabanı ve servis tek başına geçerli bir blok üretir', () => {
    for (const db of DATABASES) {
      const sel = db.kind === 'sql' ? withDatabase(baseSelection(), db.id) : withDatabase(baseSelection(), null, [db.id]);
      const compose = composeFile(resolve(sel));
      assert.ok(compose.includes(`  ${db.service}:`), `${db.id} servisi yok`);
      assert.ok(!compose.includes('\t'), `${db.id}: YAML'da tab olmamalı`);
    }
    for (const service of SERVICES) {
      const db = service.forDatabases?.[0];
      const sel = { ...withDatabase(baseSelection(), db && DATABASES.find((d) => d.id === db).kind === 'sql' ? db : null, db && DATABASES.find((d) => d.id === db).kind === 'nosql' ? [db] : []), services: [service.id] };
      const compose = composeFile(resolve(sel));
      assert.ok(compose.includes(`  ${service.id}:`), `${service.id} servisi yok`);
      assert.ok(!compose.includes('\t'), `${service.id}: YAML'da tab olmamalı`);
    }
  });

  it('proje adını compose proje adı olarak yazar', () => {
    assert.match(composeFile(mysqlProject()), /^name: demo-app\n/);
  });
});

describe('.env', () => {
  const ports = [{ envName: 'BACKEND_PORT', label: 'Backend API', port: 8081, preferred: 8080 }];

  it('.env rastgele şifre, .env.example yer tutucu içerir', () => {
    const resolved = resolve(withDatabase(baseSelection(), 'mysql'));
    const env = parseEnv(envFile(resolved, ports, true));
    const example = parseEnv(envFile(resolved, ports, false));
    assert.match(env.DB_PASSWORD, /^[A-Za-z0-9]{20}$/);
    assert.equal(example.DB_PASSWORD, 'degistir');
    assert.equal(env.BACKEND_PORT, '8081');
  });

  it('JWT seçilince en az 32 karakterlik gizli anahtar üretir', () => {
    const resolved = resolve(setNeed(baseSelection(), 'security', 'jwt'));
    const env = parseEnv(envFile(resolved, ports, true));
    assert.ok(env.JWT_SECRET.length >= 32);
    assert.equal(env.APP_USER, 'admin');
  });

  it('bitiş ekranındaki şifre listesinde portlar ve API_URL yer almaz', () => {
    const creds = credentialsOf('# yorum\nDB_USER=app\nDB_PASSWORD=x1\nDB_PORT=3307\nAPI_URL=http://h\n');
    assert.deepEqual(creds, [{ key: 'DB_USER', value: 'app' }, { key: 'DB_PASSWORD', value: 'x1' }]);
  });
});

describe('portlar', () => {
  it('.env\'deki portları okur, olmayanlar için varsayılanı kullanır', () => {
    const ports = portsFromEnv(mysqlProject(), 'FRONTEND_PORT=5174\nDB_PORT=3307\n');
    const byEnv = Object.fromEntries(ports.map((p) => [p.envName, p]));
    assert.equal(byEnv.FRONTEND_PORT.port, 5174);
    assert.equal(byEnv.FRONTEND_PORT.url, 'http://localhost:5174');
    assert.equal(byEnv.BACKEND_PORT.port, 8080);
    assert.equal(byEnv.BACKEND_PORT.url, 'http://localhost:8080/api/hello');
    assert.equal(byEnv.DB_PORT.port, 3307);
    assert.equal(byEnv.DB_PORT.url, undefined);
  });

  it('Swagger seçiliyse bağlantılara Swagger UI eklenir', () => {
    const resolved = resolve(applyPreset(baseSelection(), 'rest-api'));
    const links = serviceLinks(resolved, portsFromEnv(resolved, 'BACKEND_PORT=8085\n'));
    assert.ok(links.some((l) => l.url === 'http://localhost:8085/swagger-ui.html'));
  });
});
