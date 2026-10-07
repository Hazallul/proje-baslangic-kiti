/**
 * Frontend seçilince gelen hazır başlangıç sayfası ("merhaba dünya").
 *
 * - Backend'li projede: frontend → backend → veritabanı bağlantısını gösterir, backend'e örnek istek atar.
 * - Sadece frontend projesinde: kurulu araçları listeler, selamlamayı sayfanın kendisi yapar.
 *
 * Sayfa seçilen UI kütüphanesinin kendi bileşenleriyle yazılır; kütüphane yoksa düz CSS ya da Tailwind
 * kullanılır. Çoklu dil seçiliyse metinler dil dosyalarından gelir, Motion seçiliyse kartlar animasyonla gelir.
 */
import { findFramework } from '../catalog/frontend.js';
import type { FrameworkId } from '../types.js';

export interface StartPageOptions {
  name: string;
  options: Set<string>;
  /** Projede Spring Boot backend var mı */
  backend: boolean;
}

// ---------------------------------------------------------------------------
// Metinler (çoklu dil seçiliyse dil dosyalarına, değilse doğrudan sayfaya yazılır)
// ---------------------------------------------------------------------------

const TEXTS = {
  lead: {
    tr: 'Proje hazır. Bu sayfa kurulumun çalıştığını gösterir; geliştirmeye frontend/src ve backend/src klasörlerinden başla.',
    en: 'Your project is ready. This page shows that the setup works; start building in frontend/src and backend/src.',
  },
  leadFrontend: {
    tr: 'Proje hazır. Bu sayfa kurulumun çalıştığını gösterir; geliştirmeye frontend/src klasöründen başla.',
    en: 'Your project is ready. This page shows that the setup works; start building in frontend/src.',
  },
  statusTitle: { tr: 'Bağlantı durumu', en: 'Connection status' },
  setupTitle: { tr: 'Kurulum', en: 'Setup' },
  helloTitle: { tr: 'Merhaba dünya', en: 'Hello world' },
  helloText: {
    tr: "Adını yaz ve gönder: istek backend'e gider, cevabı buraya gelir.",
    en: 'Type your name and send it: the request goes to the backend and the answer comes back here.',
  },
  helloTextLocal: { tr: 'Adını yaz ve gönder, sayfa seni selamlasın.', en: 'Type your name and send it to get a greeting.' },
  recheck: { tr: 'Tekrar kontrol et', en: 'Check again' },
  send: { tr: 'Gönder', en: 'Send' },
  placeholder: { tr: 'Adın', en: 'Your name' },
  unreachable: { tr: "Backend'e ulaşılamadı", en: 'Could not reach the backend' },
  defaultName: { tr: 'dünya', en: 'world' },
  switchLanguage: { tr: 'English', en: 'Türkçe' },
  'status.loading': { tr: 'kontrol ediliyor…', en: 'checking…' },
  'status.ok': { tr: 'çalışıyor', en: 'running' },
  'status.error': { tr: 'ulaşılamıyor', en: 'unreachable' },
} as const;

type TextKey = keyof typeof TEXTS;

/** Selamlama: çoklu dilde dil dosyasından, değilse sabit Türkçe */
const GREETING = { tr: 'Merhaba, {name}!', en: 'Hello, {name}!' };

/** Bir metnin sayfaya nasıl yazılacağı: çocuk metin, öznitelik veya JS ifadesi */
interface Texts {
  child(key: TextKey): string;
  attr(name: string, key: TextKey): string;
  js(key: TextKey): string;
  /** Durum etiketi ifadesi (expr: 'loading' | 'ok' | 'error' tipinde bir ifade) */
  status(expr: string): string;
}

function textsFor(framework: FrameworkId, i18n: boolean): Texts {
  const tr = (key: TextKey) => TEXTS[key].tr;
  if (i18n && framework === 'react') {
    return {
      child: (key) => `{t('${key}')}`,
      attr: (name, key) => `${name}={t('${key}')}`,
      js: (key) => `t('${key}')`,
      status: (expr) => `t('status.' + ${expr})`,
    };
  }
  if (i18n && framework === 'vue') {
    return {
      child: (key) => `{{ t('${key}') }}`,
      attr: (name, key) => `:${name}="t('${key}')"`,
      js: (key) => `t('${key}')`,
      status: (expr) => `t('status.' + ${expr})`,
    };
  }
  const statusFn = framework === 'svelte' ? 'statusLabel' : framework === 'angular' ? 'labels' : 'LABELS';
  return {
    child: tr,
    attr: (name, key) => `${name}="${tr(key)}"`,
    js: (key) => JSON.stringify(tr(key)),
    status: (expr) => framework === 'svelte' ? `${statusFn}(${expr})` : `${statusFn}[${expr}]`,
  };
}

/** Çoklu dil için dil dosyaları (src/locales/tr.ts, en.ts) */
export function localeFiles(framework: FrameworkId): Record<string, string> {
  const files: Record<string, string> = {};
  for (const lang of ['tr', 'en'] as const) {
    const status: Record<string, string> = {};
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(TEXTS)) {
      if (key.startsWith('status.')) status[key.slice(7)] = value[lang];
      else flat[key] = value[lang];
    }
    // i18next {{name}}, vue-i18n {name} biçiminde değişken bekler
    flat.greeting = framework === 'vue' ? GREETING[lang] : GREETING[lang].replace('{name}', '{{name}}');
    const body = JSON.stringify({ ...flat, status }, null, 2);
    files[`src/locales/${lang}.ts`] = `// ${lang === 'tr' ? 'Türkçe' : 'İngilizce'} metinler. Yeni metin eklerken iki dosyaya da aynı anahtarı ekle.\nexport default ${body}\n`;
  }
  return files;
}

