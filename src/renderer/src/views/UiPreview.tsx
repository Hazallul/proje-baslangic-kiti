import { Check, ChevronDown } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { findFramework } from '../../../core/catalog/frontend';
import type { FrameworkId } from '../../../core/types';
import { cx, Segmented } from '../ui';

/**
 * UI kütüphanelerinin varsayılan temalarına benzeyen temsili önizleme. Gerçek kütüphaneler
 * burada çalışmaz (Vue/Angular kütüphaneleri React içinde çalıştırılamaz); renk, köşe,
 * yazı ve bileşen biçimleri her kütüphanenin varsayılanından alınarak çizilir.
 */
interface KitTheme {
  label: string;
  font: string;
  page: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  soft: string;
  radius: number;
  buttonRadius: number;
  buttonUpper: boolean;
  buttonWeight: number;
  buttonShadow: string;
  input: 'outlined' | 'filled';
  cardShadow: string;
  cardBorder: boolean;
  header: 'plain' | 'primary' | 'dark';
  badgeRadius: number;
  badgeUpper: boolean;
  success: string;
  successSoft: string;
  note: string;
}

const ROBOTO = 'Roboto, "Segoe UI", system-ui, sans-serif';
const SYSTEM = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const INTER = '"Inter Variable", system-ui, sans-serif';

