import type { EnvVar } from './databases.js';

export type ServiceCategory = 'Veritabanı arayüzü' | 'Mesajlaşma' | 'Kimlik' | 'İzleme' | 'Geliştirme';

export interface ServicePort {
  envName: string;
  container: number;
  preferred: number;
  label: string;
  /** Tarayıcıda açılacak bir arayüzü varsa true */
  web?: boolean;
}

export interface ServiceContext {
  projectName: string;
  /** Projedeki veritabanı id'leri */
  databases: string[];
  dependencies: string[];
}

export interface ServiceDef {
  id: string;
  label: string;
  description: string;
  category: ServiceCategory;
  ports: ServicePort[];
  env?: EnvVar[];
  compose: (ctx: ServiceContext) => string;
  /** Servisle birlikte projeye yazılacak yapılandırma dosyaları */
  files?: (ctx: ServiceContext) => Record<string, string>;
  /** Backend container'ına verilecek ortam değişkenleri */
  backendEnv?: Record<string, string> | ((ctx: ServiceContext) => Record<string, string>);
  /** Bu servis olmadan çalışmayan diğer servisler */
  requires?: string[];
  /** Sadece bu veritabanlarından biri seçiliyse anlamlı */
  forDatabases?: string[];
  /** Bu bağımlılık/veritabanı seçilince öneri olarak gösterilir (unlessNeeds: bu ihtiyaç varyantlarından biri seçiliyse önerme) */
  suggestWhen: { dependencies?: string[]; databases?: string[]; unlessNeeds?: Record<string, string[]> };
}

