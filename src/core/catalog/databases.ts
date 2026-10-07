/**
 * Veritabanı kataloğu. Yeni bir veritabanı eklemek için bu listeye bir kayıt eklemek yeterli.
 *
 * Compose blokları `${...}` ile .env dosyasındaki değişkenleri kullanır; `env` alanı bu
 * değişkenlerin .env'e yazılacak değerlerini tanımlar ("secret" = rastgele şifre üretilir).
 */

export interface EnvVar {
  key: string;
  value: string | { secret: true; suffix?: string; length?: number };
}

export interface DatabaseDef {
  id: string;
  label: string;
  kind: 'sql' | 'nosql';
  description: string;
  /** Initializr bağımlılıkları */
  dependencies: string[];
  /** Compose'daki servis adı */
  service: string;
  port: { envName: string; container: number; preferred: number };
  env: EnvVar[];
  /** compose.yaml'a eklenecek servis blok(lar)ı, 2 boşluk girintili */
  compose: string;
  /** Backend container'ına verilecek ortam değişkenleri */
  backendEnv: Record<string, string>;
  /** Backend başlamadan önce beklenecek servisler */
  backendDependsOn: Record<string, 'service_healthy' | 'service_completed_successfully'>;
  /** application.properties satırları (yerelde çalıştırma için localhost varsayılanlarıyla) */
  properties: string[];
  volume: string;
  /** Flyway örnek migration'ında kullanılacak id kolonu */
  idColumn?: string;
}

const healthcheck = (test: string) => `    healthcheck:
      test: ${test}
      interval: 5s
      timeout: 5s
      retries: 30`;