// ---------------------------------------------------------------------------
// Sayfa düzeni: düz CSS (status.css) veya Tailwind sınıfları
// ---------------------------------------------------------------------------

interface Layout {
  page: string;
  header: string;
  h1: string;
  lead: string;
  card: string;
  cardTitle: string;
  list: string;
  row: string;
  stack: string;
  form: string;
  input: string;
  button: string;
  secondaryButton: string;
  greeting: string;
  muted: string;
  grow: string;
}

const CSS_LAYOUT: Layout = {
  page: 'status-page',
  header: 'page-header',
  h1: 'title',
  lead: 'lead',
  card: 'card',
  cardTitle: 'card-title',
  list: 'status-list',
  row: 'status-row',
  stack: 'stack',
  form: 'form-row',
  input: 'input',
  button: 'btn',
  secondaryButton: 'btn-secondary',
  greeting: 'greeting',
  muted: 'muted',
  grow: 'grow',
};

const TAILWIND_LAYOUT: Layout = {
  page: 'mx-auto my-[10vh] flex max-w-xl flex-col gap-6 px-4',
  header: 'flex items-start justify-between gap-4',
  h1: 'mb-2 text-3xl font-bold',
  lead: 'leading-relaxed text-neutral-500',
  card: 'flex flex-col gap-4 rounded-xl border border-neutral-200 p-5',
  cardTitle: 'font-semibold',
  list: 'divide-y divide-neutral-200 rounded-lg border border-neutral-200',
  row: 'flex items-center justify-between px-4 py-3',
  stack: 'flex flex-col gap-4',
  form: 'flex items-center gap-2',
  input: 'flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm',
  button: 'rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500',
  secondaryButton: 'shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50',
  greeting: 'text-lg font-semibold',
  muted: 'text-sm text-neutral-500',
  grow: 'grow',
};

const TAILWIND_BADGE_BASE = 'rounded-full px-2.5 py-0.5 text-xs font-medium';
const TAILWIND_BADGES = `const BADGE_CLASSES: Record<Status, string> = {
  loading: 'bg-neutral-100 text-neutral-600',
  ok: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}`;

/** Düz CSS düzeninde kullanılan stiller (Tailwind yoksa) */
export const START_PAGE_CSS = `.status-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 600px;
  margin: 10vh auto 48px;
  padding: 0 16px;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 8px;
}

.lead,
.muted {
  opacity: 0.7;
  line-height: 1.6;
  margin: 0;
}

.card,
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  border: 1px solid #8884;
  border-radius: 12px;
  padding: 20px;
}

.card-title {
  font-size: 1.05rem;
  margin: 0;
}

.status-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid #8884;
  border-radius: 10px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
}

.status-row + .status-row {
  border-top: 1px solid #8884;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.grow,
.input {
  flex: 1;
}

.input {
  padding: 8px 12px;
  border: 1px solid #8886;
  border-radius: 8px;
  font: inherit;
  color: inherit;
  background: transparent;
}

.btn,
.btn-secondary {
  border-radius: 8px;
  font: inherit;
  cursor: pointer;
}

.btn {
  padding: 8px 16px;
  border: 0;
  background: #4f46e5;
  color: #fff;
  font-weight: 600;
}

.btn:hover {
  background: #4338ca;
}

.btn-secondary {
  flex-shrink: 0;
  padding: 6px 12px;
  border: 1px solid #8886;
  background: transparent;
  color: inherit;
}

.greeting {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.badge {
  font-size: 0.85rem;
  padding: 2px 10px;
  border-radius: 999px;
}

.badge-ok { background: #1a7f3722; color: #1a7f37; }
.badge-error { background: #cf222e22; color: #cf222e; }
.badge-loading { background: #8882; }
`;

const LABELS = `const LABELS: Record<Status, string> = {
  loading: '${TEXTS['status.loading'].tr}',
  ok: '${TEXTS['status.ok'].tr}',
  error: '${TEXTS['status.error'].tr}',
}`;

const STATUS_TYPE = "type Status = 'loading' | 'ok' | 'error'";

const HELLO_RESPONSE = `interface HelloResponse {
  message: string
  checks: Record<string, Status>
}`;

/** /api/hello isteği: axios seçiliyse ortak istemciyle, değilse fetch ile */
function getHelloFunction(axios: boolean): string {
  const body = axios
    ? `  const { data } = await api.get<HelloResponse>('/hello', { params: { name } })
  return data`
    : `  const res = await fetch('/api/hello' + (name ? '?name=' + encodeURIComponent(name) : ''))
  if (!res.ok) throw new Error(String(res.status))
  return (await res.json()) as HelloResponse`;
  return `/** Backend'deki örnek endpoint: GET /api/hello (name verilirse selamlar) */
async function getHello(name?: string): Promise<HelloResponse> {
${body}
}`;
}

function layoutFor(options: Set<string>): Layout {
  return options.has('tailwind') ? TAILWIND_LAYOUT : CSS_LAYOUT;
}

/** Düz CSS düzeni kullanılıyorsa sayfanın status.css'e ihtiyacı var */
export function needsStartPageCss(options: Set<string>): boolean {
  return !options.has('tailwind');
}

/** Sadece frontend projesinde "Kurulum" kartında listelenen araçlar */
function setupRows(framework: FrameworkId, options: Set<string>): string[] {
  const fw = findFramework(framework);
  return [fw.description, ...fw.options.filter((o) => options.has(o.id) && o.group !== 'deploy').map((o) => o.label)];
}

function indent(text: string, spaces: number): string {
  return text.split('\n').map((line) => (line ? ' '.repeat(spaces) + line : line)).join('\n');
}

// ---------------------------------------------------------------------------
// React
// ---------------------------------------------------------------------------

