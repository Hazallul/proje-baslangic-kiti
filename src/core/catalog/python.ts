import type { PythonTemplate } from '../types.js';
import type { HelpText } from './help.js';

/** Python projelerinde paketlerin sürüm alt sınırları (requirements.txt'e yazılır) */
export const PYTHON_PACKAGES = {
  pygame: 'pygame-ce>=2.5',
  fastapi: 'fastapi>=0.115',
  uvicorn: 'uvicorn[standard]>=0.30',
  anthropic: 'anthropic>=1.0',
  dotenv: 'python-dotenv>=1.0',
  pytest: 'pytest>=8.0',
  httpx: 'httpx>=0.27',
  ruff: 'ruff>=0.6',
  pyinstaller: 'pyinstaller>=6.10',
} as const;

/** Oluşturulan projelerin istediği en düşük Python sürümü */
export const MIN_PYTHON = { major: 3, minor: 10 } as const;

export interface PythonOptionDef {
  id: string;
  label: string;
  description: string;
  help: HelpText;
}

export const PYTHON_OPTIONS: PythonOptionDef[] = [
  {
    id: 'ai',
    label: 'Claude ile AI',
    description: 'Anthropic SDK, .env\'de API anahtarı, hazır ask() fonksiyonu',
    help: {
      what: 'Projeye Claude\'a soru sorup cevap alan küçük bir modül (ai.py) eklenir. API anahtarı .env dosyasından okunur, koda yazılmaz.',
      when: 'Projende yapay zekâ kullanacaksan: karakterlerin düşünmesi, metin özetleme, sohbet. Anahtarı console.anthropic.com\'dan alırsın.',
      level: 'İhtiyaç olursa',
    },
  },
  {
    id: 'tests',
    label: 'pytest',
    description: 'Örnek testler ve VS Code test paneli ayarı',
    help: {
      what: 'Python\'un en yaygın test aracı. Projeye çalışan örnek testler eklenir; VS Code\'un Test panelinden tek tıkla çalışır.',
      when: 'Neredeyse her zaman. Kodu değiştirince bir şeyin bozulup bozulmadığını saniyeler içinde görürsün.',
      level: 'Önerilir',
    },
  },
  {
    id: 'lint',
    label: 'Ruff',
    description: 'Hızlı lint ve otomatik biçimlendirme',
    help: {
      what: 'Kodu tarayıp hataları ve kötü alışkanlıkları gösterir, kaydedince biçimlendirir. Rust ile yazıldığı için çok hızlıdır.',
      when: 'Kodun düzenli kalsın istiyorsan. VS Code\'da Ruff eklentisi önerilir, kaydederken otomatik çalışır.',
      level: 'Önerilir',
    },
  },
  {
    id: 'exe',
    label: '.exe paketleme',
    description: 'PyInstaller ile tek dosyalık exe üreten build_exe.py',
    help: {
      what: 'python build_exe.py komutu programını dist/ klasöründe tek bir .exe dosyasına paketler. Python kurulu olmayan bir bilgisayarda da çalışır.',
      when: 'Programını başkasına göndermek ya da çift tıklayıp açmak istiyorsan. İmzasız exe\'yi Windows Smart App Control engelleyebilir.',
      level: 'İhtiyaç olursa',
    },
  },
  {
    id: 'docker',
    label: 'Dockerfile',
    description: 'API\'yi container olarak çalıştırmak için',
    help: {
      what: 'API\'yi Python kurmadan Docker içinde çalıştıran bir Dockerfile ve compose.yaml eklenir.',
      when: 'API\'yi bir sunucuya taşıyacaksan ya da başka servislerle birlikte çalıştıracaksan.',
      level: 'İhtiyaç olursa',
    },
  },
];

export interface PythonTemplateDef {
  id: PythonTemplate;
  label: string;
  /** Kartta görünen kısa açıklama */
  description: string;
  /** Kartta içerik olarak listelenen ana parçalar */
  includes: string[];
  /** Açılış ekranındaki Python kartında, şablon adının yanındaki kısa özet */
  summary: string;
  /** Kurulumdan sonra içe aktarılıp denenen modüller (çalışıyor mu, engelleniyor mu) */
  imports: string[];
  options: string[];
  defaultOptions: string[];
  help: HelpText;
}

