import { findDatabase } from '../catalog/databases.js';
import { findFramework } from '../catalog/frontend.js';
import { findLibrary } from '../catalog/libraries.js';
import { findService } from '../catalog/services.js';
import { hasBackend } from '../selection.js';
import type { PortAssignment, ResolvedProject } from '../types.js';
import { serviceLinks } from './compose.js';

export function rootGitignore(): string {
  return `.env
node_modules/
.idea/
.vscode/
*.iml
.DS_Store
`;
}

/** Debug için backend'i Docker yerine bilgisayarda (IDE'de) çalıştırma */
function ideSection(buildTool: string, framework: string | null): string {
  const run = buildTool === 'gradle' ? './gradlew bootRun' : './mvnw spring-boot:run';
  const frontend = framework
    ? `\n\nFrontend Docker'da çalışmaya devam edebilir. İsteklerini bilgisayarındaki backend'e yönlendirmek için
\`.env\` dosyasına \`API_URL=http://host.docker.internal:8080\` satırını ekle ve frontend'i yeniden başlat:

\`\`\`bash
docker compose up -d --no-deps frontend
\`\`\`

Docker'daki backend'e dönmek için bu satırı silip aynı komutu tekrar çalıştır.`
    : '';
  return `## Backend'i IDE'den çalıştırma (debug için)

Veritabanı ve servisler Docker'da kalır, backend bilgisayarında çalışır:

\`\`\`bash
docker compose stop backend
cd backend
${run}
\`\`\`

IDE'de \`...Application\` sınıfını çalıştırmak da olur. Şifreler ve portlar kökteki \`.env\` dosyasından
otomatik okunur (\`application.properties\` içindeki \`spring.config.import\`), ayrıca ayar gerekmez.${frontend}`;
}

/** Sadece frontend projesi: Docker'sız çalıştırma ve (seçildiyse) Vercel'e yayınlama */
function localFrontendSection(framework: string, vercel: boolean): string {
  const deploy = vercel
    ? `

## Yayınlama (Vercel)

1. Projeyi GitHub'a gönder.
2. [vercel.com](https://vercel.com)'da "Add New → Project" ile depoyu seç. Ayarlar \`vercel.json\`'dan okunur, bir şey değiştirmen gerekmez.
3. Bundan sonra her \`git push\` siteyi otomatik günceller.`
    : '';
  return `## Docker olmadan çalıştırma

\`\`\`bash
cd frontend
npm install
${framework === 'angular' ? 'npm start' : 'npm run dev'}
\`\`\`${deploy}`;
}