interface ReactKit {
  imports: string[];
  /** StatusBadge bileşeninin dönüş değeri; `label` metin ifadesi, `status` değişkeni kullanılır */
  badge: string;
  /** Section bileşeninin içeriği (`title`, `children`) */
  section: string;
  button: (label: string) => string;
  secondaryButton: (label: string, onClick: string) => string;
  /** Ad kutusu; attr(ad) placeholder/label özniteliğini üretir */
  input: (attr: (name: string) => string) => string;
}

function reactKit(options: Set<string>, L: Layout): ReactKit {
  const onChange = 'onChange={(e) => setVisitor(e.target.value)}';
  if (options.has('shadcn')) {
    return {
      imports: [
        "import { Badge } from '@/components/ui/badge'",
        "import { Button } from '@/components/ui/button'",
        "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'",
        "import { Input } from '@/components/ui/input'",
      ],
      badge: "<Badge variant={status === 'ok' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>{label}</Badge>",
      section: `<Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="${L.stack}">{children}</CardContent>
    </Card>`,
      button: (label) => `<Button type="submit">${label}</Button>`,
      secondaryButton: (label, onClick) => `<Button variant="outline" size="sm" onClick={${onClick}}>${label}</Button>`,
      input: (attr) => `<Input value={visitor} ${onChange} ${attr('placeholder')} />`,
    };
  }
  if (options.has('mui')) {
    return {
      imports: ["import { Button, Card, CardContent, Chip, TextField, Typography } from '@mui/material'"],
      badge: "<Chip size=\"small\" label={label} color={status === 'ok' ? 'success' : status === 'error' ? 'error' : 'default'} />",
      section: `<Card variant="outlined">
      <CardContent className="${L.stack}">
        <Typography variant="h6">{title}</Typography>
        {children}
      </CardContent>
    </Card>`,
      button: (label) => `<Button variant="contained" type="submit">${label}</Button>`,
      secondaryButton: (label, onClick) => `<Button variant="outlined" size="small" onClick={${onClick}}>${label}</Button>`,
      input: (attr) => `<TextField size="small" ${attr('label')} value={visitor} ${onChange} className="${L.grow}" />`,
    };
  }
  if (options.has('antd')) {
    return {
      imports: ["import { Button, Card, Input, Tag } from 'antd'"],
      badge: "<Tag color={status === 'ok' ? 'green' : status === 'error' ? 'red' : 'default'}>{label}</Tag>",
      section: `<Card title={title}>
      <div className="${L.stack}">{children}</div>
    </Card>`,
      button: (label) => `<Button type="primary" htmlType="submit">${label}</Button>`,
      secondaryButton: (label, onClick) => `<Button size="small" onClick={${onClick}}>${label}</Button>`,
      input: (attr) => `<Input value={visitor} ${onChange} ${attr('placeholder')} />`,
    };
  }
  if (options.has('mantine')) {
    return {
      imports: ["import { Badge, Button, Card, TextInput, Title } from '@mantine/core'"],
      badge: "<Badge variant=\"light\" color={status === 'ok' ? 'green' : status === 'error' ? 'red' : 'gray'}>{label}</Badge>",
      section: `<Card withBorder padding="lg" radius="md">
      <div className="${L.stack}">
        <Title order={4}>{title}</Title>
        {children}
      </div>
    </Card>`,
      button: (label) => `<Button type="submit">${label}</Button>`,
      secondaryButton: (label, onClick) => `<Button variant="default" size="xs" onClick={${onClick}}>${label}</Button>`,
      input: (attr) => `<TextInput value={visitor} ${onChange} ${attr('placeholder')} className="${L.grow}" />`,
    };
  }
  const tailwind = options.has('tailwind');
  return {
    imports: [],
    badge: tailwind
      ? `<span className={'${TAILWIND_BADGE_BASE} ' + BADGE_CLASSES[status]}>{label}</span>`
      : "<span className={'badge badge-' + status}>{label}</span>",
    section: `<section className="${L.card}">
      <h2 className="${L.cardTitle}">{title}</h2>
      {children}
    </section>`,
    button: (label) => `<button type="submit" className="${L.button}">${label}</button>`,
    secondaryButton: (label, onClick) => `<button type="button" className="${L.secondaryButton}" onClick={${onClick}}>${label}</button>`,
    input: (attr) => `<input value={visitor} ${onChange} ${attr('placeholder')} className="${L.input}" />`,
  };
}