const KITS: Record<string, KitTheme> = {
  shadcn: {
    label: 'shadcn/ui', font: INTER, page: '#fafafa', surface: '#ffffff', text: '#09090b', muted: '#71717a',
    border: '#e4e4e7', primary: '#18181b', onPrimary: '#fafafa', soft: '#f4f4f5', radius: 10, buttonRadius: 8,
    buttonUpper: false, buttonWeight: 500, buttonShadow: '0 1px 2px rgb(0 0 0 / .05)', input: 'outlined',
    cardShadow: '0 1px 2px rgb(0 0 0 / .05)', cardBorder: true, header: 'plain', badgeRadius: 6, badgeUpper: false,
    success: '#16a34a', successSoft: '#f0fdf4',
    note: 'Sade, siyah-beyaz varsayılan tema. Renkleri ve her bileşeni kodundan değiştirirsin.',
  },
  mui: {
    label: 'Material UI', font: ROBOTO, page: '#f5f5f5', surface: '#ffffff', text: 'rgb(0 0 0 / .87)', muted: 'rgb(0 0 0 / .6)',
    border: 'rgb(0 0 0 / .23)', primary: '#1976d2', onPrimary: '#ffffff', soft: '#e3f2fd', radius: 4, buttonRadius: 4,
    buttonUpper: true, buttonWeight: 500,
    buttonShadow: '0 3px 1px -2px rgb(0 0 0 / .2), 0 2px 2px rgb(0 0 0 / .14), 0 1px 5px rgb(0 0 0 / .12)',
    input: 'outlined', cardShadow: '0 2px 1px -1px rgb(0 0 0 / .2), 0 1px 1px rgb(0 0 0 / .14), 0 1px 3px rgb(0 0 0 / .12)',
    cardBorder: false, header: 'primary', badgeRadius: 16, badgeUpper: false, success: '#2e7d32', successSoft: '#edf7ed',
    note: 'Google Material Design: büyük harfli butonlar, gölgeli kartlar, renkli üst bar.',
  },
  antd: {
    label: 'Ant Design', font: SYSTEM, page: '#f5f5f5', surface: '#ffffff', text: 'rgb(0 0 0 / .88)', muted: 'rgb(0 0 0 / .45)',
    border: '#d9d9d9', primary: '#1677ff', onPrimary: '#ffffff', soft: '#e6f4ff', radius: 8, buttonRadius: 6,
    buttonUpper: false, buttonWeight: 400, buttonShadow: '0 2px 0 rgb(5 145 255 / .1)', input: 'outlined',
    cardShadow: 'none', cardBorder: true, header: 'dark', badgeRadius: 4, badgeUpper: false, success: '#52c41a', successSoft: '#f6ffed',
    note: 'Kurumsal yönetim paneli görünümü: koyu üst menü, ince çerçeveler, mavi vurgu.',
  },
  mantine: {
    label: 'Mantine', font: SYSTEM, page: '#f8f9fa', surface: '#ffffff', text: '#000000', muted: '#868e96',
    border: '#ced4da', primary: '#228be6', onPrimary: '#ffffff', soft: '#e7f5ff', radius: 8, buttonRadius: 4,
    buttonUpper: false, buttonWeight: 600, buttonShadow: 'none', input: 'outlined',
    cardShadow: '0 1px 3px rgb(0 0 0 / .05), 0 1px 2px rgb(0 0 0 / .1)', cardBorder: true, header: 'plain',
    badgeRadius: 32, badgeUpper: true, success: '#40c057', successSoft: '#ebfbee',
    note: 'Modern ve dengeli: kalın yazılı butonlar, büyük harfli rozetler.',
  },
  vuetify: {
    label: 'Vuetify', font: ROBOTO, page: '#f5f5f5', surface: '#ffffff', text: 'rgb(0 0 0 / .87)', muted: 'rgb(0 0 0 / .6)',
    border: 'rgb(0 0 0 / .38)', primary: '#1867c0', onPrimary: '#ffffff', soft: '#e3eefa', radius: 4, buttonRadius: 4,
    buttonUpper: true, buttonWeight: 500,
    buttonShadow: '0 3px 1px -2px rgb(0 0 0 / .2), 0 2px 2px rgb(0 0 0 / .14), 0 1px 5px rgb(0 0 0 / .12)',
    input: 'filled', cardShadow: '0 2px 1px -1px rgb(0 0 0 / .2), 0 1px 1px rgb(0 0 0 / .14), 0 1px 3px rgb(0 0 0 / .12)',
    cardBorder: false, header: 'primary', badgeRadius: 16, badgeUpper: false, success: '#4caf50', successSoft: '#edf7ed',
    note: 'Material Design: dolgulu girdiler, büyük harfli butonlar, renkli üst bar.',
  },
  primevue: {
    label: 'PrimeVue (Aura)', font: INTER, page: '#f8fafc', surface: '#ffffff', text: '#334155', muted: '#64748b',
    border: '#cbd5e1', primary: '#10b981', onPrimary: '#ffffff', soft: '#ecfdf5', radius: 12, buttonRadius: 6,
    buttonUpper: false, buttonWeight: 500, buttonShadow: 'none', input: 'outlined',
    cardShadow: '0 1px 3px rgb(0 0 0 / .1), 0 1px 2px -1px rgb(0 0 0 / .1)', cardBorder: false, header: 'plain',
    badgeRadius: 6, badgeUpper: false, success: '#16a34a', successSoft: '#f0fdf4',
    note: 'Aura teması: yeşil vurgu, yumuşak köşeler, ferah aralıklar.',
  },
  'element-plus': {
    label: 'Element Plus', font: SYSTEM, page: '#f2f3f5', surface: '#ffffff', text: '#303133', muted: '#909399',
    border: '#dcdfe6', primary: '#409eff', onPrimary: '#ffffff', soft: '#ecf5ff', radius: 4, buttonRadius: 4,
    buttonUpper: false, buttonWeight: 500, buttonShadow: 'none', input: 'outlined',
    cardShadow: '0 0 12px rgb(0 0 0 / .08)', cardBorder: true, header: 'plain', badgeRadius: 4, badgeUpper: false,
    success: '#67c23a', successSoft: '#f0f9eb',
    note: 'Sade, kompakt masaüstü uygulaması görünümü; açık mavi vurgu.',
  },
  'angular-material': {
    label: 'Angular Material', font: ROBOTO, page: '#faf9fd', surface: '#ffffff', text: '#1a1b1f', muted: '#44474e',
    border: '#74777f', primary: '#005cbb', onPrimary: '#ffffff', soft: '#d7e3ff', radius: 12, buttonRadius: 20,
    buttonUpper: false, buttonWeight: 500, buttonShadow: 'none', input: 'outlined',
    cardShadow: '0 1px 2px rgb(0 0 0 / .3), 0 1px 3px 1px rgb(0 0 0 / .15)', cardBorder: false, header: 'plain',
    badgeRadius: 8, badgeUpper: false, success: '#386a20', successSoft: '#d9f7c8',
    note: 'Material 3: hap şeklinde butonlar, yumuşak renkler.',
  },
  primeng: {
    label: 'PrimeNG (Aura)', font: INTER, page: '#f8fafc', surface: '#ffffff', text: '#334155', muted: '#64748b',
    border: '#cbd5e1', primary: '#10b981', onPrimary: '#ffffff', soft: '#ecfdf5', radius: 12, buttonRadius: 6,
    buttonUpper: false, buttonWeight: 500, buttonShadow: 'none', input: 'outlined',
    cardShadow: '0 1px 3px rgb(0 0 0 / .1), 0 1px 2px -1px rgb(0 0 0 / .1)', cardBorder: false, header: 'plain',
    badgeRadius: 6, badgeUpper: false, success: '#16a34a', successSoft: '#f0fdf4',
    note: 'Aura teması: yeşil vurgu, yumuşak köşeler, ferah aralıklar.',
  },
  tailwind: {
    label: 'Sadece Tailwind', font: INTER, page: '#f9fafb', surface: '#ffffff', text: '#111827', muted: '#6b7280',
    border: '#e5e7eb', primary: '#4f46e5', onPrimary: '#ffffff', soft: '#eef2ff', radius: 12, buttonRadius: 8,
    buttonUpper: false, buttonWeight: 600, buttonShadow: '0 1px 2px rgb(0 0 0 / .05)', input: 'outlined',
    cardShadow: '0 1px 3px rgb(0 0 0 / .08)', cardBorder: true, header: 'plain', badgeRadius: 32, badgeUpper: false,
    success: '#059669', successSoft: '#ecfdf5',
    note: 'Tailwind hazır bileşen getirmez. Bu, Tailwind sınıflarıyla yazılabilecek bir örnek; görünümü tamamen sen belirlersin.',
  },
  plain: {
    label: 'Kütüphane yok', font: SYSTEM, page: '#ffffff', surface: '#ffffff', text: '#000000', muted: '#555555',
    border: '#767676', primary: '#efefef', onPrimary: '#000000', soft: '#f0f0f0', radius: 0, buttonRadius: 3,
    buttonUpper: false, buttonWeight: 400, buttonShadow: 'none', input: 'outlined', cardShadow: 'none', cardBorder: true,
    header: 'plain', badgeRadius: 3, badgeUpper: false, success: '#1a7f37', successSoft: '#e6f4ea',
    note: 'UI kütüphanesi ve Tailwind seçilmedi: bileşenler tarayıcının varsayılan görünümüyle gelir, stili kendin yazarsın.',
  },
};

