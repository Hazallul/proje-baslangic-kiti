/**
 * Seçeneklerin üzerine gelince gösterilen yardım metinleri: ne olduğu, ne zaman seçileceği
 * ve kısa bir öneri. Yeni bir seçenek eklerken buraya da metnini ekle.
 */

export type HelpLevel = 'Önerilir' | 'İhtiyaç olursa' | 'İleri seviye';

export interface HelpText {
  what: string;
  when: string;
  level: HelpLevel;
}

export const FRAMEWORK_HELP: Record<string, HelpText> = {
  react: {
    what: 'En yaygın frontend kütüphanesi. Arayüzü küçük, tekrar kullanılabilir bileşenlerle kurarsın.',
    when: 'Kararsızsan en güvenli seçim: en büyük ekosistem, en çok kaynak ve iş ilanı.',
    level: 'Önerilir',
  },
  vue: {
    what: 'HTML\'e yakın şablon yazımıyla öğrenmesi en kolay framework\'lerden biri.',
    when: 'Hızlı başlamak ve sade, okunaklı kod istiyorsan.',
    level: 'Önerilir',
  },
  angular: {
    what: 'Google\'ın router, form, HTTP gibi her şeyi içinde getiren tam framework\'ü. TypeScript zorunlu.',
    when: 'Büyük kurumsal projeler. Spring Boot ile birlikte banka ve kamu projelerinde çok yaygın.',
    level: 'İhtiyaç olursa',
  },
  svelte: {
    what: 'Derleme anında optimize edilen, çok az kodla yazılan hızlı bir framework.',
    when: 'Küçük ve orta ölçekli, performans odaklı projeler. Ekosistemi diğerlerinden küçük.',
    level: 'İhtiyaç olursa',
  },
};

