import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type EnvVar, findDatabase } from '../catalog/databases.js';
import { findLibrary } from '../catalog/libraries.js';
import { downloadProject, latestMavenVersion } from '../initializr.js';
import type { ResolvedProject } from '../types.js';
import { packageNameOf, writeFiles } from '../util.js';

export interface StepContext {
  signal?: AbortSignal;
  log: (text: string) => void;
}

export async function generateBackend(resolved: ResolvedProject, projectDir: string, ctx: StepContext): Promise<void> {
  const sel = resolved.selection;
  const pkg = packageNameOf(sel.backend.groupId, sel.name);

  ctx.log(`start.spring.io: ${resolved.dependencies.join(', ')}\n`);
  await downloadProject(
    {
      name: sel.name,
      groupId: sel.backend.groupId,
      packageName: pkg,
      javaVersion: sel.backend.javaVersion,
      buildTool: sel.backend.buildTool,
      dependencies: resolved.dependencies,
    },
    projectDir,
    ctx.signal,
  );

  for (const libId of resolved.libraries) {
    const lib = findLibrary(libId);
    const version = await latestMavenVersion(lib.groupId, lib.artifactId);
    ctx.log(`${lib.groupId}:${lib.artifactId}:${version} ekleniyor\n`);
    addLibrary(join(projectDir, 'backend'), sel.backend.buildTool, lib.groupId, lib.artifactId, version);
  }

  writeFiles(projectDir, backendFiles(resolved, pkg));
}