export function kitIdFor(options: string[]): string {
  const kit = Object.keys(KITS).find((k) => k !== 'tailwind' && k !== 'plain' && options.includes(k));
  if (kit) return kit;
  return options.includes('tailwind') ? 'tailwind' : 'plain';
}

type PreviewTab = 'components' | 'start';

interface PreviewProps {
  framework: FrameworkId | null;
  options: string[];
  hoverKit: string | null;
  projectName: string;
}

export function usePreviewState({ options, hoverKit }: Pick<PreviewProps, 'options' | 'hoverKit'>) {
  const kitId = hoverKit && KITS[hoverKit] ? hoverKit : kitIdFor(options);
  return { kitId, kit: KITS[kitId], previewing: Boolean(hoverKit && hoverKit === kitId && !options.includes(hoverKit)) };
}

/** Sekmeler + tarayıcı çerçevesi + açıklama: hem sol panelde hem form içinde kullanılır */
export function PreviewBody({ framework, projectName, kit, tab, setTab }: {
  framework: FrameworkId;
  projectName: string;
  kit: KitTheme;
  tab: PreviewTab;
  setTab: (t: PreviewTab) => void;
}) {
  const fw = findFramework(framework);
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Segmented
          size="sm"
          label="Önizleme türü"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'components', label: 'Bileşenler' },
            { value: 'start', label: 'Açılış sayfası' },
          ]}
        />
        <span className="text-[11.5px] text-fg-3">Temsili görünüm</span>
      </div>
      <BrowserFrame url={`localhost:${fw.devPort}`}>
        {tab === 'components' ? <ComponentsSample kit={kit} /> : <StartPageSample name={projectName} />}
      </BrowserFrame>
      <p className="mt-2.5 text-[12px] leading-relaxed text-fg-2">
        {tab === 'components'
          ? kit.note
          : 'Proje oluşunca açılan ilk sayfa. Frontend, backend ve veritabanı bağlantısını kontrol eder; kendi sayfalarınla değiştirirsin.'}
      </p>
    </>
  );
}