export const SERVICES: ServiceDef[] = [
  {
    id: 'adminer',
    label: 'Adminer',
    description: 'Tarayıcıdan SQL veritabanı yönetimi',
    category: 'Veritabanı arayüzü',
    ports: [{ envName: 'ADMINER_PORT', container: 8080, preferred: 8090, label: 'Adminer', web: true }],
    compose: () => `  adminer:
    image: adminer
    environment:
      ADMINER_DEFAULT_SERVER: db
    ports:
      - "\${ADMINER_PORT}:8080"
    depends_on:
      - db`,
    forDatabases: ['mysql', 'postgresql', 'mariadb', 'sqlserver'],
    suggestWhen: { databases: ['mysql', 'mariadb', 'sqlserver'] },
  },
  {
    id: 'pgadmin',
    label: 'pgAdmin',
    description: 'PostgreSQL için gelişmiş yönetim arayüzü',
    category: 'Veritabanı arayüzü',
    ports: [{ envName: 'PGADMIN_PORT', container: 80, preferred: 5050, label: 'pgAdmin', web: true }],
    env: [
      { key: 'PGADMIN_EMAIL', value: 'admin@example.com' },
      { key: 'PGADMIN_PASSWORD', value: { secret: true } },
    ],
    compose: () => `  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: \${PGADMIN_EMAIL}
      PGADMIN_DEFAULT_PASSWORD: \${PGADMIN_PASSWORD}
    ports:
      - "\${PGADMIN_PORT}:80"
    depends_on:
      - db`,
    forDatabases: ['postgresql'],
    suggestWhen: { databases: ['postgresql'] },
  },
  {
    id: 'mongo-express',
    label: 'Mongo Express',
    description: 'Tarayıcıdan MongoDB yönetimi',
    category: 'Veritabanı arayüzü',
    ports: [{ envName: 'MONGO_EXPRESS_PORT', container: 8081, preferred: 8091, label: 'Mongo Express', web: true }],
    compose: () => `  mongo-express:
    image: mongo-express
    environment:
      ME_CONFIG_MONGODB_URL: mongodb://\${MONGO_USER}:\${MONGO_PASSWORD}@mongodb:27017/?authSource=admin
      ME_CONFIG_BASICAUTH: "false"
    ports:
      - "\${MONGO_EXPRESS_PORT}:8081"
    depends_on:
      mongodb:
        condition: service_healthy`,
    forDatabases: ['mongodb'],
    suggestWhen: { databases: ['mongodb'] },
  },
  {
    id: 'redis-insight',
    label: 'Redis Insight',
    description: 'Redis verilerini görüntüleme ve izleme',
    category: 'Veritabanı arayüzü',
    ports: [{ envName: 'REDIS_INSIGHT_PORT', container: 5540, preferred: 5540, label: 'Redis Insight', web: true }],
    compose: () => `  redis-insight:
    image: redis/redisinsight
    ports:
      - "\${REDIS_INSIGHT_PORT}:5540"
    depends_on:
      - redis`,
    forDatabases: ['redis'],
    suggestWhen: {},
  },
  {
    id: 'rabbitmq',
    label: 'RabbitMQ',
    description: 'Mesaj kuyruğu (yönetim paneliyle)',
    category: 'Mesajlaşma',
    ports: [
      { envName: 'RABBITMQ_PORT', container: 5672, preferred: 5672, label: 'RabbitMQ (AMQP)' },
      { envName: 'RABBITMQ_UI_PORT', container: 15672, preferred: 15672, label: 'RabbitMQ paneli', web: true },
    ],
    env: [
      { key: 'RABBITMQ_USER', value: 'app' },
      { key: 'RABBITMQ_PASSWORD', value: { secret: true } },
    ],
    compose: () => `  rabbitmq:
    image: rabbitmq:4-management
    environment:
      RABBITMQ_DEFAULT_USER: \${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: \${RABBITMQ_PASSWORD}
    ports:
      - "\${RABBITMQ_PORT}:5672"
      - "\${RABBITMQ_UI_PORT}:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 5s
      timeout: 5s
      retries: 30`,
    backendEnv: {
      RABBITMQ_HOST: 'rabbitmq',
      RABBITMQ_USER: '${RABBITMQ_USER}',
      RABBITMQ_PASSWORD: '${RABBITMQ_PASSWORD}',
    },
    suggestWhen: { dependencies: ['rabbitmq'] },
  },
  {
    id: 'kafka',
    label: 'Kafka',
    description: 'Olay akışı platformu (KRaft, tek düğüm)',
    category: 'Mesajlaşma',
    ports: [{ envName: 'KAFKA_PORT', container: 9094, preferred: 9094, label: 'Kafka' }],
    compose: () => `  kafka:
    image: apache/kafka:4.1.0
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093,EXTERNAL://:9094
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,EXTERNAL://localhost:\${KAFKA_PORT}
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
    ports:
      - "\${KAFKA_PORT}:9094"`,
    backendEnv: { KAFKA_BOOTSTRAP_SERVERS: 'kafka:9092' },
    suggestWhen: { dependencies: ['kafka', 'kafka-streams'] },
  },
  {
    id: 'kafka-ui',
    label: 'Kafka UI',
    description: 'Kafka topic ve mesajlarını görüntüleme',
    category: 'Mesajlaşma',
    ports: [{ envName: 'KAFKA_UI_PORT', container: 8080, preferred: 8092, label: 'Kafka UI', web: true }],
    compose: () => `  kafka-ui:
    image: ghcr.io/kafbat/kafka-ui:latest
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
    ports:
      - "\${KAFKA_UI_PORT}:8080"
    depends_on:
      - kafka`,
    requires: ['kafka'],
    suggestWhen: { dependencies: ['kafka', 'kafka-streams'] },
  },
  {
    id: 'keycloak',
    label: 'Keycloak',
    description: 'Kimlik ve erişim yönetimi (OAuth2 / OpenID Connect)',
    category: 'Kimlik',
    ports: [{ envName: 'KEYCLOAK_PORT', container: 8080, preferred: 8180, label: 'Keycloak', web: true }],
    env: [
      { key: 'KEYCLOAK_ADMIN', value: 'admin' },
      { key: 'KEYCLOAK_ADMIN_PASSWORD', value: { secret: true } },
    ],
    compose: () => `  keycloak:
    image: quay.io/keycloak/keycloak:26.4
    command: start-dev --import-realm
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: \${KEYCLOAK_ADMIN}
      KC_BOOTSTRAP_ADMIN_PASSWORD: \${KEYCLOAK_ADMIN_PASSWORD}
    ports:
      - "\${KEYCLOAK_PORT}:8080"
    volumes:
      - ./keycloak:/opt/keycloak/data/import`,
    files: (ctx) => ({ 'keycloak/realm.json': keycloakRealm(ctx.projectName) }),
    backendEnv: (ctx) => ({
      JWT_JWK_SET_URI: `http://keycloak:8080/realms/${ctx.projectName}/protocol/openid-connect/certs`,
    }),
    // JWT/Basic seçiliyse tokenları backend kendisi üretir, Keycloak önermek kafa karıştırır
    suggestWhen: { dependencies: ['oauth2-resource-server', 'oauth2-client'], unlessNeeds: { security: ['jwt', 'basic'] } },
  },
  {
    id: 'mailpit',
    label: 'Mailpit',
    description: 'Gönderilen e-postaları yakalayan test sunucusu',
    category: 'Geliştirme',
    ports: [
      { envName: 'MAILPIT_UI_PORT', container: 8025, preferred: 8025, label: 'Mailpit', web: true },
      { envName: 'MAILPIT_SMTP_PORT', container: 1025, preferred: 1025, label: 'Mailpit SMTP' },
    ],
    compose: () => `  mailpit:
    image: axllent/mailpit
    ports:
      - "\${MAILPIT_UI_PORT}:8025"
      - "\${MAILPIT_SMTP_PORT}:1025"`,
    backendEnv: { MAIL_HOST: 'mailpit', MAIL_PORT: '1025' },
    suggestWhen: { dependencies: ['mail'] },
  },
  {
    id: 'prometheus',
    label: 'Prometheus',
    description: 'Backend metriklerini toplar',
    category: 'İzleme',
    ports: [{ envName: 'PROMETHEUS_PORT', container: 9090, preferred: 9090, label: 'Prometheus', web: true }],
    compose: () => `  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    ports:
      - "\${PROMETHEUS_PORT}:9090"`,
    files: () => ({
      'monitoring/prometheus.yml': `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: backend
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ["backend:8080"]
`,
    }),
    suggestWhen: { dependencies: ['prometheus'] },
  },
  {
    id: 'grafana',
    label: 'Grafana',
    description: 'Metrik panoları (Prometheus bağlı gelir)',
    category: 'İzleme',
    ports: [{ envName: 'GRAFANA_PORT', container: 3000, preferred: 3000, label: 'Grafana', web: true }],
    env: [{ key: 'GRAFANA_PASSWORD', value: { secret: true } }],
    compose: () => `  grafana:
    image: grafana/grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: \${GRAFANA_PASSWORD}
    volumes:
      - ./monitoring/grafana:/etc/grafana/provisioning/datasources:ro
    ports:
      - "\${GRAFANA_PORT}:3000"
    depends_on:
      - prometheus`,
    files: () => ({
      'monitoring/grafana/datasource.yml': `apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
`,
    }),
    requires: ['prometheus'],
    suggestWhen: { dependencies: ['prometheus'] },
  },
];

export function findService(id: string): ServiceDef {
  const service = SERVICES.find((s) => s.id === id);
  if (!service) throw new Error(`Bilinmeyen servis: ${id}`);
  return service;
}

/** Keycloak'a ilk açılışta yüklenen geliştirme realm'i: bir istemci ve bir test kullanıcısı */
function keycloakRealm(projectName: string): string {
  const realm = {
    realm: projectName,
    enabled: true,
    clients: [
      {
        clientId: `${projectName}-app`,
        publicClient: true,
        directAccessGrantsEnabled: true,
        standardFlowEnabled: true,
        redirectUris: ['http://localhost:*'],
        webOrigins: ['+'],
      },
    ],
    users: [
      {
        username: 'demo',
        enabled: true,
        emailVerified: true,
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@example.com',
        credentials: [{ type: 'password', value: 'demo', temporary: false }],
      },
    ],
  };
  return JSON.stringify(realm, null, 2) + '\n';
}