export const FRONTEND_OPTION_HELP: Record<string, HelpText> = {
  tailwind: {
    what: 'Stili hazır sınıflarla (ör. p-4, text-lg, bg-blue-500) doğrudan HTML\'e yazarsın; ayrı CSS dosyasıyla uğraşmazsın.',
    when: 'Çoğu yeni proje için iyi bir tercih. shadcn/ui seçersen zaten birlikte gelir.',
    level: 'Önerilir',
  },
  shadcn: {
    what: 'Buton, form, dialog gibi hazır bileşenler; ama paket olarak değil, kodu projene kopyalanır. Kod tamamen senindir.',
    when: 'Modern, sade bir görünüm ve her detayı değiştirebilme özgürlüğü istiyorsan.',
    level: 'Önerilir',
  },
  mui: {
    what: 'Google\'ın Material Design kurallarına göre hazırlanmış 50+ bileşen.',
    when: 'Hızlıca tutarlı, kurumsal bir arayüz istiyorsan. Görünümü kökten değiştirmek biraz uğraştırır.',
    level: 'İhtiyaç olursa',
  },
  antd: {
    what: 'Kurumsal bileşen kütüphanesi. Tablo, form ve tarih seçici gibi yönetim paneli parçaları çok güçlü.',
    when: 'Admin paneli, çok tablolu ve formlu iş uygulamaları.',
    level: 'İhtiyaç olursa',
  },
  mantine: {
    what: '100+ bileşen ve form, bildirim, modal gibi işler için kullanışlı hook\'lar.',
    when: 'Hazır bileşen ile kolay özelleştirme arasında denge istiyorsan.',
    level: 'İhtiyaç olursa',
  },
  vuetify: {
    what: 'Vue için Material Design bileşen kütüphanesi; 80+ hazır bileşen.',
    when: 'Vue\'da hızlıca tutarlı ve kurumsal bir görünüm istiyorsan.',
    level: 'İhtiyaç olursa',
  },
  primevue: {
    what: 'Tablo, grafik, takvim gibi zengin bileşenler ve hazır temalar.',
    when: 'Veri yoğun ekranlar ve admin panelleri.',
    level: 'İhtiyaç olursa',
  },
  'element-plus': {
    what: 'Masaüstü web uygulamaları için sade, kurumsal bileşen seti.',
    when: 'Form ve tablo ağırlıklı yönetim ekranları.',
    level: 'İhtiyaç olursa',
  },
  'angular-material': {
    what: 'Angular ekibinin resmi Material Design bileşenleri. Erişilebilirlik ve kalite çok iyi.',
    when: 'Angular\'da varsayılan, güvenli tercih.',
    level: 'Önerilir',
  },
  primeng: {
    what: 'Angular için en geniş bileşen setlerinden biri (90+): gelişmiş tablo, grafik, form.',
    when: 'Zengin tablo ve form gereken kurumsal ekranlar.',
    level: 'İhtiyaç olursa',
  },
  'react-router': {
    what: 'Birden fazla sayfa (/, /giris, /urunler) arasında adres çubuğuna göre geçiş yapar.',
    when: 'Tek ekrandan fazlası olan neredeyse her uygulamada gerekir.',
    level: 'Önerilir',
  },
  'vue-router': {
    what: 'Vue\'nun resmi sayfa yönlendirme kütüphanesi; sayfalar arası adres çubuğuna göre geçiş.',
    when: 'Tek ekrandan fazlası olan neredeyse her uygulamada gerekir.',
    level: 'Önerilir',
  },
  zustand: {
    what: 'Birden fazla bileşenin ortak kullandığı veriyi (giriş yapan kullanıcı, sepet, tema) tutan çok hafif bir kütüphane.',
    when: 'Küçük ve orta projeler. Redux\'a göre çok daha az kod yazarsın.',
    level: 'İhtiyaç olursa',
  },
  redux: {
    what: 'Uygulamanın tüm durumunu tek merkezde, kurallı şekilde yöneten köklü kütüphane.',
    when: 'Büyük ekipler ve karmaşık durum mantığı. Küçük projeler için fazla gelir.',
    level: 'İleri seviye',
  },
  pinia: {
    what: 'Vue\'nun resmi state yönetimi: sayfalar arasında paylaşılan veriyi tutar.',
    when: 'Birden fazla sayfanın aynı veriyi (kullanıcı, sepet) kullanacağı her projede.',
    level: 'Önerilir',
  },
  'tanstack-query': {
    what: 'Backend\'den veriyi çeker, önbelleğe alır; yükleniyor/hata durumlarını ve yenilemeyi kendisi yönetir.',
    when: 'API\'den çok veri çeken uygulamalarda işini ciddi kolaylaştırır.',
    level: 'Önerilir',
  },
  axios: {
    what: 'HTTP istekleri için kolay bir istemci. Projeye /api adresine ayarlı hazır bir örneği eklenir.',
    when: 'Tarayıcının fetch\'i de yeter; ama her isteğe token ekleme, ortak hata yakalama gibi işler için pratiktir.',
    level: 'İhtiyaç olursa',
  },
  eslint: {
    what: 'Kodundaki olası hataları ve kötü alışkanlıkları yazarken uyarır. React şablonunda varsayılan olarak daha hızlı olan Oxlint gelir; bunu seçersen yerine ESLint kurulur.',
    when: 'Ekip projeleri veya ESLint eklentilerine ihtiyacın varsa. Seçmesen de bir lint aracı zaten olur.',
    level: 'İhtiyaç olursa',
  },
  prettier: {
    what: 'Kaydettiğinde kodunu otomatik düzenler: girintiler, tırnaklar, satır uzunlukları hep aynı olur. Kodun ne yaptığını değiştirmez, sadece görünüşünü.',
    when: 'Hiçbir zararı yok, neredeyse her projede önerilir. Ekipte "kim nasıl yazdı" farkını ortadan kaldırır.',
    level: 'Önerilir',
  },
  vitest: {
    what: 'Bileşenlerini ve fonksiyonlarını otomatik test eden hızlı test aracı. Örnek bir test dosyasıyla gelir (npm test).',
    when: 'Proje büyüyecekse ve hataları erken yakalamak istiyorsan. CV\'de test yazdığını göstermek için de iyi.',
    level: 'Önerilir',
  },
};