function addLibrary(backendDir: string, buildTool: string, groupId: string, artifactId: string, version: string): void {
  if (buildTool === 'gradle') {
    const file = join(backendDir, 'build.gradle');
    const content = readFileSync(file, 'utf8').replace(
      /dependencies \{\n/,
      (m) => `${m}\timplementation '${groupId}:${artifactId}:${version}'\n`,
    );
    writeFileSync(file, content);
  } else {
    const file = join(backendDir, 'pom.xml');
    const dependency = `\t\t<dependency>\n\t\t\t<groupId>${groupId}</groupId>\n\t\t\t<artifactId>${artifactId}</artifactId>\n\t\t\t<version>${version}</version>\n\t\t</dependency>\n`;
    // İlk </dependencies> ana bağımlılık listesidir (dependencyManagement ondan sonra gelir)
    const content = readFileSync(file, 'utf8').replace('\t</dependencies>', `${dependency}\t</dependencies>`);
    writeFileSync(file, content);
  }
}

/** Güvenlik seçimine göre .env ve backend container'ına eklenecek değişkenler */
export function securityEnv(resolved: ResolvedProject): { env: EnvVar[]; backendEnv: Record<string, string> } {
  const variant = resolved.selection.needs.security;
  if (variant === 'basic' || variant === 'jwt') {
    const env: EnvVar[] = [
      { key: 'APP_USER', value: 'admin' },
      { key: 'APP_PASSWORD', value: { secret: true } },
    ];
    const backendEnv: Record<string, string> = { APP_USER: '${APP_USER}', APP_PASSWORD: '${APP_PASSWORD}' };
    if (variant === 'jwt') {
      env.push({ key: 'JWT_SECRET', value: { secret: true, length: 48 } });
      backendEnv.JWT_SECRET = '${JWT_SECRET}';
    }
    return { env, backendEnv };
  }
  return { env: [], backendEnv: {} };
}

function backendFiles(resolved: ResolvedProject, pkg: string): Record<string, string> {
  const sel = resolved.selection;
  const javaDir = `backend/src/main/java/${pkg.replaceAll('.', '/')}`;
  const files: Record<string, string> = {
    'backend/Dockerfile': sel.backend.buildTool === 'gradle'
      ? gradleDockerfile(sel.backend.javaVersion)
      : mavenDockerfile(sel.backend.javaVersion),
    'backend/.dockerignore': 'target/\nbuild/\n.gradle/\n.idea/\n.vscode/\n*.iml\n',
    'backend/src/main/resources/application.properties': applicationProperties(resolved),
    [`${javaDir}/api/HelloController.java`]: helloController(pkg, resolved.databases),
  };

  const sql = sel.database.sql ? findDatabase(sel.database.sql) : null;
  if (sql && sel.database.migration === 'flyway') {
    files['backend/src/main/resources/db/migration/V1__init.sql'] = flywayMigration(sql.idColumn ?? 'BIGINT PRIMARY KEY');
  }
  if (sql && sel.database.migration === 'liquibase') {
    files['backend/src/main/resources/db/changelog/db.changelog-master.yaml'] = LIQUIBASE_CHANGELOG;
  }

  const security = sel.needs.security;
  if (security) {
    files[`${javaDir}/config/SecurityConfig.java`] = securityConfig(pkg, security, publicPaths(resolved));
  }
  if (security === 'jwt') {
    files[`${javaDir}/api/AuthController.java`] = authController(pkg, sel.name);
  }
  return files;
}

function publicPaths(resolved: ResolvedProject): string[] {
  const paths = ['/api/hello', '/error', '/actuator/health/**'];
  if (resolved.selection.needs.security === 'jwt') paths.push('/api/auth/**');
  if (resolved.dependencies.includes('prometheus')) paths.push('/actuator/prometheus');
  if (resolved.libraries.includes('springdoc')) paths.push('/swagger-ui.html', '/swagger-ui/**', '/v3/api-docs/**');
  return paths;
}

function mavenDockerfile(java: string): string {
  return `# Derleme: Maven ile jar üretilir. Önbellek sayesinde bağımlılıklar her seferinde inmez.
FROM maven:3.9-eclipse-temurin-${java} AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q -DskipTests package

# Çalıştırma: sadece JRE + jar
FROM eclipse-temurin:${java}-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
`;
}

function gradleDockerfile(java: string): string {
  return `# Derleme: Gradle ile jar üretilir. Önbellek sayesinde bağımlılıklar her seferinde inmez.
FROM gradle:jdk${java} AS build
WORKDIR /app
COPY build.gradle settings.gradle ./
COPY src ./src
RUN --mount=type=cache,target=/home/gradle/.gradle gradle bootJar --no-daemon -q

# Çalıştırma: sadece JRE + jar
FROM eclipse-temurin:${java}-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
`;
}

function applicationProperties(resolved: ResolvedProject): string {
  const sel = resolved.selection;
  const deps = new Set(resolved.dependencies);
  const sections: string[][] = [[`spring.application.name=${sel.name}`, 'server.port=8080']];

  // Docker içinde compose.yaml ortam değişkenlerini verir; yerelde localhost varsayılanları geçerli
  for (const dbId of resolved.databases) {
    const db = findDatabase(dbId);
    const lines = [`# ${db.label}`, ...db.properties];
    if (db.kind === 'sql') {
      lines.push(
        `spring.jpa.hibernate.ddl-auto=${sel.database.migration === 'none' ? 'update' : 'validate'}`,
        'spring.jpa.open-in-view=false',
      );
    }
    sections.push(lines);
  }

  if (deps.has('kafka')) {
    sections.push(['# Kafka', 'spring.kafka.bootstrap-servers=${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}']);
  }
  if (deps.has('rabbitmq')) {
    sections.push([
      '# RabbitMQ',
      'spring.rabbitmq.host=${RABBITMQ_HOST:localhost}',
      'spring.rabbitmq.username=${RABBITMQ_USER:guest}',
      'spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}',
    ]);
  }
  if (deps.has('mail')) {
    sections.push(['# E-posta', 'spring.mail.host=${MAIL_HOST:localhost}', 'spring.mail.port=${MAIL_PORT:1025}']);
  }
  if (deps.has('actuator')) {
    const endpoints = deps.has('prometheus') ? 'health,info,prometheus' : 'health,info';
    sections.push(['# Actuator', `management.endpoints.web.exposure.include=${endpoints}`]);
  }

  const security = sel.needs.security;
  if (security === 'basic' || security === 'jwt') {
    const lines = ['# Güvenlik (kullanıcı bilgileri .env dosyasında)'];
    if (security === 'basic') {
      lines.push('spring.security.user.name=${APP_USER:admin}', 'spring.security.user.password=${APP_PASSWORD:admin}');
    } else {
      lines.push(
        'app.user.name=${APP_USER:admin}',
        'app.user.password=${APP_PASSWORD:admin}',
        '# En az 32 karakter olmalı',
        'app.jwt.secret=${JWT_SECRET:local-development-secret-change-me-please}',
      );
    }
    sections.push(lines);
  }
  if (security === 'keycloak') {
    sections.push([
      '# Keycloak tokenlarını doğrulamak için açık anahtarlar',
      `spring.security.oauth2.resourceserver.jwt.jwk-set-uri=\${JWT_JWK_SET_URI:http://localhost:8180/realms/${sel.name}/protocol/openid-connect/certs}`,
    ]);
  }

  return sections.map((s) => s.join('\n')).join('\n\n') + '\n';
}

/** /api/hello: kurulumun çalıştığını ve veritabanı bağlantılarını gösteren örnek endpoint */
function helloController(pkg: string, databases: string[]): string {
  interface Check { label: string; imports: string[]; field: string; type: string; expr: string }
  const checks: Check[] = [];
  const sql = databases.map(findDatabase).find((d) => d.kind === 'sql');
  if (sql) {
    checks.push({
      label: sql.label,
      imports: ['org.springframework.jdbc.core.JdbcTemplate'],
      field: 'jdbc',
      type: 'JdbcTemplate',
      expr: 'jdbc.queryForObject("SELECT 1", Integer.class)',
    });
  }
  if (databases.includes('mongodb')) {
    checks.push({
      label: 'MongoDB',
      imports: ['org.springframework.data.mongodb.core.MongoTemplate'],
      field: 'mongo',
      type: 'MongoTemplate',
      expr: 'mongo.executeCommand("{ ping: 1 }")',
    });
  }
  if (databases.includes('redis')) {
    checks.push({
      label: 'Redis',
      imports: ['org.springframework.data.redis.core.StringRedisTemplate'],
      field: 'redis',
      type: 'StringRedisTemplate',
      expr: 'redis.hasKey("health-check")',
    });
  }

  const imports = [
    'java.time.Instant',
    'java.util.LinkedHashMap',
    'java.util.Map',
    ...(checks.length ? ['java.util.function.Supplier'] : []),
    ...checks.flatMap((c) => c.imports),
    'org.springframework.web.bind.annotation.GetMapping',
    'org.springframework.web.bind.annotation.RequestMapping',
    'org.springframework.web.bind.annotation.RestController',
  ];
  const javaImports = imports.filter((i) => i.startsWith('java.'));
  const otherImports = imports.filter((i) => !i.startsWith('java.')).sort();

  const fields = checks.map((c) => `    private final ${c.type} ${c.field};`).join('\n');
  const ctorParams = checks.map((c) => `${c.type} ${c.field}`).join(', ');
  const ctorBody = checks.map((c) => `        this.${c.field} = ${c.field};`).join('\n');
  const checkLines = checks.map((c) => `        checks.put("${c.label}", status(() -> ${c.expr}));`).join('\n');

  return `package ${pkg}.api;

${javaImports.map((i) => `import ${i};`).join('\n')}

${otherImports.map((i) => `import ${i};`).join('\n')}

/** Kurulumun çalıştığını gösteren örnek endpoint. İstediğin zaman silebilirsin. */
@RestController
@RequestMapping("/api")
public class HelloController {
${checks.length ? `
${fields}

    public HelloController(${ctorParams}) {
${ctorBody}
    }
` : ''}
    @GetMapping("/hello")
    public Map<String, Object> hello() {
        Map<String, String> checks = new LinkedHashMap<>();
${checkLines}
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Backend çalışıyor");
        body.put("checks", checks);
        body.put("time", Instant.now().toString());
        return body;
    }
${checks.length ? `
    private static String status(Supplier<?> check) {
        try {
            check.get();
            return "ok";
        } catch (Exception e) {
            return "error";
        }
    }
` : ''}}
`;
}

function flywayMigration(idColumn: string): string {
  return `-- İlk migration. Yeni tablolar için V2__aciklama.sql, V3__... şeklinde dosya ekle.
-- Çalışmış bir migration dosyasını sonradan değiştirme; yeni dosya oluştur.
--
-- Örnek:
-- CREATE TABLE notes (
--     id ${idColumn},
--     title VARCHAR(255) NOT NULL
-- );
`;
}

const LIQUIBASE_CHANGELOG = `# Liquibase ana changelog dosyası. Değişiklikleri changeSet olarak ekle.
# Örnek:
# databaseChangeLog:
#   - changeSet:
#       id: 1
#       author: dev
#       changes:
#         - createTable:
#             tableName: notes
#             columns:
#               - column: { name: id, type: BIGINT, autoIncrement: true, constraints: { primaryKey: true } }
#               - column: { name: title, type: VARCHAR(255) }
databaseChangeLog: []
`;

function securityConfig(pkg: string, variant: string, publicPaths: string[]): string {
  const matchers = publicPaths.map((p) => `"${p}"`).join(', ');

  if (variant === 'basic') {
    return `package ${pkg}.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * HTTP Basic güvenlik. Kullanıcı adı ve şifre .env dosyasındaki APP_USER / APP_PASSWORD.
 * Herkese açık adresler PUBLIC listesinde.
 */
@Configuration
public class SecurityConfig {

    private static final String[] PUBLIC = { ${matchers} };

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC).permitAll()
                        .anyRequest().authenticated())
                .httpBasic(Customizer.withDefaults());
        return http.build();
    }
}
`;
  }

  if (variant === 'keycloak') {
    return `package ${pkg}.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Keycloak'un verdiği JWT tokenlarını doğrular (OAuth2 Resource Server).
 * Token almak için README'deki "Keycloak" bölümüne bak.
 */
@Configuration
public class SecurityConfig {

    private static final String[] PUBLIC = { ${matchers} };

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC).permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
`;
  }

  // jwt
  return `package ${pkg}.config;

import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

import com.nimbusds.jose.jwk.source.ImmutableSecret;

/**
 * JWT tabanlı güvenlik. POST /api/auth/token ile token alınır, diğer isteklerde
 * "Authorization: Bearer <token>" başlığı gönderilir.
 *
 * Başlangıç için tek bir bellek içi kullanıcı var (.env: APP_USER / APP_PASSWORD).
 * Gerçek kullanıcılar için UserDetailsService'i veritabanından okuyan bir sınıfla değiştir.
 */
@Configuration
public class SecurityConfig {

    private static final String[] PUBLIC = { ${matchers} };

    private final SecretKey key;

    public SecurityConfig(@Value("\${app.jwt.secret}") String secret) {
        this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC).permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }

    @Bean
    JwtEncoder jwtEncoder() {
        return new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    @Bean
    UserDetailsService userDetailsService(
            @Value("\${app.user.name}") String username,
            @Value("\${app.user.password}") String password) {
        return new InMemoryUserDetailsManager(
                User.withUsername(username).password("{noop}" + password).roles("USER").build());
    }

    @Bean
    AuthenticationManager authenticationManager(UserDetailsService userDetailsService) {
        return new ProviderManager(new DaoAuthenticationProvider(userDetailsService));
    }
}
`;
}

function authController(pkg: string, issuer: string): string {
  return `package ${pkg}.api;

import java.time.Instant;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Kullanıcı adı ve şifreyle JWT token verir. Hatalı bilgide 401 döner. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final long EXPIRES_IN_SECONDS = 3600;

    private final AuthenticationManager authenticationManager;
    private final JwtEncoder jwtEncoder;

    public AuthController(AuthenticationManager authenticationManager, JwtEncoder jwtEncoder) {
        this.authenticationManager = authenticationManager;
        this.jwtEncoder = jwtEncoder;
    }

    public record LoginRequest(String username, String password) {
    }

    public record TokenResponse(String token, long expiresIn) {
    }

    @PostMapping("/token")
    public TokenResponse token(@RequestBody LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(request.username(), request.password()));

        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("${issuer}")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(EXPIRES_IN_SECONDS))
                .subject(auth.getName())
                .claim("roles", auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).toList())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new TokenResponse(token, EXPIRES_IN_SECONDS);
    }
}
`;
}
