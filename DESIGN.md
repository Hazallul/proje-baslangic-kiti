---
name: create-hazal-app
description: Proje türünü seç, parçaları işaretle, çalışan bir başlangıç projesi al; arayüz bir maket kiti gibi kurulur.
colors:
  bg: "#e7e9ed"
  panel: "#dde0e5"
  surface: "#f6f7f9"
  surface-2: "#eceef2"
  border: "#d0d4db"
  border-strong: "#b3b9c4"
  text: "#14161b"
  text-2: "#444955"
  text-3: "#5d6370"
  action: "#c8102e"
  action-hover: "#a80c26"
  action-ink: "#ffffff"
  accent: "#c8102e"
  ok: "#17804f"
  warn: "#9a5f00"
  danger: "#c4262e"
  kit-fullstack: "#2f4fb5"
  kit-backend: "#1f8a4c"
  kit-frontend: "#d4621a"
  kit-python: "#f2c230"
  kit-python-ink: "#2b2100"
  accent-fullstack: "#2f4fb5"
  accent-backend: "#1b7a43"
  accent-frontend: "#b04c0c"
  accent-python: "#8a6100"
  dark-bg: "#1b2026"
  dark-panel: "#20262d"
  dark-surface: "#262d35"
  dark-surface-2: "#2d343d"
  dark-border: "#343c46"
  dark-border-strong: "#46505c"
  dark-text: "#eef0f3"
  dark-text-2: "#b0b6c2"
  dark-text-3: "#9aa1b0"
  dark-action: "#d9233b"
  dark-action-hover: "#ec3a51"
  dark-accent: "#ff6b7c"
  dark-accent-ink: "#1b0206"
  dark-ok: "#45c587"
  dark-warn: "#e9b450"
  dark-danger: "#f2716b"
  dark-kit-fullstack: "#3d5fd0"
  dark-kit-python-ink: "#241a00"
  dark-accent-fullstack: "#86a0ff"
  dark-accent-backend: "#52cf8a"
  dark-accent-frontend: "#ff9d55"
  dark-accent-python: "#f2c230"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
  title-kit:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
  title:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    letterSpacing: "0.005em"
  part-number:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    fontFeature: "tnum"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  body-control:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
  body-sm:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
  caption:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  mono:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  row: "14px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.body-control}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-control}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-ghost:
    textColor: "{colors.text-2}"
    typography: "{typography.body-control}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  segmented:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "3px"
  segmented-option-selected:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  tag:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "18px"
  toggle-on:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.full}"
    height: "18px"
    width: "32px"
  toggle-off:
    backgroundColor: "{colors.border-strong}"
    rounded: "{rounded.full}"
    height: "18px"
    width: "32px"
  kit-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
  kit-card-strip-fullstack:
    backgroundColor: "{colors.kit-fullstack}"
    textColor: "#ffffff"
    typography: "{typography.title-kit}"
    padding: "16px"
    height: "92px"
  kit-card-strip-python:
    backgroundColor: "{colors.kit-python}"
    textColor: "{colors.kit-python-ink}"
    typography: "{typography.title-kit}"
    padding: "16px"
    height: "92px"
  runner-frame:
    rounded: "{rounded.2xl}"
    padding: "10px"
  part-slot:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "6px 8px"
  step-row:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  step-badge-running:
    backgroundColor: "{colors.accent}"
    typography: "{typography.part-number}"
    rounded: "{rounded.full}"
    size: "32px"
  step-badge-done:
    backgroundColor: "{colors.ok}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    size: "32px"
  title-bar:
    backgroundColor: "{colors.bg}"
    height: "40px"
    padding: "0 148px 0 14px"
  action-bar:
    backgroundColor: "{colors.bg}"
    height: "64px"
    padding: "0 24px"
---

# Design System: create-hazal-app

## Overview

**Creative North Star: "Maket Kiti"**

Her proje bir plastik maket kiti gibi kurulur. Açılış ekranı dört kutu kapağıdır: her kutunun kendi rengi, adı ve "Kutuda" altında numaralı parça listesi vardır. Ayar sayfasında yapılan her seçim, sağdaki parça çerçevesinde (runner) numaralı bir yuvaya takılır; oluşturma ekranı montaj kitapçığının numaralı adımlarıdır. Bitince tek bir kırmızı düğme kalır: "VS Code'da aç". Arayüz, kategori varsayılanı olan "gri yüzey + tek mor vurgu + düz form listesi" düzenini bilinçli olarak reddeder.