export function reactStartPage({ name, options, backend }: StartPageOptions): string {
  const L = layoutFor(options);
  const kit = reactKit(options, L);
  const i18n = options.has('i18n');
  const motion = options.has('motion');
  const T = textsFor('react', i18n);
  const plainTailwind = options.has('tailwind') && kit.imports.length === 0;
  const axios = backend && options.has('axios');

  const reactImports = [
    ...(backend ? ['useCallback', 'useEffect'] : []),
    'useState',
    'type FormEvent',
    'type ReactNode',
  ];
  const imports = [
    `import { ${reactImports.join(', ')} } from 'react'`,
    ...(i18n ? ["import { useTranslation } from 'react-i18next'"] : []),
    ...(motion ? ["import { motion } from 'motion/react'"] : []),
    ...kit.imports,
    ...(axios ? ["import { api } from '../lib/api'"] : []),
    ...(needsStartPageCss(options) ? ["import './status.css'"] : []),
  ];

  // Motion: kartlar sırayla yaylanarak gelir, selamlama "pop" ile belirir
  const sectionBody = motion
    ? `<motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22, delay: index * 0.08 }}
    >
      ${indent(kit.section, 2).trim()}
    </motion.div>`
    : kit.section;
  const greetingLine = motion
    ? `{greeting && (
          <motion.p
            key={greeting}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="${L.greeting}"
          >
            {greeting}
          </motion.p>
        )}`
    : `{greeting && <p className="${L.greeting}">{greeting}</p>}`;

  const statusRows = backend
    ? `<li className="${L.row}">
            <span>Frontend</span>
            <StatusBadge status="ok" />
          </li>
          <li className="${L.row}">
            <span>Backend</span>
            <StatusBadge status={backend} />
          </li>
          {Object.entries(checks).map(([label, status]) => (
            <li key={label} className="${L.row}">
              <span>{label}</span>
              <StatusBadge status={status} />
            </li>
          ))}`
    : `{SETUP.map((label) => (
            <li key={label} className="${L.row}">
              <span>{label}</span>
              <StatusBadge status="ok" />
            </li>
          ))}`;

  const greet = backend
    ? `const greet = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const data = await getHello(visitor.trim() || ${T.js('defaultName')})
      setGreeting(data.message)
    } catch {
      setGreeting(${T.js('unreachable')})
    }
  }`
    : `const greet = (event: FormEvent) => {
    event.preventDefault()
    const name = visitor.trim() || ${T.js('defaultName')}
    setGreeting(${i18n ? "t('greeting', { name })" : "'Merhaba, ' + name + '!'"})
  }`;

  const backendState = backend
    ? `  const [backend, setBackend] = useState<Status>('loading')
  const [checks, setChecks] = useState<Record<string, Status>>({})
`
    : '';
  const backendLogic = backend
    ? `
  const refresh = useCallback(() => {
    getHello()
      .then((data) => {
        setBackend('ok')
        setChecks(data.checks)
      })
      .catch(() => setBackend('error'))
  }, [])

  useEffect(refresh, [refresh])

  const recheck = () => {
    setBackend('loading')
    refresh()
  }
`
    : '';
  const languageButton = i18n
    ? `\n        ${kit.secondaryButton(T.child('switchLanguage'), "() => i18n.changeLanguage(i18n.language.startsWith('tr') ? 'en' : 'tr')")}`
    : '';

  return `${imports.join('\n')}

${STATUS_TYPE}
${backend ? `\n${HELLO_RESPONSE}\n` : ''}${i18n ? '' : `\n${LABELS}\n`}${plainTailwind ? `\n${TAILWIND_BADGES}\n` : ''}${backend ? `\n${getHelloFunction(axios)}\n` : `\n/** Kurulan araçlar */\nconst SETUP = ${JSON.stringify(setupRows('react', options))}\n`}
function StatusBadge({ status }: { status: Status }) {${i18n ? '\n  const { t } = useTranslation()' : ''}
  const label = ${T.status('status')}
  return ${kit.badge}
}

function Section({ title, ${motion ? 'index = 0, ' : ''}children }: { title: string; ${motion ? 'index?: number; ' : ''}children: ReactNode }) {
  return (
    ${sectionBody}
  )
}

/** Kurulumun çalıştığını gösteren başlangıç sayfası. Kendi sayfalarınla değiştir. */
export default function StatusPage() {${i18n ? '\n  const { t, i18n } = useTranslation()' : ''}
${backendState}  const [visitor, setVisitor] = useState('')
  const [greeting, setGreeting] = useState('')
${backendLogic}
  ${greet}

  return (
    <main className="${L.page}">
      <div className="${L.header}">
        <div>
          <h1 className="${L.h1}">${name}</h1>
          <p className="${L.lead}">${T.child(backend ? 'lead' : 'leadFrontend')}</p>
        </div>${languageButton}
      </div>

      <Section ${T.attr('title', backend ? 'statusTitle' : 'setupTitle')}>
        <ul className="${L.list}">
          ${statusRows}
        </ul>${backend ? `\n        <div>${kit.secondaryButton(T.child('recheck'), 'recheck')}</div>` : ''}
      </Section>

      <Section ${T.attr('title', 'helloTitle')}${motion ? ' index={1}' : ''}>
        <p className="${L.muted}">${T.child(backend ? 'helloText' : 'helloTextLocal')}</p>
        <form onSubmit={greet} className="${L.form}">
          ${kit.input((attr) => T.attr(attr, 'placeholder'))}
          ${kit.button(T.child('send'))}
        </form>
        ${greetingLine}
      </Section>
    </main>
  )
}
`;
}

/** React vitest testi: bazı kütüphaneler jsdom'da olmayan tarayıcı API'lerini ister */
export function reactStartPageTest({ name, options }: StartPageOptions): string {
  const mantine = options.has('mantine');
  return `import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
${mantine ? "import { MantineProvider } from '@mantine/core'\n" : ''}${options.has('i18n') ? "import '../i18n'\n" : ''}import StatusPage from './StatusPage'

// Test ortamında (jsdom) olmayan tarayıcı API'leri: bazı UI kütüphaneleri bunları kullanır
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
if (!('ResizeObserver' in globalThis)) {
  Object.assign(globalThis, {
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
}

describe('StatusPage', () => {
  it('proje adını gösterir', () => {
    render(${mantine ? '\n      <MantineProvider>\n        <StatusPage />\n      </MantineProvider>,\n    ' : '<StatusPage />'})
    expect(screen.getByRole('heading', { name: '${name}' })).toBeInTheDocument()
  })
})
`;
}

/** react-i18next kurulumu: tarayıcı dili veya son seçilen dil, seçim localStorage'da saklanır */
export const REACT_I18N = `import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import tr from './locales/tr'

const saved = localStorage.getItem('lang')
const browser = navigator.language.startsWith('tr') ? 'tr' : 'en'

void i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: saved ?? browser,
  fallbackLng: 'en',
  // React zaten kaçış yapıyor
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('lang', lng)
  document.documentElement.lang = lng
})
document.documentElement.lang = i18n.language

export default i18n
`;

