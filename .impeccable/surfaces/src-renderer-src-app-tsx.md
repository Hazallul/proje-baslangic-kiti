---
version: 1
slug: "src-renderer-src-app-tsx"
primary_target: "src/renderer/src/App.tsx"
related_targets: ["src/renderer/src/views"]
---

# Surface: create-hazal-app masaüstü arayüzü (açılış, ayarlar, oluşturma, bitiş)

Mode: Operate. Tek kullanıcı (aracı yazan geliştirici), Windows dizüstü, çoğu zaman akşam, yanında VS Code.

Job: proje türünü seç → türe özel ayarları yap → oluştur (canlı ilerleme) → VS Code'da aç.
Pinned by user: açılışta proje türü yumuşak köşeli kare kartlarla sorulur; Python tek kart, alt türleri
(oyun/simülasyon, FastAPI, konsol/exe) kart üzerinde tıklamadan önce görünür, seçim kartın içinden yapılır.
Must keep: açık/koyu tema düğmesi, araç durumu (Docker vb.), canlı önizleme, Ctrl+Enter, şablon kaydetme.

## Direction contract

THESIS: Proje bir maket kiti: seçtiğin her şey kutudan çıkan numaralı bir parça, önizleme o parçaların
çerçevesi (runner), oluşturma ekranı montaj kitapçığının adımları. Kategori varsayılanı olan "gri yüzey +
tek mor vurgu + düz form listesi" düzenini reddeder.

OWN-WORLD: Plastik çerçeve grisi tek ton merdiveni (açık temada açık plastik, koyuda koyu gunmetal), kit
kutusu kırmızısı birincil eylem, her tür kendi kutu rengini taşır (Fullstack lacivert, REST API yeşil, Web
sitesi turuncu, Python sarı). Barlow / Barlow Semi Condensed: parça numaraları ve başlıklar dar, yoğun; kod ve
yollar JetBrains Mono. Yumuşak köşeli (plastik döküm) kartlar, ince çerçeve çizgileri, parça numarası rozetleri.

STORY: Açılışta tek soru: ne kuruyorsun? Kutu kapağı gibi dört kart, her birinin içinde kutudan çıkacak
parçalar yazılı. Kart seçilince o kitin ayar sayfası; sağda parça çerçevesi her seçimle dolar. Oluştur'a
basınca montaj adımları numaralı ilerler; bitince "VS Code'da aç".

FIRST VIEWPORT: Üstte ince başlık çubuğu (logo, araç durumu, tema). Ortada büyük başlık "Ne kuruyorsun?" ve
altında 4 kare kart tek sırada (en küçük pencere 980x640'ta da; 2x2 ikinci sırayı ekran dışına iter): kutu rengi
şeridi, ad, bir cümle, "Kutuda" altında A1, A2… numaralı parça listesi (parça çerçevesiyle aynı dil). Python
kartında üç alt kit satırı ayrı düğmedir ve o şablonu doğrudan açar. Kit kodu kaldırıldı: bilgi taşımayan bir
numara olurdu; numaralandırmayı parçalar taşır. Kartların altında sessiz bir satır: kayıtlı şablonlar ve son kullanılan.
Birincil eylem kartın kendisi; ayar sayfasında birincil eylem altta sabit kırmızı "Projeyi oluştur".
Signature move: sağdaki önizleme paneli bir parça çerçevesi; projeye girecek her parça numaralı bir yuvada
(A1, A2…), seçim yapınca yuvası dolar.

FORM: Maket Kiti, sıralı listemde 1. aday (impeccable pick), seed key 688c1c52.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