export const DATABASES: DatabaseDef[] = [
  {
    id: 'mysql',
    label: 'MySQL',
    kind: 'sql',
    description: 'En yaygın açık kaynak ilişkisel veritabanı',
    dependencies: ['data-jpa', 'mysql'],
    service: 'db',
    port: { envName: 'DB_PORT', container: 3306, preferred: 3306 },
    env: [
      { key: 'DB_NAME', value: 'app' },
      { key: 'DB_USER', value: 'app' },
      { key: 'DB_PASSWORD', value: { secret: true } },
      { key: 'DB_ROOT_PASSWORD', value: { secret: true } },
    ],
    compose: `  db:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: \${DB_NAME}
      MYSQL_USER: \${DB_USER}
      MYSQL_PASSWORD: \${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: \${DB_ROOT_PASSWORD}
    ports:
      - "\${DB_PORT}:3306"
    volumes:
      - db-data:/var/lib/mysql
${healthcheck('["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-u", "root", "-p${DB_ROOT_PASSWORD}"]')}`,
    backendEnv: {
      DB_URL: 'jdbc:mysql://db:3306/${DB_NAME}',
      DB_USER: '${DB_USER}',
      DB_PASSWORD: '${DB_PASSWORD}',
    },
    backendDependsOn: { db: 'service_healthy' },
    properties: [
      'spring.datasource.url=${DB_URL:jdbc:mysql://localhost:${DB_PORT:3306}/${DB_NAME:app}}',
      'spring.datasource.username=${DB_USER:app}',
      'spring.datasource.password=${DB_PASSWORD:app}',
    ],
    volume: 'db-data',
    idColumn: 'BIGINT AUTO_INCREMENT PRIMARY KEY',
  },
  {
    id: 'postgresql',
    label: 'PostgreSQL',
    kind: 'sql',
    description: 'Gelişmiş özellikli açık kaynak ilişkisel veritabanı',
    dependencies: ['data-jpa', 'postgresql'],
    service: 'db',
    port: { envName: 'DB_PORT', container: 5432, preferred: 5432 },
    env: [
      { key: 'DB_NAME', value: 'app' },
      { key: 'DB_USER', value: 'app' },
      { key: 'DB_PASSWORD', value: { secret: true } },
    ],
    compose: `  db:
    image: postgres:17
    environment:
      POSTGRES_DB: \${DB_NAME}
      POSTGRES_USER: \${DB_USER}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    ports:
      - "\${DB_PORT}:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
${healthcheck('["CMD-SHELL", "pg_isready -h 127.0.0.1 -U ${DB_USER} -d ${DB_NAME}"]')}`,
    backendEnv: {
      DB_URL: 'jdbc:postgresql://db:5432/${DB_NAME}',
      DB_USER: '${DB_USER}',
      DB_PASSWORD: '${DB_PASSWORD}',
    },
    backendDependsOn: { db: 'service_healthy' },
    properties: [
      'spring.datasource.url=${DB_URL:jdbc:postgresql://localhost:${DB_PORT:5432}/${DB_NAME:app}}',
      'spring.datasource.username=${DB_USER:app}',
      'spring.datasource.password=${DB_PASSWORD:app}',
    ],
    volume: 'db-data',
    idColumn: 'BIGSERIAL PRIMARY KEY',
  },
  {
    id: 'mariadb',
    label: 'MariaDB',
    kind: 'sql',
    description: 'MySQL uyumlu, topluluk odaklı veritabanı',
    dependencies: ['data-jpa', 'mariadb'],
    service: 'db',
    port: { envName: 'DB_PORT', container: 3306, preferred: 3306 },
    env: [
      { key: 'DB_NAME', value: 'app' },
      { key: 'DB_USER', value: 'app' },
      { key: 'DB_PASSWORD', value: { secret: true } },
      { key: 'DB_ROOT_PASSWORD', value: { secret: true } },
    ],
    compose: `  db:
    image: mariadb:11
    environment:
      MARIADB_DATABASE: \${DB_NAME}
      MARIADB_USER: \${DB_USER}
      MARIADB_PASSWORD: \${DB_PASSWORD}
      MARIADB_ROOT_PASSWORD: \${DB_ROOT_PASSWORD}
    ports:
      - "\${DB_PORT}:3306"
    volumes:
      - db-data:/var/lib/mysql
${healthcheck('["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]')}`,
    backendEnv: {
      DB_URL: 'jdbc:mariadb://db:3306/${DB_NAME}',
      DB_USER: '${DB_USER}',
      DB_PASSWORD: '${DB_PASSWORD}',
    },
    backendDependsOn: { db: 'service_healthy' },
    properties: [
      'spring.datasource.url=${DB_URL:jdbc:mariadb://localhost:${DB_PORT:3306}/${DB_NAME:app}}',
      'spring.datasource.username=${DB_USER:app}',
      'spring.datasource.password=${DB_PASSWORD:app}',
    ],
    volume: 'db-data',
    idColumn: 'BIGINT AUTO_INCREMENT PRIMARY KEY',
  },
  {
    id: 'sqlserver',
    label: 'SQL Server',
    kind: 'sql',
    description: 'Microsoft SQL Server 2022 (Developer sürümü)',
    dependencies: ['data-jpa', 'sqlserver'],
    service: 'db',
    port: { envName: 'DB_PORT', container: 1433, preferred: 1433 },
    env: [
      { key: 'DB_NAME', value: 'app' },
      // SQL Server şifrede büyük/küçük harf ve rakam ister
      { key: 'DB_PASSWORD', value: { secret: true, suffix: 'Aa1' } },
    ],
    compose: `  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: \${DB_PASSWORD}
    ports:
      - "\${DB_PORT}:1433"
    volumes:
      - db-data:/var/opt/mssql
${healthcheck('["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P \\"$$MSSQL_SA_PASSWORD\\" -Q \\"SELECT 1\\" || exit 1"]')}

  # SQL Server veritabanını kendisi oluşturmaz; bu tek seferlik servis oluşturur
  db-init:
    image: mcr.microsoft.com/mssql/server:2022-latest
    depends_on:
      db:
        condition: service_healthy
    environment:
      MSSQL_SA_PASSWORD: \${DB_PASSWORD}
      DB_NAME: \${DB_NAME}
    entrypoint: ["/bin/bash", "-c", "/opt/mssql-tools18/bin/sqlcmd -C -S db -U sa -P \\"$$MSSQL_SA_PASSWORD\\" -Q \\"IF DB_ID('$$DB_NAME') IS NULL CREATE DATABASE [$$DB_NAME]\\""]
    restart: "no"`,
    backendEnv: {
      DB_URL: 'jdbc:sqlserver://db:1433;databaseName=${DB_NAME};encrypt=true;trustServerCertificate=true',
      DB_USER: 'sa',
      DB_PASSWORD: '${DB_PASSWORD}',
    },
    backendDependsOn: { 'db-init': 'service_completed_successfully' },
    properties: [
      'spring.datasource.url=${DB_URL:jdbc:sqlserver://localhost:${DB_PORT:1433};databaseName=${DB_NAME:app};encrypt=true;trustServerCertificate=true}',
      'spring.datasource.username=${DB_USER:sa}',
      'spring.datasource.password=${DB_PASSWORD:}',
    ],
    volume: 'db-data',
    idColumn: 'BIGINT IDENTITY(1,1) PRIMARY KEY',
  },
  {
    id: 'mongodb',
    label: 'MongoDB',
    kind: 'nosql',
    description: 'Doküman tabanlı NoSQL veritabanı',
    dependencies: ['data-mongodb'],
    service: 'mongodb',
    port: { envName: 'MONGO_PORT', container: 27017, preferred: 27017 },
    env: [
      { key: 'MONGO_USER', value: 'app' },
      { key: 'MONGO_PASSWORD', value: { secret: true } },
    ],
    compose: `  mongodb:
    image: mongo:8
    environment:
      MONGO_INITDB_ROOT_USERNAME: \${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: \${MONGO_PASSWORD}
    ports:
      - "\${MONGO_PORT}:27017"
    volumes:
      - mongo-data:/data/db
${healthcheck('["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand(\'ping\')"]')}`,
    backendEnv: {
      MONGODB_URI: 'mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongodb:27017/app?authSource=admin',
    },
    backendDependsOn: { mongodb: 'service_healthy' },
    properties: ['spring.mongodb.uri=${MONGODB_URI:mongodb://${MONGO_USER:app}:${MONGO_PASSWORD:app}@localhost:${MONGO_PORT:27017}/app?authSource=admin}'],
    volume: 'mongo-data',
  },
  {
    id: 'redis',
    label: 'Redis',
    kind: 'nosql',
    description: 'Bellek içi anahtar-değer deposu (önbellek, oturum, kuyruk)',
    dependencies: ['data-redis'],
    service: 'redis',
    port: { envName: 'REDIS_PORT', container: 6379, preferred: 6379 },
    env: [],
    compose: `  redis:
    image: redis:7-alpine
    ports:
      - "\${REDIS_PORT}:6379"
    volumes:
      - redis-data:/data
${healthcheck('["CMD", "redis-cli", "ping"]')}`,
    backendEnv: { REDIS_HOST: 'redis' },
    backendDependsOn: { redis: 'service_healthy' },
    properties: [
      'spring.data.redis.host=${REDIS_HOST:localhost}',
      'spring.data.redis.port=${REDIS_PORT:6379}',
    ],
    volume: 'redis-data',
  },
  {
    id: 'elasticsearch',
    label: 'Elasticsearch',
    kind: 'nosql',
    description: 'Tam metin arama ve analiz motoru',
    dependencies: ['data-elasticsearch'],
    service: 'elasticsearch',
    port: { envName: 'ELASTICSEARCH_PORT', container: 9200, preferred: 9200 },
    env: [],
    compose: `  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:9.1.5
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
      ES_JAVA_OPTS: -Xms512m -Xmx512m
    ports:
      - "\${ELASTICSEARCH_PORT}:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
${healthcheck('["CMD-SHELL", "curl -fs http://localhost:9200/_cluster/health || exit 1"]')}`,
    backendEnv: { ELASTICSEARCH_URIS: 'http://elasticsearch:9200' },
    backendDependsOn: { elasticsearch: 'service_healthy' },
    properties: ['spring.elasticsearch.uris=${ELASTICSEARCH_URIS:http://localhost:${ELASTICSEARCH_PORT:9200}}'],
    volume: 'elasticsearch-data',
  },
];

export function findDatabase(id: string): DatabaseDef {
  const db = DATABASES.find((d) => d.id === id);
  if (!db) throw new Error(`Bilinmeyen veritabanı: ${id}`);
  return db;
}