/** vue-i18n kurulumu (Composition API), seçilen dil localStorage'da saklanır */
export const VUE_I18N = `import { createI18n } from 'vue-i18n'
import en from './locales/en'
import tr from './locales/tr'

const saved = localStorage.getItem('lang')
const browser = navigator.language.startsWith('tr') ? 'tr' : 'en'

const i18n = createI18n({
  legacy: false,
  locale: saved ?? browser,
  fallbackLocale: 'en',
  messages: { tr, en },
})

document.documentElement.lang = i18n.global.locale.value

export default i18n
`;

// ---------------------------------------------------------------------------
// Vue
// ---------------------------------------------------------------------------

interface TemplateKit {
  imports: string[];
  /** Kart; titleKey metin anahtarı */
  card: (T: Texts, titleKey: TextKey, body: string) => string;
  /** Durum rozeti; x durum ifadesi, label metin ifadesi (şablon içinde) */
  badge: (x: string, label: string) => string;
  button: (T: Texts, key: TextKey) => string;
  secondaryButton: (T: Texts, key: TextKey, handler: string) => string;
  input: (T: Texts) => string;
  /** Şablonda kullanılan yardımcı fonksiyonlar (rozet rengi gibi) */
  script?: string;
}

function vueKit(options: Set<string>, L: Layout): TemplateKit {
  if (options.has('vuetify')) {
    return {
      imports: [],
      card: (T, key, body) => `<v-card ${T.attr('title', key)} variant="outlined">
  <v-card-text>
    <div class="${L.stack}">
${indent(body, 6)}
    </div>
  </v-card-text>
</v-card>`,
      badge: (x, label) => `<v-chip size="small" :color="chipColor(${x})">{{ ${label} }}</v-chip>`,
      button: (T, key) => `<v-btn color="primary" type="submit">${T.child(key)}</v-btn>`,
      secondaryButton: (T, key, handler) => `<v-btn variant="outlined" size="small" @click="${handler}">${T.child(key)}</v-btn>`,
      input: (T) => `<v-text-field v-model="visitor" ${T.attr('label', 'placeholder')} density="compact" variant="outlined" hide-details />`,
      script: `function chipColor(status: Status) {
  return status === 'ok' ? 'success' : status === 'error' ? 'error' : undefined
}`,
    };
  }
  if (options.has('primevue')) {
    return {
      imports: [
        "import Button from 'primevue/button'",
        "import Card from 'primevue/card'",
        "import InputText from 'primevue/inputtext'",
        "import Tag from 'primevue/tag'",
      ],
      card: (T, key, body) => `<Card>
  <template #title>${T.child(key)}</template>
  <template #content>
    <div class="${L.stack}">
${indent(body, 6)}
    </div>
  </template>
</Card>`,
      badge: (x, label) => `<Tag :value="${label}" :severity="severity(${x})" />`,
      button: (T, key) => `<Button type="submit" ${T.attr('label', key)} />`,
      secondaryButton: (T, key, handler) => `<Button ${T.attr('label', key)} severity="secondary" size="small" @click="${handler}" />`,
      input: (T) => `<InputText v-model="visitor" ${T.attr('placeholder', 'placeholder')} class="${L.grow}" />`,
      script: `function severity(status: Status) {
  return status === 'ok' ? 'success' : status === 'error' ? 'danger' : 'secondary'
}`,
    };
  }
  if (options.has('element-plus')) {
    return {
      imports: [],
      card: (T, key, body) => `<el-card shadow="never">
  <template #header>${T.child(key)}</template>
  <div class="${L.stack}">
${indent(body, 4)}
  </div>
</el-card>`,
      badge: (x, label) => `<el-tag :type="tagType(${x})">{{ ${label} }}</el-tag>`,
      button: (T, key) => `<el-button type="primary" native-type="submit">${T.child(key)}</el-button>`,
      secondaryButton: (T, key, handler) => `<el-button size="small" @click="${handler}">${T.child(key)}</el-button>`,
      input: (T) => `<el-input v-model="visitor" ${T.attr('placeholder', 'placeholder')} class="${L.grow}" />`,
      script: `function tagType(status: Status) {
  return status === 'ok' ? 'success' : status === 'error' ? 'danger' : 'info'
}`,
    };
  }
  const tailwind = options.has('tailwind');
  return {
    imports: [],
    card: (T, key, body) => `<section class="${L.card}">
  <h2 class="${L.cardTitle}">${T.child(key)}</h2>
${indent(body, 2)}
</section>`,
    badge: (x, label) => tailwind
      ? `<span :class="['${TAILWIND_BADGE_BASE}', BADGE_CLASSES[${x}]]">{{ ${label} }}</span>`
      : `<span :class="['badge', 'badge-' + ${x}]">{{ ${label} }}</span>`,
    button: (T, key) => `<button type="submit" class="${L.button}">${T.child(key)}</button>`,
    secondaryButton: (T, key, handler) => `<button type="button" class="${L.secondaryButton}" @click="${handler}">${T.child(key)}</button>`,
    input: (T) => `<input v-model="visitor" ${T.attr('placeholder', 'placeholder')} class="${L.input}" />`,
  };
}