export const NEED_HELP: Record<string, HelpText> = {
  security: {
    what: 'Kimin giriş yapabileceğini ve hangi adreslere erişebileceğini kontrol eder.',
    when: 'Kullanıcı girişi olan her uygulamada gerekir.',
    level: 'Önerilir',
  },
  validation: {
    what: 'Gelen verinin kurallara uyduğunu (boş değil, e-posta formatında, en fazla 50 karakter) otomatik kontrol eder.',
    when: 'Form ya da kayıt alan her API\'de önerilir.',
    level: 'Önerilir',
  },
  'api-docs': {
    what: 'API\'ndeki tüm endpoint\'leri otomatik listeleyen ve tarayıcıdan denemeni sağlayan sayfa (/swagger-ui.html).',
    when: 'Frontend yazarken ve API\'yi başkasına anlatırken çok işe yarar.',
    level: 'Önerilir',
  },
  cache: {
    what: 'Sık istenen ama az değişen veriyi bellekte tutar; her seferinde veritabanına gitmez.',
    when: 'Yavaş sorgular veya çok tekrarlanan istekler varsa. İlk günden şart değil.',
    level: 'İhtiyaç olursa',
  },
  messaging: {
    what: 'Servislerin birbirini doğrudan çağırmak yerine mesaj bırakarak haberleşmesini sağlar; alıcı meşgulse mesaj kaybolmaz.',
    when: 'Sipariş → fatura → e-posta gibi ardışık işler ve mikroservisler.',
    level: 'İleri seviye',
  },
  monitoring: {
    what: 'Uygulamanın ayakta olup olmadığını ve ne kadar yük aldığını gösterir.',
    when: 'Sağlık kontrolü her projede faydalı; metrik panoları canlıya çıkacak projeler için.',
    level: 'Önerilir',
  },
  mail: {
    what: 'Uygulamadan e-posta gönderir (kayıt onayı, şifre sıfırlama). Geliştirmede Mailpit e-postaları yakalar, tarayıcıda görürsün; kimseye gerçekten gitmez.',
    when: 'Kullanıcıya e-posta atacaksan.',
    level: 'İhtiyaç olursa',
  },
  realtime: {
    what: 'Sayfa yenilemeden sunucudan anlık veri gönderir.',
    when: 'Sohbet, bildirim, canlı skor ya da canlı pano gibi özellikler.',
    level: 'İhtiyaç olursa',
  },
  graphql: {
    what: 'İstemcinin hangi alanları istediğini kendisinin belirttiği bir sorgu dili; REST\'e alternatif.',
    when: 'Farklı ekranların çok farklı veri ihtiyacı varsa. Yeni başlıyorsan REST yeterli.',
    level: 'İleri seviye',
  },
  scheduling: {
    what: 'Belirli zamanlarda kendiliğinden çalışan işler.',
    when: 'Her gece rapor üretmek, her saat eski kayıtları temizlemek gibi.',
    level: 'İhtiyaç olursa',
  },
};

/** "ihtiyaç/varyant" anahtarıyla */
export const VARIANT_HELP: Record<string, HelpText> = {
  'security/basic': {
    what: 'Her istekte kullanıcı adı ve şifre gönderilir. En basit yöntem.',
    when: 'Dahili araçlar ve hızlı prototipler. Ayrı bir frontend\'i olan uygulamalar için JWT daha uygun.',
    level: 'İhtiyaç olursa',
  },
  'security/jwt': {
    what: 'Giriş yapınca bir token alınır, sonraki isteklerde bu token gönderilir. Sunucu oturum tutmaz. Giriş endpoint\'i hazır gelir.',
    when: 'React/Vue gibi ayrı frontend\'i olan uygulamalarda en yaygın yöntem.',
    level: 'Önerilir',
  },
  'security/keycloak': {
    what: 'Giriş ekranı, kullanıcı yönetimi, şifre sıfırlama gibi işleri hazır bir kimlik sunucusu yapar; backend sadece token\'ı doğrular.',
    when: 'Birden fazla uygulama aynı kullanıcıları paylaşacaksa (tek giriş / SSO), kurumsal projeler.',
    level: 'İleri seviye',
  },
  'cache/memory': {
    what: 'Uygulamanın kendi belleğinde tutulur, ek servis gerekmez. Uygulama yeniden başlayınca silinir.',
    when: 'Tek bir backend çalışıyorsa ve basit önbellek yeterliyse.',
    level: 'Önerilir',
  },
  'cache/redis': {
    what: 'Ayrı bir Redis sunucusunda tutulur; birden fazla backend aynı önbelleği paylaşır, yeniden başlatmada kaybolmaz.',
    when: 'Birden fazla sunucu veya kalıcı önbellek gerekiyorsa.',
    level: 'İhtiyaç olursa',
  },
  'messaging/kafka': {
    what: 'Yüksek hacimli olay akışı. Mesajlar saklanır, sonradan tekrar okunabilir. Kafka UI ile topic\'leri görürsün.',
    when: 'Çok sayıda olay ve birden fazla tüketici olan sistemler.',
    level: 'İleri seviye',
  },
  'messaging/rabbitmq': {
    what: 'Klasik iş kuyruğu: bir mesaj bir işçiye gider. Yönetim paneliyle gelir.',
    when: 'Arka plan işleri (e-posta gönder, PDF üret). Kurulumu ve öğrenmesi Kafka\'dan kolay.',
    level: 'İhtiyaç olursa',
  },
  'monitoring/health': {
    what: '/actuator/health adresi uygulamanın ve veritabanının çalışıp çalışmadığını söyler.',
    when: 'Neredeyse her projede faydalı, maliyeti yok.',
    level: 'Önerilir',
  },
  'monitoring/prometheus': {
    what: 'İstek sayısı, yanıt süresi, bellek gibi metrikler toplanır; Grafana\'da grafik olarak izlersin.',
    when: 'Performansı izlemek ve canlıya çıkacak projeler için.',
    level: 'İleri seviye',
  },
};

