# create-hazal-app

Spring Boot projelerini **start.spring.io'ya girmeden** kuran masaüstü uygulaması ve CLI.
Backend'i Spring Initializr'ın güncel kataloğundan indirir; isteğe bağlı olarak frontend'i resmi araçlarıyla oluşturur,
veritabanı ve ek servisleri Docker Compose'a ekler ve her şeyi tek tıkla ayağa kaldırır.
Backend gerekmeyen siteler (portfolyo, tanıtım sayfası) için **sadece frontend** projesi de oluşturur.

![Uygulama ikonu](build/icon.png)

## Ne yapar?

| Adım | Nasıl |
|---|---|
| Backend | Spring Initializr API'si (her açılışta canlı katalog, internet yoksa son kayıtlı kopya) |
| Frontend | React / Vue / Svelte için `create-vite`, Angular için Angular CLI; ardından seçilen kütüphaneler kurulup yapılandırılır |
| Veritabanı | Bir ilişkisel (MySQL, PostgreSQL, MariaDB, SQL Server) + istenen kadar NoSQL (MongoDB, Redis, Elasticsearch) |
| Docker | `compose.yaml`, Dockerfile'lar, `.env` (rastgele şifreler), hot reload için `docker compose watch` ayarları |
| Başlatma | `docker compose up`, backend hazır olana kadar bekler, adresleri ve `.env` şifrelerini gösterir; Docker adımı hata verirse "Tekrar başlat" |
| Başlangıç sayfası | Frontend boş gelmez: bağlantı durumunu gösteren ve backend'e "merhaba dünya" isteği atan bir sayfa, seçilen UI kütüphanesinin bileşenleriyle |
| Proje türü | Fullstack, sadece backend veya sadece frontend. Sadece frontend projesinde Spring Boot, veritabanı ve servisler üretilmez; isteğe bağlı `vercel.json` ile ücretsiz yayına hazır gelir |
| Yerel geliştirme | Backend IDE'den çalıştırılınca şifreleri ve portları `.env`'den okur; frontend container'ı `API_URL` ile bilgisayardaki backend'e yönlendirilebilir |

## Seçim katmanları

1. **Hızlı başlangıç şablonları:** Boş proje, REST API, Fullstack web, Güvenli API (JWT), Olay tabanlı servis. Kendi şablonunu da kaydedebilirsin.
2. **İhtiyaçlar:** Sade dilde tikler. Örneğin *Güvenlik → JWT* işaretlenince Spring Security ve OAuth2 Resource Server eklenir, `SecurityConfig` ve `/api/auth/token` endpoint'i yazılır.
3. **Tüm Spring paketleri:** Initializr'ın tüm kataloğu, aranabilir. İhtiyaçlardan gelen paketler kaynağıyla birlikte gösterilir.
4. **Ek servisler:** Hiçbiri varsayılan değil. Seçimlere göre öneri gelir (Kafka seçtiysen Kafka UI, PostgreSQL seçtiysen pgAdmin gibi).

| İhtiyaç | Seçenekler |
|---|---|
| Güvenlik | Kullanıcı adı/şifre, JWT, Keycloak (realm ve test kullanıcısı otomatik) |
| Önbellek | Bellek içi, Redis |
| Mesajlaşma | Kafka (+ Kafka UI), RabbitMQ |
| İzleme | Sağlık kontrolü, Prometheus + Grafana (datasource hazır) |
| Diğer | Girdi doğrulama, Swagger UI, e-posta (+ Mailpit), WebSocket, GraphQL, Quartz |

| Frontend | Seçenekler |
|---|---|
| React | Tailwind, shadcn/ui, Material UI, Ant Design, Mantine, React Router, Zustand, Redux Toolkit, TanStack Query, Axios, Motion (animasyon), çoklu dil (react-i18next, TR/EN), ESLint, Prettier, Vitest, Vercel |
| Vue | Tailwind, Vuetify, PrimeVue, Element Plus, Vue Router, Pinia, TanStack Query, Axios, çoklu dil (vue-i18n, TR/EN), Prettier, Vitest, Vercel |
| Angular | Tailwind, Angular Material, PrimeNG, Prettier, Vercel |
| Svelte | Tailwind, Axios, Prettier, Vitest, Vercel |

Çoklu dil seçilince başlangıç sayfasının metinleri `src/locales/tr.ts` ve `en.ts` dosyalarından gelir, sayfada dil düğmesi olur.
Motion seçilince kartlar yaylanarak gelir. Vercel seçeneği sadece backend'siz projede görünür.