export function vueStartPage({ name, options, backend }: StartPageOptions): string {
  const L = layoutFor(options);
  const kit = vueKit(options, L);
  const i18n = options.has('i18n');
  const T = textsFor('vue', i18n);
  const plainTailwind = options.has('tailwind') && !['vuetify', 'primevue', 'element-plus'].some((k) => options.has(k));
  const axios = backend && options.has('axios');
  const badge = (x: string) => kit.badge(x, T.status(x));

  const imports = [
    `import { ${backend ? 'onMounted, ' : ''}ref } from 'vue'`,
    ...(i18n ? ["import { useI18n } from 'vue-i18n'"] : []),
    ...kit.imports,
    ...(axios ? ["import { api } from '../lib/api'"] : []),
    ...(needsStartPageCss(options) ? ["import './status.css'"] : []),
  ];

  const rows = backend
    ? `<li class="${L.row}">
  <span>Frontend</span>
  ${badge("'ok'")}
</li>
<li class="${L.row}">
  <span>Backend</span>
  ${badge('backend')}
</li>
<li v-for="(status, label) in checks" :key="label" class="${L.row}">
  <span>{{ label }}</span>
  ${badge('status')}
</li>`
    : `<li v-for="label in SETUP" :key="label" class="${L.row}">
  <span>{{ label }}</span>
  ${badge("'ok'")}
</li>`;

  const statusCard = kit.card(T, backend ? 'statusTitle' : 'setupTitle', `<ul class="${L.list}">
${indent(rows, 2)}
</ul>${backend ? `\n<div>${kit.secondaryButton(T, 'recheck', 'recheck')}</div>` : ''}`);

  const helloCard = kit.card(T, 'helloTitle', `<p class="${L.muted}">${T.child(backend ? 'helloText' : 'helloTextLocal')}</p>
<form class="${L.form}" @submit.prevent="greet">
  ${kit.input(T)}
  ${kit.button(T, 'send')}
</form>
<p v-if="greeting" class="${L.greeting}">{{ greeting }}</p>`);

  const backendScript = backend
    ? `const backend = ref<Status>('loading')
const checks = ref<Record<string, Status>>({})
const visitor = ref('')
const greeting = ref('')

function refresh() {
  getHello()
    .then((data) => {
      backend.value = 'ok'
      checks.value = data.checks
    })
    .catch(() => {
      backend.value = 'error'
    })
}

function recheck() {
  backend.value = 'loading'
  refresh()
}

async function greet() {
  try {
    greeting.value = (await getHello(visitor.value.trim() || ${T.js('defaultName')})).message
  } catch {
    greeting.value = ${T.js('unreachable')}
  }
}

onMounted(refresh)`
    : `const visitor = ref('')
const greeting = ref('')

function greet() {
  const name = visitor.value.trim() || ${T.js('defaultName')}
  greeting.value = ${i18n ? "t('greeting', { name })" : "'Merhaba, ' + name + '!'"}
}`;

  const languageScript = i18n
    ? `
const { t, locale } = useI18n()

function toggleLanguage() {
  locale.value = locale.value === 'tr' ? 'en' : 'tr'
  localStorage.setItem('lang', locale.value)
  document.documentElement.lang = locale.value
}
`
    : '';

  return `<script setup lang="ts">
${imports.join('\n')}

${STATUS_TYPE}
${backend ? `\n${HELLO_RESPONSE}\n` : ''}${i18n ? '' : `\n${LABELS}\n`}${plainTailwind ? `\n${TAILWIND_BADGES}\n` : ''}${kit.script ? `\n${kit.script}\n` : ''}${backend ? `\n${getHelloFunction(axios)}\n` : `\n/** Kurulan araçlar */\nconst SETUP = ${JSON.stringify(setupRows('vue', options))}\n`}${languageScript}
${backendScript}
</script>

<!-- Kurulumun çalıştığını gösteren başlangıç sayfası. Kendi sayfalarınla değiştir. -->
<template>
  <main class="${L.page}">
    <div class="${L.header}">
      <div>
        <h1 class="${L.h1}">${name}</h1>
        <p class="${L.lead}">${T.child(backend ? 'lead' : 'leadFrontend')}</p>
      </div>${i18n ? `\n      ${kit.secondaryButton(T, 'switchLanguage', 'toggleLanguage')}` : ''}
    </div>

${indent(statusCard, 4)}

${indent(helloCard, 4)}
  </main>
</template>
`;
}

// ---------------------------------------------------------------------------
// Svelte (UI kütüphanesi ve çoklu dil seçeneği yok: düz CSS veya Tailwind)
// ---------------------------------------------------------------------------