Malzeme plastik çerçeve grisidir: açık temada açık gri döküm plastik, koyu temada siyaha kaçmayan koyu gunmetal. Tek bir gri ton merdiveni (bg, panel, surface, surface-2) zemini taşır; renk sadece iki yerden gelir: kit kutusunun rengi (kimlik ve seçim) ve kit kutusu kırmızısı (tek birincil eylem). Yoğunluk masaüstü aracı yoğunluğudur: 14px gövde, 13–13.5px kontroller, sıkı satırlar, en küçük pencere 980×640.

Hareket "yerine oturma" dilidir. Seçilen parça çerçeveye hafifçe büyüyüp küçülerek takılır (snap); biten montaj adımının rozeti de aynı hareketle oturur. Bekleyen her şey kesik çizgili ve soluktur.

**Key Characteristics:**
- Tek gri ton merdiveni + kit başına kutu rengi + tek kırmızı eylem.
- Parça numaraları (A1, B2, C3) dar, kalın, tabular; numaralandırmayı kitler değil parçalar taşır.
- Kesik çizgi = henüz kutudan çıkmamış (boş yuva, bekleyen parça, atlanan adım, "Yok" seçeneği, kullanıcının kendi kayıtlı şablonu).
- Yumuşak köşeli, ince çizgili döküm plastik formlar; gölge sadece "parça" olan nesnelerde.
- Yol, port, komut, log ve dosya ağacı her zaman JetBrains Mono.

## Colors

Plastik çerçeve grisi bir ton merdiveni üstünde, dört kit kutusu rengi ve tek bir kit kutusu kırmızısı.

### Primary
- **Kit Kutusu Kırmızısı** (`action`; koyuda `dark-action`): Ekrandaki tek birincil eylem: ayar sayfasında altta sabit "Projeyi oluştur", bitişte "VS Code'da aç", hatada "Tekrar dene" / "Tekrar başlat". Üzerine gelince `action-hover`. Açılış ekranında kit seçili değilken seçim rengi (accent) de bu kırmızıdır (`accent`, koyuda `dark-accent` pembe-kırmızı).

### Secondary
- **Kit Kutusu Renkleri** (`kit-fullstack` lacivert, `kit-backend` yeşil, `kit-frontend` turuncu, `kit-python` sarı): Kimlik rengi. Açılış kartının üst şeridi, ayar sayfası başlığındaki ikon karosu, başlık çubuğundaki küçük kare, kayıtlı şablon noktası ve açılış kartındaki parça numarası rozetinin zemini (%22 karışım). Şeritler beyaz başlık taşır; sarı Python kutusu koyu mürekkep (`kit-python-ink`) taşır. Koyu temada da aynı doygunlukta kalırlar (yalnızca lacivert `dark-kit-fullstack` biraz açılır).
- **Kit Seçim Renkleri** (`accent-fullstack`, `accent-backend`, `accent-frontend`, `accent-python`; koyuda `dark-accent-*`): Bir kit açıkken `<html data-kit="…">` ile `--accent` o kitin okunabilir tonuna döner. Seçili kart/çip çerçevesi (`--accent-line`, %62), seçili zemin (`--accent-soft`, %11), anahtar, onay kutusu, parça numarası, çalışan adım rozeti ve odak halkası bu renktedir. Açık temada kutu renginin koyulaştırılmış hali (yüzey üstünde metin kontrastı için), koyu temada açılmış hali; koyu temada üstündeki mürekkep de kitin en koyu tonudur.

### Tertiary
- **Durum renkleri** (`ok` yeşil, `warn` kehribar, `danger` kırmızı; koyuda `dark-*`): Araç durumu noktaları (Docker, Node.js, Python), biten adım rozeti, uyarı kutuları, hata kutusu ve geçersiz alan. Her birinin %9–13 opaklıkta yumuşak zemini vardır (`--ok-soft`, `--warn-soft`, `--danger-soft`).