export const PYTHON_TEMPLATES: PythonTemplateDef[] = [
  {
    id: 'game',
    label: 'Oyun / simülasyon',
    description: 'Pixel-art harita, yürüyen karakterler, saat ve kamera',
    includes: ['pygame-ce', 'oyun döngüsü', 'tıklanabilir karakterler'],
    summary: 'pygame-ce, pixel-art harita',
    imports: ['pygame'],
    options: ['ai', 'tests', 'lint', 'exe'],
    defaultOptions: ['tests', 'lint'],
    help: {
      what: 'pygame-ce ile 2D bir sandbox: kare kare çizilen bir kasaba haritası, kendi kendine dolaşan karakterler, gün/gece saati, kamera ve karakter seçme. Simülasyon mantığı pygame\'den ayrıdır, test edilebilir.',
      when: 'Oyun, ajan simülasyonu ya da görsel bir deney yapacaksan. AI seçeneğiyle karakterlere Claude ile düşündürmenin örneği de gelir.',
      level: 'Önerilir',
    },
  },
  {
    id: 'api',
    label: 'API · FastAPI',
    description: 'REST API, otomatik Swagger dokümantasyonu',
    includes: ['FastAPI', 'Swagger UI', 'örnek CRUD'],
    summary: 'Swagger UI, örnek CRUD',
    imports: ['fastapi'],
    options: ['ai', 'tests', 'lint', 'docker'],
    defaultOptions: ['tests', 'lint'],
    help: {
      what: 'Python\'un en popüler modern web framework\'üyle bir REST API. Tipler Pydantic ile doğrulanır, /docs adresinde Swagger arayüzü kendiliğinden gelir.',
      when: 'Bir frontend\'e ya da mobil uygulamaya veri sunacaksan, ya da bir AI modelini web üzerinden kullanılabilir yapacaksan.',
      level: 'Önerilir',
    },
  },
  {
    id: 'cli',
    label: 'Konsol uygulaması',
    description: 'Komut satırı programı, istersen tek .exe',
    includes: ['argparse alt komutları'],
    summary: 'istersen tek .exe',
    imports: [],
    options: ['ai', 'tests', 'lint', 'exe'],
    defaultOptions: ['tests', 'lint', 'exe'],
    help: {
      what: 'Terminalden çalışan, alt komutları olan bir program (ör. uygulama merhaba --ad Ada). Ek kütüphane gerektirmez.',
      when: 'Otomasyon script\'i, dosya işleme aracı ya da küçük bir yardımcı program yazacaksan.',
      level: 'İhtiyaç olursa',
    },
  },
];

export function findPythonTemplate(id: PythonTemplate): PythonTemplateDef {
  const template = PYTHON_TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`Bilinmeyen Python şablonu: ${id}`);
  return template;
}

export function findPythonOption(id: string): PythonOptionDef {
  const option = PYTHON_OPTIONS.find((o) => o.id === id);
  if (!option) throw new Error(`Bilinmeyen Python seçeneği: ${id}`);
  return option;
}

/**
 * Proje adı Python paket adı olarak da kullanılır (tireler alt çizgi olur). Bu adlar Python'da
 * ayrılmış kelime ya da projede import edilen bir modülle çakışıyor; paket o modülü gölgeler.
 */
export const PYTHON_RESERVED = new Set([
  // Ayrılmış kelimeler
  'false', 'none', 'true', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif',
  'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or',
  'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
  // Şablonların kullandığı paketler
  'pygame', 'fastapi', 'uvicorn', 'anthropic', 'dotenv', 'pytest', 'httpx', 'pydantic', 'starlette', 'pyinstaller',
  // Sık çakışan standart kütüphane modülleri
  'abc', 'argparse', 'array', 'ast', 'asyncio', 'base64', 'collections', 'concurrent', 'copy', 'csv', 'dataclasses',
  'datetime', 'decimal', 'email', 'enum', 'functools', 'glob', 'hashlib', 'heapq', 'html', 'http', 'importlib',
  'inspect', 'io', 'itertools', 'json', 'logging', 'math', 'multiprocessing', 'operator', 'os', 'pathlib', 'pickle',
  'platform', 'queue', 'random', 're', 'secrets', 'select', 'shutil', 'signal', 'site', 'socket', 'sqlite3', 'ssl',
  'statistics', 'string', 'struct', 'subprocess', 'sys', 'tempfile', 'test', 'tests', 'threading', 'time', 'tkinter',
  'token', 'tokenize', 'types', 'typing', 'unittest', 'urllib', 'uuid', 'warnings', 'weakref', 'xml', 'zipfile',
]);

/** Proje adından Python paket (modül) adı: my-game → my_game */
export function pythonPackageName(projectName: string): string {
  return projectName.replace(/-/g, '_');
}