export function svelteStartPage({ name, options, backend }: StartPageOptions): string {
  const L = layoutFor(options);
  const T = textsFor('svelte', false);
  const tailwind = options.has('tailwind');
  const axios = backend && options.has('axios');
  const badge = (x: string) => tailwind
    ? `<span class="${TAILWIND_BADGE_BASE} {BADGE_CLASSES[${x}]}">{statusLabel(${x})}</span>`
    : `<span class="badge badge-{${x}}">{statusLabel(${x})}</span>`;
  const imports = [
    ...(backend ? ["import { onMount } from 'svelte'"] : []),
    // Status tipi sadece backend durumunda ve Tailwind rozet sınıflarında gerekiyor
    `import { statusLabel${backend || tailwind ? ', type Status' : ''} } from './lib/status'`,
    ...(axios ? ["import { api } from './lib/api'"] : []),
    ...(needsStartPageCss(options) ? ["import './lib/status.css'"] : []),
  ];

  const script = backend
    ? `${indent(HELLO_RESPONSE, 2)}
${tailwind ? `\n${indent(TAILWIND_BADGES, 2)}\n` : ''}
${indent(getHelloFunction(axios), 2)}

  let backend = $state<Status>('loading')
  let checks = $state<Record<string, Status>>({})
  let visitor = $state('')
  let greeting = $state('')

  function refresh() {
    getHello()
      .then((data) => {
        backend = 'ok'
        checks = data.checks
      })
      .catch(() => {
        backend = 'error'
      })
  }

  function recheck() {
    backend = 'loading'
    refresh()
  }

  async function greet(event: SubmitEvent) {
    event.preventDefault()
    try {
      greeting = (await getHello(visitor.trim() || ${T.js('defaultName')})).message
    } catch {
      greeting = ${T.js('unreachable')}
    }
  }

  onMount(refresh)`
    : `/** Kurulan araçlar */
  const SETUP = ${JSON.stringify(setupRows('svelte', options))}
${tailwind ? `\n${indent(TAILWIND_BADGES, 2)}\n` : ''}
  let visitor = $state('')
  let greeting = $state('')

  function greet(event: SubmitEvent) {
    event.preventDefault()
    greeting = 'Merhaba, ' + (visitor.trim() || ${T.js('defaultName')}) + '!'
  }`;

  const rows = backend
    ? `      <li class="${L.row}"><span>Frontend</span>${badge("'ok'")}</li>
      <li class="${L.row}"><span>Backend</span>${badge('backend')}</li>
      {#each Object.entries(checks) as [label, status] (label)}
        <li class="${L.row}"><span>{label}</span>${badge('status')}</li>
      {/each}`
    : `      {#each SETUP as label (label)}
        <li class="${L.row}"><span>{label}</span>${badge("'ok'")}</li>
      {/each}`;

  return `<script lang="ts">
${indent(imports.join('\n'), 2)}

  ${script}
</script>

<!-- Kurulumun çalıştığını gösteren başlangıç sayfası. Kendi sayfalarınla değiştir. -->
<main class="${L.page}">
  <div>
    <h1 class="${L.h1}">${name}</h1>
    <p class="${L.lead}">${T.child(backend ? 'lead' : 'leadFrontend')}</p>
  </div>

  <section class="${L.card}">
    <h2 class="${L.cardTitle}">${T.child(backend ? 'statusTitle' : 'setupTitle')}</h2>
    <ul class="${L.list}">
${rows}
    </ul>${backend ? `\n    <div><button type="button" class="${L.secondaryButton}" onclick={recheck}>${T.child('recheck')}</button></div>` : ''}
  </section>

  <section class="${L.card}">
    <h2 class="${L.cardTitle}">${T.child('helloTitle')}</h2>
    <p class="${L.muted}">${T.child(backend ? 'helloText' : 'helloTextLocal')}</p>
    <form class="${L.form}" onsubmit={greet}>
      <input bind:value={visitor} ${T.attr('placeholder', 'placeholder')} class="${L.input}" />
      <button type="submit" class="${L.button}">${T.child('send')}</button>
    </form>
    {#if greeting}
      <p class="${L.greeting}">{greeting}</p>
    {/if}
  </section>
</main>
`;
}

// ---------------------------------------------------------------------------
// Angular (çoklu dil seçeneği yok)
// ---------------------------------------------------------------------------

function angularKit(options: Set<string>, L: Layout): TemplateKit & { modules: string[] } {
  const input = (attrs: string, T: Texts) =>
    `<input ${attrs}#nameInput [value]="visitor()" (input)="visitor.set(nameInput.value)" ${T.attr('placeholder', 'placeholder')} />`;
  const plainBadge = (x: string, label: string) => options.has('tailwind')
    ? `<span [class]="'${TAILWIND_BADGE_BASE} ' + badgeClasses[${x}]">{{ ${label} }}</span>`
    : `<span [class]="'badge badge-' + ${x}">{{ ${label} }}</span>`;

  if (options.has('angular-material')) {
    return {
      imports: [
        "import { MatButtonModule } from '@angular/material/button'",
        "import { MatCardModule } from '@angular/material/card'",
        "import { MatFormFieldModule } from '@angular/material/form-field'",
        "import { MatInputModule } from '@angular/material/input'",
      ],
      modules: ['MatButtonModule', 'MatCardModule', 'MatFormFieldModule', 'MatInputModule'],
      card: (T, key, body) => `<mat-card appearance="outlined">
  <mat-card-header>
    <mat-card-title>${T.child(key)}</mat-card-title>
  </mat-card-header>
  <mat-card-content>
    <div class="${L.stack}">
${indent(body, 6)}
    </div>
  </mat-card-content>
</mat-card>`,
      badge: plainBadge,
      button: (T, key) => `<button mat-flat-button type="submit">${T.child(key)}</button>`,
      secondaryButton: (T, key, handler) => `<button mat-stroked-button type="button" (click)="${handler}">${T.child(key)}</button>`,
      input: (T) => `<mat-form-field appearance="outline" subscriptSizing="dynamic" class="${L.grow}">
    <mat-label>${T.child('placeholder')}</mat-label>
    <input matInput #nameInput [value]="visitor()" (input)="visitor.set(nameInput.value)" />
  </mat-form-field>`,
    };
  }
  if (options.has('primeng')) {
    return {
      imports: [
        "import { ButtonModule } from 'primeng/button'",
        "import { CardModule } from 'primeng/card'",
        "import { InputTextModule } from 'primeng/inputtext'",
        "import { TagModule } from 'primeng/tag'",
      ],
      modules: ['ButtonModule', 'CardModule', 'InputTextModule', 'TagModule'],
      card: (T, key, body) => `<p-card ${T.attr('header', key)}>
  <div class="${L.stack}">
${indent(body, 4)}
  </div>
</p-card>`,
      badge: (x, label) => `<p-tag [value]="${label}" [severity]="severity(${x})" />`,
      button: (T, key) => `<p-button type="submit" ${T.attr('label', key)} />`,
      secondaryButton: (T, key, handler) => `<p-button type="button" ${T.attr('label', key)} severity="secondary" size="small" (onClick)="${handler}" />`,
      input: (T) => input(`pInputText class="${L.grow}" `, T),
    };
  }
  return {
    imports: [],
    modules: [],
    card: (T, key, body) => `<section class="${L.card}">
  <h2 class="${L.cardTitle}">${T.child(key)}</h2>
${indent(body, 2)}
</section>`,
    badge: plainBadge,
    button: (T, key) => `<button type="submit" class="${L.button}">${T.child(key)}</button>`,
    secondaryButton: (T, key, handler) => `<button type="button" class="${L.secondaryButton}" (click)="${handler}">${T.child(key)}</button>`,
    input: (T) => input(`class="${L.input}" `, T),
  };
}

