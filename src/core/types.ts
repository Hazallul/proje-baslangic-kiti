/** Kullanıcının yaptığı tüm seçimler. Arayüz, CLI ve kayıtlı şablonlar bu yapıyı paylaşır. */
export interface Selection {
  name: string;
  /** Projenin oluşturulacağı üst klasör */
  location: string;
  backend: BackendSelection;
  /** Aktif ihtiyaçlar: ihtiyaç id'si -> seçilen varyant id'si */
  needs: Record<string, string>;
  database: DatabaseSelection;
  frontend: FrontendSelection;
  /** Ek Docker servisleri (veritabanı container'ları bunlara dahil değil, otomatik eklenir) */
  services: string[];
  git: boolean;
  /** Genel git kimliği yoksa ilk commit için kullanılır (sadece bu depoya yazılır) */
  gitAuthor?: { name: string; email: string };
  /** Oluşturduktan sonra docker compose ile başlat */
  start: boolean;
}

export interface BackendSelection {
  /** Spring Boot backend oluşturulsun mu (false = sadece frontend projesi) */
  enabled: boolean;
  groupId: string;
  javaVersion: string;
  buildTool: BuildTool;
  /** "Tüm paketler"den elle seçilen Initializr bağımlılıkları */
  dependencies: string[];
  /** Initializr'da olmayan ek kütüphaneler (ör. springdoc) */
  libraries: string[];
}

export type BuildTool = 'maven' | 'gradle';

/** Arayüzdeki "Proje türü" seçimi; backend.enabled ve frontend.framework'ten hesaplanır */
export type ProjectKind = 'fullstack' | 'backend' | 'frontend';

export interface DatabaseSelection {
  /** En fazla bir ilişkisel veritabanı (Spring tek datasource otomatik yapılandırır) */
  sql: string | null;
  /** İstenen kadar NoSQL veritabanı */
  nosql: string[];
  migration: 'flyway' | 'liquibase' | 'none';
}

export type FrameworkId = 'react' | 'vue' | 'angular' | 'svelte';

export interface FrontendSelection {
  framework: FrameworkId | null;
  options: string[];
}

/** Seçimlerden hesaplanan nihai liste: ne indirilecek, ne kurulacak */
export interface ResolvedProject {
  selection: Selection;
  /** Initializr'a gönderilecek bağımlılıklar */
  dependencies: string[];
  /** Her bağımlılığın nereden geldiği ("Güvenlik ile eklendi" gibi) */
  dependencySources: Record<string, string>;
  libraries: string[];
  /** Container olarak çalışacak veritabanları */
  databases: string[];
  services: string[];
  frontendOptions: string[];
}

/** Oluşturma sırasında arayüze/CLI'ya gönderilen olaylar */
export type GenerateEvent =
  | { type: 'step'; step: StepId; status: 'running' | 'done' | 'skipped' | 'error'; message?: string }
  | { type: 'log'; text: string }
  | { type: 'info'; message: string };

export type StepId = 'backend' | 'frontend' | 'docker-files' | 'git' | 'docker-build' | 'services';

export interface PortAssignment {
  /** Örn. "BACKEND_PORT" */
  envName: string;
  label: string;
  port: number;
  preferred: number;
  /** Tarayıcıda açılabilir adres (varsa) */
  url?: string;
}

export interface GenerateResult {
  projectDir: string;
  ports: PortAssignment[];
  started: boolean;
  warnings: string[];
  /** .env'e yazılan kullanıcı adları ve şifreler (portlar hariç) */
  credentials: { key: string; value: string }[];
}
