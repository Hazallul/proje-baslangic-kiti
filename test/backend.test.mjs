import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { backendFiles } from '../dist/core/generate/backend.js';
import { readme } from '../dist/core/generate/docs.js';
import { applyPreset, resolve, setNeed } from '../dist/core/selection.js';
import { packageNameOf } from '../dist/core/util.js';
import { baseSelection, withDatabase, withFrontend } from './helpers.mjs';

const PKG = 'com.example.demoapp';
const JAVA = 'backend/src/main/java/com/example/demoapp';
const filesOf = (sel) => backendFiles(resolve(sel), PKG);
const propertiesOf = (sel) => filesOf(sel)['backend/src/main/resources/application.properties'];

describe('application.properties', () => {
  it('IDE\'den çalıştırmak için kökteki .env dosyasını okur', () => {
    assert.match(propertiesOf(baseSelection()), /spring\.config\.import=optional:file:\.env\[\.properties\],optional:file:\.\.\/\.env\[\.properties\]/);
  });

  it('yerel veritabanı adresi .env\'deki portu kullanır', () => {
    const props = propertiesOf(withDatabase(baseSelection(), 'mysql'));
    assert.match(props, /spring\.datasource\.url=\$\{DB_URL:jdbc:mysql:\/\/localhost:\$\{DB_PORT:3306\}\/\$\{DB_NAME:app\}\}/);
    assert.match(props, /ddl-auto=validate/);
  });

  it('migration yoksa Hibernate şemayı günceller', () => {
    const sel = withDatabase(baseSelection(), 'postgresql');
    const props = propertiesOf({ ...sel, database: { ...sel.database, migration: 'none' } });
    assert.match(props, /ddl-auto=update/);
  });

  it('Keycloak adresi .env\'deki portu kullanır', () => {
    assert.match(propertiesOf(setNeed(baseSelection(), 'security', 'keycloak')), /localhost:\$\{KEYCLOAK_PORT:8180\}\/realms\/demo-app\//);
  });
});

describe('Java dosyaları', () => {
  it('HelloController isim parametresi alır ve veritabanlarını kontrol eder', () => {
    const hello = filesOf(withDatabase(baseSelection(), 'mysql', ['mongodb', 'redis']))[`${JAVA}/api/HelloController.java`];
    assert.match(hello, /@RequestParam\(required = false\) String name/);
    assert.match(hello, /"Merhaba, " \+ name\.strip\(\) \+ "!"/);
    for (const label of ['MySQL', 'MongoDB', 'Redis']) assert.ok(hello.includes(`checks.put("${label}"`), label);
  });

  it('veritabanı yoksa HelloController bağımlılıksız kalır', () => {
    const hello = filesOf(baseSelection())[`${JAVA}/api/HelloController.java`];
    assert.ok(!hello.includes('JdbcTemplate'));
    assert.ok(!hello.includes('Supplier'));
  });

  it('JWT seçilince güvenlik ayarı ve token endpoint\'i yazılır, Swagger herkese açık kalır', () => {
    const files = filesOf(setNeed(applyPreset(baseSelection(), 'rest-api'), 'security', 'jwt'));
    const security = files[`${JAVA}/config/SecurityConfig.java`];
    assert.ok(files[`${JAVA}/api/AuthController.java`]);
    for (const path of ['/api/hello', '/api/auth/**', '/swagger-ui/**', '/v3/api-docs/**']) {
      assert.ok(security.includes(`"${path}"`), path);
    }
  });

  it('Flyway seçilince ilk migration dosyası oluşur', () => {
    const files = filesOf(withDatabase(baseSelection(), 'mysql'));
    assert.ok(files['backend/src/main/resources/db/migration/V1__init.sql']);
  });

  it('paket adı proje adındaki tireleri atar', () => {
    assert.equal(packageNameOf('com.example', 'siparis-takip'), 'com.example.siparistakip');
  });
});

describe('README', () => {
  const ports = [
    { envName: 'FRONTEND_PORT', label: 'Uygulama', port: 5174, preferred: 5173, url: 'http://localhost:5174' },
    { envName: 'BACKEND_PORT', label: 'Backend API', port: 8080, preferred: 8080, url: 'http://localhost:8080/api/hello' },
  ];

  it('IDE\'den çalıştırma bölümü derleme aracına göre komut verir', () => {
    const maven = readme(resolve(baseSelection()), ports);
    assert.match(maven, /## Backend'i IDE'den çalıştırma/);
    assert.match(maven, /\.\/mvnw spring-boot:run/);
    const gradleSel = baseSelection({ backend: { ...baseSelection().backend, buildTool: 'gradle' } });
    assert.match(readme(resolve(gradleSel), ports), /\.\/gradlew bootRun/);
  });

  it('frontend varsa API_URL ile backend\'i yönlendirmeyi anlatır', () => {
    const text = readme(resolve(withFrontend(baseSelection(), 'react')), ports);
    assert.match(text, /API_URL=http:\/\/host\.docker\.internal:8080/);
    assert.match(text, /http:\/\/localhost:5174/);
  });
});