/** Dar pencerede Frontend bölümünün içinde, açılıp kapanan önizleme */
export function UiPreview(props: PreviewProps) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<PreviewTab>('components');
  const { kit, previewing } = usePreviewState(props);
  if (!props.framework) return null;
  const fw = findFramework(props.framework);

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <ChevronDown size={15} className={cx('shrink-0 text-fg-3 transition-transform duration-200', !open && '-rotate-90')} />
        <span className="text-[13px] font-medium text-fg">Görünüm önizlemesi</span>
        <span className="truncate text-[12px] text-fg-2">
          {fw.label} · {kit.label}
          {previewing && <span className="text-accent"> · seçmek için tıkla</span>}
        </span>
      </button>
      {open && (
        <div className="enter border-t border-line p-3.5">
          <PreviewBody framework={props.framework} projectName={props.projectName} kit={kit} tab={tab} setTab={setTab} />
        </div>
      )}
    </div>
  );
}

/** Geniş pencerede formun solunda sabit duran önizleme paneli */
export function SidebarPreview(props: PreviewProps & { onGoToFrontend: () => void }) {
  const [tab, setTab] = useState<PreviewTab>('components');
  const { kit, previewing } = usePreviewState(props);
  const fw = props.framework ? findFramework(props.framework) : null;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3">
        <div className="text-[13.5px] font-semibold text-fg">Görünüm önizlemesi</div>
        <div className="mt-0.5 text-[12px] text-fg-2">
          {fw ? (
            <>
              {fw.label} · <span className={previewing ? 'text-accent' : undefined}>{kit.label}</span>
              {previewing && <span className="text-accent"> · seçmek için tıkla</span>}
            </>
          ) : 'Frontend seçilmedi'}
        </div>
      </div>

      {props.framework ? (
        <>
          <PreviewBody framework={props.framework} projectName={props.projectName} kit={kit} tab={tab} setTab={setTab} />
          <p className="mt-2 text-[11.5px] leading-relaxed text-fg-3">
            UI kütüphanesi seçeneklerinin üzerine gelerek seçmeden karşılaştırabilirsin.
          </p>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center">
          <p className="text-[12.5px] leading-relaxed text-fg-2">
            Bir frontend framework'ü seçince, seçtiğin UI kütüphanesiyle arayüzün nasıl görüneceğini burada görürsün.
          </p>
          <button
            type="button"
            onClick={props.onGoToFrontend}
            className="mt-3 text-[12.5px] font-medium text-accent hover:underline"
          >
            Frontend seçimine git
          </button>
        </div>
      )}
    </div>
  );
}