/** Angular bileşeni: status-page.ts + status-page.html (+ düz CSS düzeninde status-page.css) */
export function angularStartPage({ name, options, backend }: StartPageOptions): Record<string, string> {
  const L = layoutFor(options);
  const kit = angularKit(options, L);
  const T = textsFor('angular', false);
  const css = needsStartPageCss(options);
  const tailwindBadges = options.has('tailwind') && !options.has('primeng');
  const primeng = options.has('primeng');
  const badge = (x: string) => kit.badge(x, T.status(x));

  const rows = backend
    ? `<li class="${L.row}">
  <span>Frontend</span>
  ${badge("'ok'")}
</li>
<li class="${L.row}">
  <span>Backend</span>
  ${badge('backend()')}
</li>
@for (check of checks(); track check[0]) {
  <li class="${L.row}">
    <span>{{ check[0] }}</span>
    ${badge('check[1]')}
  </li>
}`
    : `@for (label of setup; track label) {
  <li class="${L.row}">
    <span>{{ label }}</span>
    ${badge("'ok'")}
  </li>
}`;

  const statusCard = kit.card(T, backend ? 'statusTitle' : 'setupTitle', `<ul class="${L.list}">
${indent(rows, 2)}
</ul>${backend ? `\n<div>${kit.secondaryButton(T, 'recheck', 'recheck()')}</div>` : ''}`);

  const helloCard = kit.card(T, 'helloTitle', `<p class="${L.muted}">${T.child(backend ? 'helloText' : 'helloTextLocal')}</p>
<form class="${L.form}" (submit)="greet($event)">
  ${kit.input(T)}
  ${kit.button(T, 'send')}
</form>
@if (greeting()) {
  <p class="${L.greeting}">{{ greeting() }}</p>
}`);

  const members = backend
    ? `  private readonly http = inject(HttpClient)

  protected readonly labels = LABELS${tailwindBadges ? '\n  protected readonly badgeClasses = BADGE_CLASSES' : ''}
  protected readonly backend = signal<Status>('loading')
  protected readonly checks = signal<[string, Status][]>([])
  protected readonly visitor = signal('')
  protected readonly greeting = signal('')

  ngOnInit(): void {
    this.refresh()
  }

  protected recheck(): void {
    this.backend.set('loading')
    this.refresh()
  }

  /** Backend'deki örnek endpoint: GET /api/hello?name=... */
  protected greet(event: Event): void {
    event.preventDefault()
    const name = this.visitor().trim() || ${T.js('defaultName')}
    this.http.get<HelloResponse>('/api/hello', { params: { name } }).subscribe({
      next: (data) => this.greeting.set(data.message),
      error: () => this.greeting.set(${T.js('unreachable')}),
    })
  }
${primeng ? `
  protected severity(status: Status): 'success' | 'danger' | 'secondary' {
    return status === 'ok' ? 'success' : status === 'error' ? 'danger' : 'secondary'
  }
` : ''}
  private refresh(): void {
    this.http.get<HelloResponse>('/api/hello').subscribe({
      next: (data) => {
        this.backend.set('ok')
        this.checks.set(Object.entries(data.checks))
      },
      error: () => this.backend.set('error'),
    })
  }`
    : `  /** Kurulan araçlar */
  protected readonly setup = ${JSON.stringify(setupRows('angular', options))}
  protected readonly labels = LABELS${tailwindBadges ? '\n  protected readonly badgeClasses = BADGE_CLASSES' : ''}
  protected readonly visitor = signal('')
  protected readonly greeting = signal('')

  protected greet(event: Event): void {
    event.preventDefault()
    this.greeting.set('Merhaba, ' + (this.visitor().trim() || ${T.js('defaultName')}) + '!')
  }
${primeng ? `
  protected severity(status: Status): 'success' | 'danger' | 'secondary' {
    return status === 'ok' ? 'success' : status === 'error' ? 'danger' : 'secondary'
  }
` : ''}`;

  const angularImports = backend
    ? "import { HttpClient } from '@angular/common/http'\nimport { Component, inject, OnInit, signal } from '@angular/core'"
    : "import { Component, signal } from '@angular/core'";

  const ts = `${angularImports}
${kit.imports.map((i) => `${i}\n`).join('')}
${STATUS_TYPE}
${backend ? `\n${HELLO_RESPONSE}\n` : ''}
${LABELS}
${tailwindBadges ? `\n${TAILWIND_BADGES}\n` : ''}
/** Kurulumun çalıştığını gösteren başlangıç sayfası. Kendi sayfalarınla değiştir. */
@Component({
  selector: 'app-status-page',${kit.modules.length ? `\n  imports: [${kit.modules.join(', ')}],` : ''}
  templateUrl: './status-page.html',${css ? "\n  styleUrl: './status-page.css'," : ''}
})
export class StatusPage${backend ? ' implements OnInit' : ''} {
${members}
}
`;

  const html = `<main class="${L.page}">
  <div>
    <h1 class="${L.h1}">${name}</h1>
    <p class="${L.lead}">${T.child(backend ? 'lead' : 'leadFrontend')}</p>
  </div>

${indent(statusCard, 2)}

${indent(helloCard, 2)}
</main>
`;

  return {
    'src/app/pages/status-page.ts': ts,
    'src/app/pages/status-page.html': html,
    ...(css ? { 'src/app/pages/status-page.css': START_PAGE_CSS } : {}),
  };
}