### Neutral
- **Açık Döküm Gri** (`bg`) / **Koyu Gunmetal** (`dark-bg`): Pencere zemini, başlık çubuğu ve alt eylem çubuğu. Electron pencere arka planı ve başlık çubuğu katmanı da bu değerle eşlenir.
- **Çerçeve Grisi** (`panel` / `dark-panel`): Sağdaki "Kutudan çıkacaklar" paneli ve ayrıntılı log kutusu: zeminden bir ton koyu, çerçeve hissi.
- **Parça Yüzeyi** (`surface`, `surface-2` / `dark-surface`, `dark-surface-2`): Kartlar, listeler, alanlar (`surface`); üzerine gelme, seçili segment ve nötr etiket (`surface-2`).
- **Çerçeve Çizgileri** (`border`, `border-strong`): 1px ince çizgiler; `border-strong` üzerine gelmede, kesik çizgili yuvalarda, çerçeve çubuğu ve kollarında, kapalı anahtarda.
- **Mürekkep** (`text`, `text-2`, `text-3`): Başlık ve değerler, açıklamalar, ipuçları/sayaçlar. `text-3` bile yüzey üstünde okunur kalacak koyulukta tutulur.

### Named Rules
**Tek Kırmızı Kuralı.** Dolu kırmızı (`action`) ekranda sadece bir düğmede durur: o ekranın birincil eylemi. İkinci bir eylem gerekiyorsa ikincil (çerçeveli) düğme olur.

**Seçim Kutunun Rengidir Kuralı.** Seçili durum hiçbir zaman kırmızı eylem rengiyle gösterilmez; her zaman açık kitin `--accent` rengiyle (`accent-line` çerçeve + `accent-soft` zemin). Kit renkleri sabit değerle değil `var(--kit-…)` / `var(--accent)` ile kullanılır ki tema ve kit değişince birlikte dönsün.

**Siyaha Kaçmama Kuralı.** Koyu tema koyu gunmetaldir (`dark-bg` ve üstü); saf siyah zemin ya da saf beyaz metin kullanılmaz.

> Açık konu (kural değil): başlık çubuğundaki uygulama ikonu `build/icon.png` mor degrade bir "h"; paletin dışında kalıyor. İkonun kit renklerine göre yeniden boyanıp boyanmayacağı kullanıcı kararı bekliyor.

## Typography

**Display Font:** Barlow Semi Condensed (Barlow, system-ui yedekli)
**Body Font:** Barlow (system-ui yedekli)
**Label/Mono Font:** JetBrains Mono Variable (ui-monospace yedekli)

**Character:** Dar, yoğun, kalın başlıklar kit kutusu ve kitapçık baskısını anar; Barlow gövde aynı ailenin sakin, okunur tarafıdır. Mono yalnızca makinenin anlayacağı şeyler içindir: yol, port, komut, anahtar, log.

### Hierarchy
- **Display** (700, 34px, 1.25, -0.01em): Sadece açılıştaki tek soru: "Ne kuruyorsun?".
- **Headline** (700, 26px, 1.25): Ekran başlıkları: kit adı (ayar sayfası), "… kuruluyor", "… hazır".
- **Title Kit** (700, 22px, 1): Açılış kartı şeridindeki kit adı.
- **Title** (700, 17px, 0.005em): Bölüm başlıkları (Proje, İhtiyaçlar, Veritabanı…), Python şablon kartı adı; panel başlığı 16px.
- **Part Number** (700, 11.5–12px, tabular): A1/B2 parça numaraları, grup harfleri, adım numaraları (rozette 15px), "4 parça · 16 dosya" sayacı.
- **Body** (400, 14px, 1.45): Gövde varsayılanı ve montaj adım adları.
- **Body Control** (500, 13.5px): Düğmeler, alanlar, öne çıkan satır başlıkları.
- **Body Sm** (400–500, 13px): Liste satırları, seçenek adları, kart içi parça satırları.
- **Label** (500, 12.5px): Alan etiketleri, bölüm meta yazısı, segment ve çip yazısı.
- **Caption** (400, 11.5–12px): İpuçları, açıklamalar, durum notları; etiketler 11px.
- **Mono** (400, 11–12.5px, tabular): Proje yolu, port (`:8080`), komutlar, `.env` anahtarları, dosya planı (11.75px / 1.75), log (11px / 1.6).

### Named Rules
**Dar Başlık Kuralı.** Barlow Semi Condensed yalnızca başlıklar, parça/adım numaraları ve sayaçlar içindir; gövde metni, düğme ve alan yazısı her zaman Barlow'dur.