/** Açıklama kartında gösterilen küçük görünüm örneği: buton, girdi, rozet */
export function KitSwatch({ kitId }: { kitId: string }) {
  const kit = KITS[kitId];
  if (!kit) return null;
  const accent = kit.primary === '#efefef' ? '#0075ff' : kit.primary;
  const small: CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', fontSize: 11 };
  return (
    <div
      className="mb-2.5 flex items-center gap-2 rounded-md p-2.5"
      style={{ background: kit.page, fontFamily: kit.font, colorScheme: 'light', border: '1px solid rgb(0 0 0 / .08)' }}
    >
      <span style={{ ...buttonStyle(kit, 'primary'), ...small }}>Kaydet</span>
      <span style={{ ...buttonStyle(kit, 'secondary'), ...small }}>Vazgeç</span>
      <span style={{ ...inputStyle(kit), height: 26, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, color: kit.muted }}>
        Ad soyad
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: kit.badgeRadius, background: kit.soft, color: accent }}>Yeni</span>
    </div>
  );
}

function buttonStyle(kit: KitTheme, variant: 'primary' | 'secondary'): CSSProperties {
  return {
    fontFamily: kit.font,
    fontSize: 12,
    fontWeight: kit.buttonWeight,
    textTransform: kit.buttonUpper ? 'uppercase' : 'none',
    letterSpacing: kit.buttonUpper ? '0.04em' : 0,
    borderRadius: kit.buttonRadius,
    height: 30,
    padding: '0 14px',
    border: variant === 'primary' ? `1px solid ${kit.primary === '#efefef' ? kit.border : kit.primary}` : `1px solid ${kit.border}`,
    background: variant === 'primary' ? kit.primary : kit.surface,
    color: variant === 'primary' ? kit.onPrimary : kit.text,
    boxShadow: variant === 'primary' ? kit.buttonShadow : 'none',
    whiteSpace: 'nowrap',
  };
}

function inputStyle(kit: KitTheme): CSSProperties {
  return kit.input === 'filled'
    ? { background: 'rgb(0 0 0 / .05)', borderBottom: `1px solid ${kit.border}`, borderRadius: `${kit.buttonRadius}px ${kit.buttonRadius}px 0 0` }
    : { background: kit.surface, border: `1px solid ${kit.border}`, borderRadius: Math.min(kit.buttonRadius, 8) };
}

export function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-line-strong shadow-pop">
      <div className="flex h-7 items-center gap-2 border-b border-line bg-surface-2 px-2.5">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-line-strong" />)}
        </span>
        <span className="mx-auto rounded bg-surface px-3 py-px font-mono text-[10.5px] text-fg-3">{url}</span>
      </div>
      {/* Önizleme her zaman açık temada: kütüphanelerin varsayılan teması */}
      <div className="min-h-[280px] select-none" style={{ colorScheme: 'light' }}>{children}</div>
    </div>
  );
}