## Mimari

```
src/
├── core/            Arayüzden bağımsız motor (CLI ve masaüstü aynı kodu kullanır)
│   ├── catalog/     Veritabanı, servis, ihtiyaç, frontend katalogları (yeni kayıt = yeni seçenek)
│   ├── selection.ts Seçim kuralları: şablon uygulama, bağımlılık çözümleme, öneriler, doğrulama
│   ├── initializr.ts Canlı katalog, önbellek, proje indirme
│   └── generate/    Backend, frontend, compose/.env/README üretimi ve adım adım orkestrasyon
├── main/            Electron ana süreci (IPC, klasör seçme, iptal, VS Code'da açma)
├── preload/         Arayüze güvenli köprü (contextIsolation + sandbox)
├── renderer/        React + Tailwind arayüzü
└── cli/             Terminal sürümü
```

Yeni bir veritabanı veya servis eklemek için `src/core/catalog/` altındaki listeye bir kayıt eklemek yeterli; compose bloğu, `.env` değişkenleri, backend ayarları ve arayüz otomatik gelir.

## Kullanım

**Masaüstü:** `npm run dist:win` ile üretilen `release/create-hazal-app Setup <sürüm>.exe` ile kur.

> **Smart App Control açık Windows'larda** imzasız kurulum dosyası ve exe engellenebilir (kod imzalama
> sertifikası olmadan bunun güvenilir bir yolu yok). O bilgisayarda proje klasöründen
> `npm run shortcut:win` çalıştır: Başlat menüsü ve masaüstüne, projedeki Electron'u açan kısayollar ekler.

**Terminal:**

```bash
npx create-hazal-app                    # adım adım sorar
npx create-hazal-app my-app --config secimler.json   # soru sormadan
```

**Gereksinimler:** Docker Desktop, Node.js 20+ (frontend için), Git (isteğe bağlı), internet (start.spring.io ve npm için).

## Geliştirme

```bash
npm install
npm run build        # tsc (motor, CLI, Electron) + vite (arayüz)
npm start            # derleyip Electron'u açar
npm run ui           # arayüzü tarayıcıda açar (sahte API ile)
npm run update       # arayüzü Docker'da + Electron tarafını derler (Smart App Control açıksa bunu kullan)
npm test             # motorun birim testleri (Node'un yerleşik test aracı, ek paket gerekmez)
npm run dist:win     # Windows kurulum dosyası (release/), başka bilgisayarlar için
```

**Smart App Control açık bir bilgisayarda güncelleme:** `npm run update`, ardından uygulamayı Başlat menüsü
kısayolundan aç (açıksa Ctrl+R). `release/` altındaki exe bu bilgisayarda engellenir; onu açma.

> Windows'ta **Smart App Control** açıksa Vite'in native dosyaları engellenebilir. O durumda arayüzü Docker içinde derle:
> `docker run --rm -v "%cd%:/app" -v cha-ui-modules:/app/node_modules -w /app node:24 sh -c "npm install --ignore-scripts && npx vite build"`

## Testler

`test/` altındaki birim testleri seçim kurallarını, compose/.env üretimini, backend dosyalarını, başlangıç
sayfalarını ve yardımcı fonksiyonları kontrol eder; GitHub Actions her push'ta çalıştırır.

`npm run verify:frontends` her framework ve UI kütüphanesi kombinasyonu için frontend'i gerçekten üretip Docker'da
`npm run build` (+ Vitest ve ESLint) ile derler. Son çalıştırmada hepsi geçti: React (düz, Tailwind, shadcn/ui, MUI, Ant Design, Mantine),
Vue (düz, Tailwind, Vuetify, PrimeVue, Element Plus), Angular (düz, Material + Tailwind, PrimeNG), Svelte (düz, Tailwind).

## Test edilen senaryolar

Her biri gerçekten oluşturulup Docker'da ayağa kaldırılarak doğrulandı:

| Senaryo | Doğrulanan |
|---|---|
| MySQL + Flyway + JWT + Swagger + React (shadcn, Router, TanStack, Zustand, Vitest) | Token alma, 401/yetkili istek, Swagger, frontend build + test |
| PostgreSQL + Liquibase + MongoDB + Redis + Kafka + Prometheus/Grafana + Vue (Vuetify, Pinia) + **Gradle + Java 25** | Üç veritabanı bağlantısı, metrikler, tüm paneller |
| Keycloak + Mailpit + Angular (Material, Tailwind) | Keycloak token'ı ile yetkili istek, Angular build |

## Lisans

MIT