**Mono Makine İçindir Kuralı.** Kullanıcının kopyalayacağı ya da makinenin okuyacağı her değer (yol, port, komut, ortam değişkeni, dosya adı, log) JetBrains Mono ve tabular rakamla yazılır; açıklayıcı Türkçe metin asla mono olmaz.

## Layout

Masaüstü penceresi, en küçük 980×640, varsayılan 1440×900'e kadar. Üstte 40px başlık çubuğu (sağda Windows pencere düğmeleri için 148px boşluk, sürüklenebilir), altta ayar/oluşturma/bitiş ekranlarında 64px sabit eylem çubuğu (`border-t`, birincil düğme sağda).

- **Açılış:** 1180px kap içinde dikey ortalı; başlık, alt satır, 4 kit kartı tek sırada (900px üstü 4 sütun; 1180px'te boşluk 16px'e, şerit 104px'e çıkar). 980px en küçük pencerede de 4 kart tek sıradadır; 2×2 düzen sadece tarayıcı önizlemesinde (900px altı) devreye girer. Kartların altında sessiz bir satır: "Son ayarlarla devam et" ve kayıtlı şablonlar.
- **Ayar sayfası:** Solda form + (genişlik 980px'i geçerse) 380px yapışkan arayüz önizlemesi, en fazla 1180px; form sütunu en fazla 720px. Sağda sabit 372px "Kutudan çıkacaklar" paneli (`panel` zemin, `border-l`). Python kitinde arayüz önizlemesi yoktur, form 784px kap içinde ortalanır.
- **Oluşturma ve bitiş:** 720px tek sütun, 32px yan boşluk; sağ panel oluşturma sırasında da kalır ve parçalar adımlar bittikçe takılır.
- **Ritim:** 4px tabanlı. Satır içi 14px yatay boşluk, kart içi 16px, liste ögeleri arası 8px, bölümler arası 32px üst boşluk, kontroller arası 8–12px.

## Elevation & Depth

Hibrit ama düz ağırlıklı: yüzeyler 1px çizgi ve ton farkıyla ayrılır (bg → panel → surface → surface-2). Gölge yalnızca iki şeye verilir: kutudan çıkmış bir **parça** (açılış kartı, çerçeveye takılmış parça) ve **havada duran** şeyler (açıklama kartı, üzerine gelinen açılış kartı). Odak ve seçili segment gibi durumlar gölge değil iç çizgi (inset 1–2px) kullanır.

### Shadow Vocabulary
- **Parça** (`--card-shadow`; açık: `0 1px 0 rgb(255 255 255 / 0.7) inset, 0 6px 16px -12px rgb(20 24 34 / 0.4)`): Döküm plastiğin üst kenar parlaması ve kısa, yumuşak alt gölge. Açılış kartları dururken, takılmış parça yuvaları.
- **Havada** (`--shadow`; açık: `0 10px 28px -16px rgb(20 24 34 / 0.35)`): Açıklama kartı (HelpPopover) ve üzerine gelinen açılış kartı (2px yukarı kalkar).
- **Kırmızı düğme parlaması** (`0 1px 0 rgb(255 255 255 / 0.18) inset`): Sadece birincil düğmede.

### Named Rules
**Sadece Parçalar Gölge Alır Kuralı.** Liste, form satırı, bölüm ve adım satırı düzdür (çizgi + yüzey). Gölge ancak nesne bir kit parçası ya da geçici olarak havada ise eklenir.

## Shapes

Yumuşak köşeli döküm plastik. Köşe yarıçapı nesnenin boyuyla büyür: etiket ve onay kutusu 4px, segment seçeneği ve küçük ikon düğmesi 6px, düğme/alan/liste kutusu/küçük kart 8px, montaj adımı satırı, Python şablon kartı ve kit ikon karosu 12px, kit kartı ve parça çerçevesi 16px. Anahtar, adım rozeti ve durum noktaları tam yuvarlaktır.

Çizgiler incedir (1px); tek istisna parça çerçevesi: 2px `border-strong` çerçeve, ortadan geçen 2px çubuk ve her parçayı çubuğa bağlayan 8px'lik kısa kol. Kesik çizgi sabit bir anlam taşır: henüz kutudan çıkmamış ya da kutuya ait olmayan şey.

**Yuva Kuralı.** Bekleyen parça kesik çizgili, saydam zeminli ve %60 opaklıktadır; takılınca düz çizgi + `surface` + parça gölgesi alır ve snap hareketiyle oturur. Aynı dil adım rozetinde de geçerlidir: bekleyen adım çizgili halka, atlanan adım kesik halka, biten adım dolu yeşil.

## Components

### Buttons
Tok ve sakin; tek kırmızı, gerisi plastik gri.
- **Shape:** Yumuşak köşe (8px), 36px yükseklik, 14px yatay iç boşluk, ikonla 8px aralık.
- **Primary:** `action` zemin, beyaz yazı, 600 kalınlık, üst kenar parlaması. Ayar sayfasında en az 196px genişlikte ve `Ctrl ↵` kısayol rozeti (mono 10.5px, 4px köşe) taşır.
- **Hover / Focus:** Renk geçişi 150ms; birincil `action-hover`'a koyulaşır. Odak halkası her yerde 2px `--accent-line`, 2px boşluk. Devre dışı %45 opaklık.
- **Secondary:** `surface` zemin + 1px `border`; üzerine gelince `border-strong` + `surface-2`.
- **Ghost:** Çerçevesiz, `text-2`; üzerine gelince `surface-2` zemin. Geri ve "Yeni proje" gibi geri dönüş eylemleri.
- **Danger:** Secondary gövdesinde `danger` yazı; üzerine gelince çerçeve ve yumuşak zemin kırmızıya döner. Sadece "İptal et".

### Chips
- **Style:** Etiket (Tag) 18px yükseklik, 4px köşe, 11px yazı; tonlar nötr (`surface-2`), accent, ok, warn (yumuşak zemin + aynı renk yazı). Seçenek çipi 28px, 6px köşe, içinde onay kutusu.
- **State:** Seçili çip `accent-line` çerçeve + `accent-soft` zemin; seçili değil `border` çerçeve, `text-2`.

### Cards / Containers
- **Corner Style:** Seçim kartları 8px (veritabanı, framework, hızlı başlangıç), Python şablon kartı 12px, kit kartı 16px.
- **Background:** `surface`; seçiliyken `accent-soft`.
- **Shadow Strategy:** Düz; yalnızca kit kartı parça gölgesi alır (bkz. Elevation & Depth).
- **Border:** 1px `border`, üzerine gelince `border-strong`, seçiliyken `accent-line`. Kullanıcının kendi kayıtlı şablonu kesik `border-strong`.
- **Internal Padding:** 10–14px seçim kartlarında, 16px kit kartında.
- **Liste kutuları:** `surface` zemin, 1px çerçeve, satırlar arası 1px bölücü; satır 14px yatay, 8–10px dikey boşluk, üzerine gelince `surface-2`.

### Inputs / Fields
- **Style:** 36px, 8px köşe, `surface` zemin, 1px `border`, 13.5px yazı; yol alanı mono 12.5px ve klasör ikonlu. İmleç rengi `--accent`.
- **Focus:** Çerçeve `accent-line`'a döner ve 3px `accent-soft` halka çıkar.
- **Error / Disabled:** Hatada çerçeve ve halka `danger`; alt satırdaki ipucu 12px `danger`. Boş ad hata sayılmaz, nötr ipucu olarak kalır.
- **Segmented:** 3px iç boşluklu `surface` kap; seçili seçenek `surface-2` + 1px `border-strong` iç çizgi. Toggle 32×18px, açıkken `--accent`.

### Navigation
- **Başlık çubuğu:** 40px, `bg` zemin, alt çizgi. Solda 22px uygulama ikonu, kalın "create-hazal-app", "/" ve kit açıksa kit renginde 8px kare + ekran adı (`text-2`, 13px). Sağda araç durumu düğmesi (yeşil/kehribar 6px noktalar, eksik araç `warn` yazı; tıklayınca yeniden kontrol) ve 28px tema düğmesi (ay/güneş). Üzerine gelince `surface-2`.
- **Geri dönüş:** Ayar sayfasında içerik üstünde ghost "Proje türleri" bağlantısı.

### Kit Kartı (signature)
Açılışın kutu kapağı. 16px köşe, `surface`, parça gölgesi, en az 320px yükseklik. Üstte 92px (geniş pencerede 104px) kit rengi şerit: yarı saydam beyaz ikon karosu (12px köşe) ve 22px dar başlık; üzerine gelince sağ üstte ok kayarak belirir ve kart 2px kalkar. Altta bir cümle, "Kutuda" etiketi ve A1, A2… numaralı parça listesi; en altta o kitin araç durumu noktaları. Kartın tamamı tek tıklama alanıdır; Python kartındaki alt şablon satırları bu katmanın üstünde ayrı düğmelerdir ve şablonu doğrudan açar.

### Parça Çerçevesi (signature)
Sağ paneldeki "Kutudan çıkacaklar". Harfli gruplar sabittir: A Çekirdek, B Seçimler, C Altyapı. Her grup 2px çerçeveli, 16px köşeli bir runner'dır; başlıkta `--accent` zeminli 20px harf rozeti. Parçalar iki sütunda, ortadaki çubuğa kısa kollarla bağlı 8px köşeli yuvalardır: `--accent` renkli parça numarası, 12.5px ad, 11.5px ayrıntı. Boş grup kesik çizgili bir ipucu yuvası gösterir. Altında açılır/kapanır mono dosya planı ve "Servisler ve portlar" listesi.

### Montaj Adımı (signature)
Oluşturma ekranının kitapçık adımları: 12px köşeli satır, solda 32px numara rozeti. Bekliyor: 2px `border-strong` halka + `text-3` numara; sürüyor: `--accent` dolu rozet, etrafında dönen ince halka, satır `accent-line` + `accent-soft`; bitti: yeşil dolu rozet + onay işareti + snap; hata: `danger` rozet, satır yumuşak kırmızı; atlandı: kesik halka. Sağda mono süre. Üstte mono `3/7` sayacı.

### Hareket
- **Giriş** (`enter`): 220ms, `cubic-bezier(0.16, 1, 0.3, 1)`, 4px aşağıdan saydamdan gelir. Açılan bölümler, açıklama kartı, hata kutusu, bitiş ekranı.
- **Yerine oturma** (`snap`): 240ms, aynı eğri; %60 opak ve 0.97 ölçekten 1.03'e çıkıp oturur. Takılan parça, biten adım rozeti, bitiş onayı.
- **Durum geçişleri:** Renk 150ms, dönüşüm/gölge 200ms ease-out. Açıklama kartı 300ms gecikmeyle açılır.
- `prefers-reduced-motion` açıkken bütün animasyon ve geçişler 1ms'ye iner.

## Do's and Don'ts

### Do:
- **Do** zemin için yalnızca gri ton merdivenini (`bg` → `panel` → `surface` → `surface-2`) kullan; ayrımı 1px çizgiyle yap.
- **Do** seçili durumu açık kitin `--accent` rengiyle göster: `accent-line` çerçeve + `accent-soft` zemin.
- **Do** her ekranda tek dolu kırmızı (`action`) düğme bırak; diğer eylemler secondary ya da ghost olsun.
- **Do** projeye giren her şeyi harf+numaralı parça (A1, B2, C3) olarak göster; grup harfleri sabit kalsın (A Çekirdek, B Seçimler, C Altyapı).
- **Do** bekleyen/boş/kutuya ait olmayan şeyleri kesik çizgiyle, takılan parçayı düz çizgi + parça gölgesi + snap ile göster.
- **Do** yol, port, komut, anahtar ve logu JetBrains Mono ve tabular rakamla yaz.
- **Do** kit renklerini `var(--kit-…)` ve `var(--accent)` üzerinden kullan; sarı Python kutusunda koyu mürekkep (`kit-python-ink`) kullan.
- **Do** açılıştaki dört kartı 980px en küçük pencerede de tek sırada tut.

### Don't:
- **Don't** "gri yüzey + tek mor vurgu + düz form listesi" düzenine dön; mor bir vurgu rengi ekleme.
- **Don't** seçili durumu kırmızı eylem rengiyle ya da bir kitin rengini başka bir kitin ekranında seçim rengi olarak kullan.
- **Don't** kit kartlarına kit kodu ya da bilgi taşımayan numara koy; numaralandırmayı parçalar taşır.
- **Don't** liste, form satırı ya da bölüm kutusuna gölge ver; gölge sadece parçalar ve havada duranlar içindir.
- **Don't** koyu temada saf siyah zemin kullan.
- **Don't** Barlow Semi Condensed'i gövde metninde, düğmede ya da alanda kullan.
- **Don't** açılış kartlarını en küçük pencerede 2×2 diz; ikinci sıra ekran dışına düşer.