function ComponentsSample({ kit }: { kit: KitTheme }) {
  const button = (variant: 'primary' | 'secondary') => buttonStyle(kit, variant);
  const inputBox = inputStyle(kit);
  const accent = kit.primary === '#efefef' ? '#0075ff' : kit.primary;
  const headerBg = kit.header === 'primary' ? kit.primary : kit.header === 'dark' ? '#001529' : kit.surface;
  const headerFg = kit.header === 'plain' ? kit.text : '#ffffff';

  const badge = (text: string, color: string, soft: string) => (
    <span
      style={{
        fontSize: 10.5, fontWeight: 600, padding: '1px 8px', borderRadius: kit.badgeRadius, background: soft, color,
        textTransform: kit.badgeUpper ? 'uppercase' : 'none', letterSpacing: kit.badgeUpper ? '0.03em' : 0,
      }}
    >
      {text}
    </span>
  );

  return (
    <div style={{ fontFamily: kit.font, background: kit.page, color: kit.text, minHeight: 280, fontSize: 12 }}>
      <div
        style={{
          background: headerBg, color: headerFg, height: 38, display: 'flex', alignItems: 'center', padding: '0 14px',
          gap: 14, borderBottom: kit.header === 'plain' ? `1px solid ${kit.border}` : 'none',
          boxShadow: kit.header === 'primary' ? '0 2px 4px rgb(0 0 0 / .2)' : 'none',
        }}
      >
        <strong style={{ fontSize: 13 }}>Siparişler</strong>
        <span style={{ opacity: 0.75 }}>Müşteriler</span>
        <span style={{ opacity: 0.75 }}>Raporlar</span>
        <span style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: 99, background: kit.header === 'plain' ? kit.soft : 'rgb(255 255 255 / .25)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, padding: 14 }}>
        <div
          style={{
            background: kit.surface, borderRadius: kit.radius, boxShadow: kit.cardShadow, padding: 14,
            border: kit.cardBorder ? `1px solid ${kit.border === '#767676' ? '#cccccc' : kit.border}` : 'none',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Yeni müşteri</div>
          <label style={{ display: 'block', fontSize: 11, color: kit.muted, marginBottom: 3 }}>Ad soyad</label>
          <div style={{ ...inputBox, height: 28, display: 'flex', alignItems: 'center', padding: '0 9px', marginBottom: 8 }}>Ayşe Yılmaz</div>
          <label style={{ display: 'block', fontSize: 11, color: kit.muted, marginBottom: 3 }}>E-posta</label>
          <div style={{ ...inputBox, height: 28, display: 'flex', alignItems: 'center', padding: '0 9px', color: kit.muted, marginBottom: 10 }}>ornek@mail.com</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <span style={{ width: 14, height: 14, borderRadius: kit.buttonRadius > 10 ? 4 : 3, background: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Check size={10} strokeWidth={3.5} /></span>
            Bülten aboneliği
            <span style={{ marginLeft: 'auto', width: 28, height: 16, borderRadius: 99, background: accent, position: 'relative' }}>
              <span style={{ position: 'absolute', right: 2, top: 2, width: 12, height: 12, borderRadius: 99, background: '#fff' }} />
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" tabIndex={-1} style={button('primary')}>Kaydet</button>
            <button type="button" tabIndex={-1} style={button('secondary')}>Vazgeç</button>
          </div>
        </div>

        <div
          style={{
            background: kit.surface, borderRadius: kit.radius, boxShadow: kit.cardShadow, padding: 14,
            border: kit.cardBorder ? `1px solid ${kit.border === '#767676' ? '#cccccc' : kit.border}` : 'none',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Son siparişler</div>
          {[
            ['#1042', 'Teslim edildi', 'ok', '₺1.240'],
            ['#1041', 'Hazırlanıyor', 'info', '₺380'],
            ['#1040', 'Teslim edildi', 'ok', '₺2.015'],
          ].map(([no, status, tone, amount]) => (
            <div key={no} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: `1px solid ${kit.border === '#767676' ? '#dddddd' : kit.soft}` }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: kit.muted }}>{no}</span>
              {tone === 'ok' ? badge(status, kit.success, kit.successSoft) : badge(status, accent, kit.soft)}
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{amount}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: '7px 10px', borderRadius: Math.min(kit.radius, 8), background: kit.successSoft, color: kit.success, fontSize: 11.5 }}>
            Kayıt başarıyla oluşturuldu
          </div>
        </div>
      </div>
    </div>
  );
}

/** Oluşturulan projenin ilk açılış sayfası (StatusPage) */
function StartPageSample({ name }: { name: string }) {
  const rows: [string, string][] = [['Frontend', 'çalışıyor'], ['Backend', 'çalışıyor'], ['Veritabanı', 'çalışıyor']];
  return (
    <div style={{ background: '#ffffff', color: '#1f2328', height: '100%', fontFamily: SYSTEM, padding: '34px 0 0' }}>
      <div style={{ maxWidth: 360, margin: '0 auto' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{name || 'my-app'}</div>
        <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
          Proje hazır. Geliştirmeye frontend/src ve backend/src klasörlerinden başlayabilirsin.
        </div>
        <div style={{ marginTop: 18, border: '1px solid #8884', borderRadius: 10 }}>
          {rows.map(([label, status], i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderTop: i ? '1px solid #8884' : 'none', fontSize: 12 }}>
              <span>{label}</span>
              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 99, background: '#1a7f3722', color: '#1a7f37' }}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