export const SERVICE_HELP: Record<string, HelpText> = {
  adminer: {
    what: 'Tarayıcıdan tabloları görmeni, veri düzenlemeni ve SQL çalıştırmanı sağlayan hafif bir panel.',
    when: 'Veritabanını görsel olarak incelemek istiyorsan. Masaüstü bir araç (DBeaver vb.) kullanıyorsan gerekmez.',
    level: 'İhtiyaç olursa',
  },
  pgadmin: {
    what: 'PostgreSQL\'in resmi, gelişmiş yönetim arayüzü.',
    when: 'PostgreSQL ile yoğun çalışacaksan. Basit işler için Adminer yeter.',
    level: 'İhtiyaç olursa',
  },
  'mongo-express': {
    what: 'Tarayıcıdan MongoDB koleksiyonlarını ve dokümanlarını görüntüleme.',
    when: 'MongoDB verisini görsel incelemek istiyorsan.',
    level: 'İhtiyaç olursa',
  },
  'redis-insight': {
    what: 'Redis\'teki anahtarları görme ve izleme arayüzü.',
    when: 'Önbellekte ne olduğunu görmek istiyorsan.',
    level: 'İhtiyaç olursa',
  },
  rabbitmq: {
    what: 'Mesaj kuyruğu sunucusu ve kuyrukları izleyebildiğin yönetim paneli.',
    when: 'Spring for RabbitMQ paketini kullanıyorsan gerekli.',
    level: 'İhtiyaç olursa',
  },
  kafka: {
    what: 'Kafka sunucusu (tek düğüm, geliştirme için).',
    when: 'Spring for Apache Kafka paketini kullanıyorsan gerekli.',
    level: 'İhtiyaç olursa',
  },
  'kafka-ui': {
    what: 'Kafka\'daki topic\'leri ve mesajları tarayıcıdan görme.',
    when: 'Kafka kullanıyorsan hata ayıklamayı çok kolaylaştırır.',
    level: 'Önerilir',
  },
  keycloak: {
    what: 'Kimlik sunucusu. Proje adına bir realm, istemci ve demo/demo test kullanıcısı hazır gelir.',
    when: 'Güvenlik → Keycloak seçtiysen gerekli.',
    level: 'İhtiyaç olursa',
  },
  mailpit: {
    what: 'Uygulamanın gönderdiği e-postaları yakalayıp tarayıcıda gösteren test sunucusu. Kimseye gerçekten e-posta gitmez.',
    when: 'E-posta gönderen her projede geliştirme için çok faydalı.',
    level: 'Önerilir',
  },
  prometheus: {
    what: 'Backend\'in metriklerini düzenli aralıklarla toplar.',
    when: 'İzleme → Prometheus seçtiysen gerekli.',
    level: 'İleri seviye',
  },
  grafana: {
    what: 'Metrikleri grafik ve panolarla gösterir; Prometheus bağlantısı hazır gelir.',
    when: 'Metrikleri görsel izlemek istiyorsan.',
    level: 'İleri seviye',
  },
};