export function readme(resolved: ResolvedProject, ports: PortAssignment[]): string {
  const sel = resolved.selection;
  const backend = hasBackend(sel);
  const backendPort = ports.find((p) => p.envName === 'BACKEND_PORT')?.port ?? 8080;
  const framework = sel.frontend.framework ? findFramework(sel.frontend.framework) : null;
  const frontendOptions = framework
    ? framework.options.filter((o) => resolved.frontendOptions.includes(o.id)).map((o) => o.label)
    : [];

  const stack = [
    backend ? `- **Backend:** Spring Boot, Java ${sel.backend.javaVersion}, ${sel.backend.buildTool === 'gradle' ? 'Gradle' : 'Maven'}` : null,
    backend ? `- **Paketler:** ${resolved.dependencies.join(', ')}${resolved.libraries.length ? `, ${resolved.libraries.map((l) => findLibrary(l).label).join(', ')}` : ''}` : null,
    resolved.databases.length ? `- **Veritabanı:** ${resolved.databases.map((d) => findDatabase(d).label).join(', ')}` : null,
    framework ? `- **Frontend:** ${framework.description}${frontendOptions.length ? ` (${frontendOptions.join(', ')})` : ''}` : null,
    resolved.services.length ? `- **Servisler:** ${resolved.services.map((s) => findService(s).label).join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const links = serviceLinks(resolved, ports).map((l) => `| ${l.label} | ${l.url} |`).join('\n');

  const sections: string[] = [];

  const security = backend ? sel.needs.security : undefined;
  if (security === 'basic') {
    sections.push(`## Güvenlik

HTTP Basic kullanılıyor. Kullanıcı adı ve şifre \`.env\` içinde: \`APP_USER\`, \`APP_PASSWORD\`.

\`\`\`bash
curl -u admin:<APP_PASSWORD> http://localhost:${backendPort}/api/...
\`\`\``);
  }
  if (security === 'jwt') {
    sections.push(`## Güvenlik (JWT)

Token al (kullanıcı bilgileri \`.env\` içinde: \`APP_USER\`, \`APP_PASSWORD\`):

\`\`\`bash
curl -X POST http://localhost:${backendPort}/api/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"username":"admin","password":"<APP_PASSWORD>"}'
\`\`\`

Sonraki isteklerde gönder: \`Authorization: Bearer <token>\`

Herkese açık adresler \`SecurityConfig\` sınıfındaki \`PUBLIC\` listesinde.`);
  }
  if (security === 'keycloak') {
    const kc = ports.find((p) => p.envName === 'KEYCLOAK_PORT');
    sections.push(`## Güvenlik (Keycloak)

${kc ? `Keycloak: http://localhost:${kc.port} (yönetici bilgileri \`.env\` içinde).
İlk açılışta \`${sel.name}\` realm'i, \`${sel.name}-app\` istemcisi ve \`demo\` / \`demo\` test kullanıcısı otomatik oluşturulur.

Token al:

\`\`\`bash
curl -X POST http://localhost:${kc.port}/realms/${sel.name}/protocol/openid-connect/token \\
  -d grant_type=password -d client_id=${sel.name}-app -d username=demo -d password=demo
\`\`\`

Sonraki isteklerde gönder: \`Authorization: Bearer <access_token>\`` : 'Keycloak servisi eklenmedi; `spring.security.oauth2.resourceserver.jwt.jwk-set-uri` ayarını kendi kimlik sağlayıcına göre düzenle.'}`);
  }

  if (backend && sel.database.sql) {
    const migration = sel.database.migration === 'flyway'
      ? 'Şema Flyway ile yönetilir: `backend/src/main/resources/db/migration/` altına `V2__aciklama.sql` gibi yeni dosyalar ekle. Çalışmış migration dosyalarını değiştirme.'
      : sel.database.migration === 'liquibase'
        ? 'Şema Liquibase ile yönetilir: `backend/src/main/resources/db/changelog/db.changelog-master.yaml` dosyasına changeSet ekle.'
        : 'Şema Hibernate tarafından otomatik güncellenir (`ddl-auto=update`). Kalıcı projelerde migration aracı önerilir.';
    sections.push(`## Veritabanı

Bağlantı bilgileri \`.env\` dosyasında. ${migration}

Veritabanını tamamen sıfırlamak için: \`docker compose down -v\``);
  }

  return `# ${sel.name}

${stack}

## Çalıştırma

Gereksinim: [Docker Desktop](https://www.docker.com/products/docker-desktop/)

\`\`\`bash
docker compose up -d --build
\`\`\`

| Servis | Adres |
|---|---|
${links}

Portlar \`.env\` dosyasında; değiştirmek istersen oradan düzenle.

## Geliştirme (canlı yenileme)

\`\`\`bash
docker compose watch
\`\`\`

Bu komut açıkken:${framework ? '\n- `frontend/src` altında bir dosyayı kaydettiğinde tarayıcı anında yenilenir.' : ''}${backend ? '\n- `backend/src` altında Java kodu değiştiğinde backend yeniden derlenip başlatılır.' : ''}

${backend ? ideSection(sel.backend.buildTool, framework?.id ?? null) : localFrontendSection(framework!.id, resolved.frontendOptions.includes('vercel'))}

## Sık kullanılan komutlar

| Komut | Ne yapar |
|---|---|
| \`docker compose ps\` | Çalışan servisleri listeler |
| \`docker compose logs -f ${backend ? 'backend' : 'frontend'}\` | ${backend ? 'Backend' : 'Frontend'} loglarını canlı izler |
| \`docker compose down\` | Her şeyi durdurur (veriler korunur) |
${sections.length ? `\n${sections.join('\n\n')}\n` : ''}`;
}
