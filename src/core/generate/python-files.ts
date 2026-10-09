/**
 * Python projelerinin dosyaları. Saf fonksiyonlar (Node modülü kullanmaz): hem üretici hem de
 * arayüzdeki canlı önizleme aynı listeyi kullanır, böylece önizleme gerçek çıktıyla birebir aynıdır.
 *
 * Python kaynakları String.raw ile yazılır: içlerindeki \n gibi kaçış dizileri Python'a aynen geçer.
 */
import { PYTHON_PACKAGES, pythonPackageName } from '../catalog/python.js';
import { pythonOptionsOf } from '../selection.js';
import type { PythonTemplate, Selection } from '../types.js';

const py = String.raw;

export interface PythonContext {
  /** Proje adı (klasör adı), ör. enerji-kasabasi */
  name: string;
  /** Python paket adı, ör. enerji_kasabasi */
  pkg: string;
  /** Pencere başlığı ve README başlığı, ör. Enerji Kasabasi */
  title: string;
  template: PythonTemplate;
  options: Set<string>;
  /** Windows'ta mı üretiliyor: sanal ortam yolları (.venv\Scripts ya da .venv/bin) buna göre yazılır */
  windows: boolean;
}

export function pythonContext(sel: Selection, windows: boolean): PythonContext {
  return {
    name: sel.name,
    pkg: pythonPackageName(sel.name),
    title: sel.name.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' '),
    template: sel.python.template,
    options: pythonOptionsOf(sel),
    windows,
  };
}

/** Sanal ortamdaki python, proje klasörüne göre */
export function venvPython(windows: boolean): string {
  return windows ? '.venv\\Scripts\\python' : '.venv/bin/python';
}

/** Kurulumda kullanılacak paket listesi: geliştirme araçları varsa onları da içeren dosya */
export function requirementsFileOf(ctx: PythonContext): string {
  return devRequirements(ctx).length ? 'requirements-dev.txt' : 'requirements.txt';
}

export function runtimeRequirements(ctx: PythonContext): string[] {
  const list: string[] = [];
  if (ctx.template === 'game') list.push(PYTHON_PACKAGES.pygame);
  if (ctx.template === 'api') list.push(PYTHON_PACKAGES.fastapi, PYTHON_PACKAGES.uvicorn);
  if (ctx.options.has('ai')) list.push(PYTHON_PACKAGES.anthropic, PYTHON_PACKAGES.dotenv);
  return list;
}

export function devRequirements(ctx: PythonContext): string[] {
  const list: string[] = [];
  if (ctx.options.has('tests')) list.push(PYTHON_PACKAGES.pytest);
  if (ctx.options.has('tests') && ctx.template === 'api') list.push(PYTHON_PACKAGES.httpx);
  if (ctx.options.has('lint')) list.push(PYTHON_PACKAGES.ruff);
  if (ctx.options.has('exe')) list.push(PYTHON_PACKAGES.pyinstaller);
  return list;
}

/** Bitiş ekranında ve README'de gösterilen komutlar */
export function pythonCommands(ctx: PythonContext): { label: string; command: string }[] {
  const python = venvPython(ctx.windows);
  const commands: { label: string; command: string }[] = [];
  if (ctx.template === 'game') commands.push({ label: 'Oyunu aç', command: `${python} -m ${ctx.pkg}` });
  if (ctx.template === 'api') commands.push({ label: 'API\'yi başlat', command: `${python} -m ${ctx.pkg}` });
  if (ctx.template === 'cli') commands.push({ label: 'Programı çalıştır', command: `${python} -m ${ctx.pkg} merhaba --ad Ada` });
  if (ctx.options.has('tests')) commands.push({ label: 'Testler', command: `${python} -m pytest` });
  if (ctx.options.has('lint')) commands.push({ label: 'Lint', command: `${python} -m ruff check .` });
  if (ctx.options.has('exe')) commands.push({ label: '.exe üret', command: `${python} build_exe.py` });
  return commands;
}

/** Projenin tüm dosyaları: { "göreli/yol": "içerik" } */
export function pythonFiles(ctx: PythonContext): Record<string, string> {
  const files: Record<string, string> = {
    'requirements.txt': requirementsTxt(runtimeRequirements(ctx), 'Programın çalışması için gereken paketler'),
    '.gitignore': gitignore(ctx),
    'README.md': readme(ctx),
    '.vscode/settings.json': vscodeSettings(ctx),
    '.vscode/launch.json': vscodeLaunch(ctx),
    '.vscode/extensions.json': vscodeExtensions(ctx),
    [`${ctx.pkg}/__init__.py`]: py`"""${ctx.title}."""

__version__ = "0.1.0"
`,
  };
  const dev = devRequirements(ctx);
  if (dev.length) files['requirements-dev.txt'] = requirementsTxt(['-r requirements.txt', ...dev], 'Geliştirme araçları (test, lint, paketleme)');
  const pyproject = pyprojectToml(ctx);
  if (pyproject) files['pyproject.toml'] = pyproject;
  if (ctx.options.has('ai')) {
    files['.env'] = envFile(false);
    files['.env.example'] = envFile(true);
    files[`${ctx.pkg}/ai.py`] = aiModule();
  }
  if (ctx.options.has('exe')) files['build_exe.py'] = buildExe(ctx);

  if (ctx.template === 'game') Object.assign(files, gameFiles(ctx));
  if (ctx.template === 'api') Object.assign(files, apiFiles(ctx));
  if (ctx.template === 'cli') Object.assign(files, cliFiles(ctx));
  return files;
}

// ---------------------------------------------------------------------------
// Ortak dosyalar
// ---------------------------------------------------------------------------

function requirementsTxt(lines: string[], comment: string): string {
  return `# ${comment}\n${lines.join('\n')}\n`;
}

function pyprojectToml(ctx: PythonContext): string | null {
  const parts: string[] = [];
  if (ctx.options.has('tests')) {
    parts.push(`[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]`);
  }
  if (ctx.options.has('lint')) {
    parts.push(`[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
# E/F: hatalar, I: import sırası, UP: yeni Python yazımı, B: sık yapılan hatalar
select = ["E", "F", "I", "UP", "B"]`);
  }
  if (!parts.length) return null;
  return `# Araç ayarları. Paketler requirements.txt dosyasında.\n\n${parts.join('\n\n')}\n`;
}

function gitignore(ctx: PythonContext): string {
  return [
    '.venv/',
    '__pycache__/',
    '*.pyc',
    '.pytest_cache/',
    '.ruff_cache/',
    ctx.options.has('ai') && '.env',
    ctx.options.has('exe') && 'build/\ndist/\n*.spec',
    '.DS_Store',
  ].filter(Boolean).join('\n') + '\n';
}

function envFile(example: boolean): string {
  return `# Claude API ayarları. ${example ? 'Bu dosyayı .env adıyla kopyalayıp anahtarını yaz.' : '.env git\'e eklenmez, anahtarını buraya yaz.'}
# Anahtar: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=
# Kullanılacak model
CLAUDE_MODEL=claude-opus-5-5
`;
}

function vscodeSettings(ctx: PythonContext): string {
  const settings: Record<string, unknown> = {
    'python.defaultInterpreterPath': ctx.windows ? '${workspaceFolder}\\.venv\\Scripts\\python.exe' : '${workspaceFolder}/.venv/bin/python',
    'python.terminal.activateEnvironment': true,
  };
  if (ctx.options.has('ai')) settings['python.envFile'] = '${workspaceFolder}/.env';
  if (ctx.options.has('tests')) {
    settings['python.testing.pytestEnabled'] = true;
    settings['python.testing.unittestEnabled'] = false;
  }
  if (ctx.options.has('lint')) {
    settings['[python]'] = {
      'editor.defaultFormatter': 'charliermarsh.ruff',
      'editor.formatOnSave': true,
      'editor.codeActionsOnSave': { 'source.organizeImports': 'explicit' },
    };
  }
  settings['files.exclude'] = { '**/__pycache__': true, '.pytest_cache': true, '.ruff_cache': true };
  return `${JSON.stringify(settings, null, 2)}\n`;
}

function vscodeLaunch(ctx: PythonContext): string {
  const base = { type: 'debugpy', request: 'launch', cwd: '${workspaceFolder}', justMyCode: true };
  const configurations: Record<string, unknown>[] = [];
  if (ctx.template === 'game') configurations.push({ name: 'Oyunu çalıştır', ...base, module: ctx.pkg });
  if (ctx.template === 'api') {
    configurations.push({ name: 'API\'yi çalıştır', ...base, module: 'uvicorn', args: [`${ctx.pkg}.main:app`, '--reload'] });
  }
  if (ctx.template === 'cli') {
    configurations.push({ name: 'Programı çalıştır', ...base, module: ctx.pkg, args: ['merhaba', '--ad', 'Ada'], console: 'integratedTerminal' });
  }
  return `${JSON.stringify({ version: '0.2.0', configurations }, null, 2)}\n`;
}

function vscodeExtensions(ctx: PythonContext): string {
  const recommendations = ['ms-python.python', 'ms-python.debugpy'];
  if (ctx.options.has('lint')) recommendations.push('charliermarsh.ruff');
  return `${JSON.stringify({ recommendations }, null, 2)}\n`;
}

function buildExe(ctx: PythonContext): string {
  const windowed = ctx.template === 'game';
  return py`"""Programı tek bir .exe dosyasına paketler.

Çalıştır:  python build_exe.py
Sonuç:     dist/${ctx.name}.exe  (Python kurulu olmayan bilgisayarda da açılır)
"""

import PyInstaller.__main__

PyInstaller.__main__.run(
    [
        "${ctx.pkg}/__main__.py",
        "--name=${ctx.name}",
        "--onefile",
        # Paket içindeki modüller bulunabilsin diye proje klasörü arama yoluna eklenir
        "--paths=.",
        "${windowed ? '--windowed' : '--console'}",
        "--noconfirm",
        "--clean",
    ]
)
`;
}

function aiModule(): string {
  return py`"""Claude ile konuşmak için küçük yardımcı.

API anahtarı .env dosyasındaki ANTHROPIC_API_KEY'den okunur; koda yazma.
Anahtarı https://console.anthropic.com/settings/keys adresinden alabilirsin.

Örnek:
    from .ai import ask
    print(ask("Bir enerji tasarrufu ipucu ver", effort="low"))
"""

import os

import anthropic
from dotenv import find_dotenv, load_dotenv

# .env, programın çalıştırıldığı klasörden yukarı doğru aranır
load_dotenv(find_dotenv(usecwd=True))

MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-5-5")

NO_KEY = "API anahtarı bulunamadı: .env dosyasına ANTHROPIC_API_KEY yaz."
BAD_KEY = "API anahtarı geçersiz: .env dosyasındaki ANTHROPIC_API_KEY'i kontrol et."


class AIError(Exception):
    """Kullanıcıya gösterilebilecek, sade bir hata mesajı taşır."""


_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        try:
            _client = anthropic.Anthropic()
        except anthropic.AnthropicError:
            raise AIError(NO_KEY) from None
    return _client


def ask(
    prompt: str, system: str | None = None, effort: str = "medium", max_tokens: int = 16000
) -> str:
    """Claude'a bir soru sorar ve cevabın metnini döndürür.

    effort: "low" hızlı ve ucuz, "medium" dengeli, "high" daha dikkatli düşünür.
    Hata olursa AIError fırlatır; mesajı doğrudan kullanıcıya gösterebilirsin.
    """
    extra = {"system": system} if system else {}
    try:
        response = _get_client().beta.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            output_config={"effort": effort},
            # Güvenlik filtresi reddederse önerilen modelle otomatik tekrar dener
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=[{"role": "user", "content": prompt}],
            **extra,
        )
    except TypeError as error:
        # SDK, kimlik bilgisi (API anahtarı ya da "ant auth login" profili) bulamazsa istek anında
        # TypeError fırlatır; buradaki parametreler sabit olduğu için başka bir sebebi yok
        raise AIError(NO_KEY) from error
    except anthropic.AuthenticationError:
        raise AIError(BAD_KEY) from None
    except anthropic.RateLimitError:
        raise AIError("Çok fazla istek gönderildi; biraz bekleyip tekrar dene.") from None
    except anthropic.APIStatusError as error:
        raise AIError(f"Claude API hatası ({error.status_code}): {error.message}") from None
    except anthropic.APIConnectionError:
        raise AIError("Claude API'ye bağlanılamadı; internet bağlantını kontrol et.") from None

    if response.stop_reason == "refusal":
        raise AIError("Claude bu isteği yanıtlamadı.")
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if not text and response.stop_reason == "max_tokens":
        raise AIError("Cevap token sınırına takıldı; ask() çağrısında max_tokens'ı artır.")
    return text
`;
}

// ---------------------------------------------------------------------------
// README
// ---------------------------------------------------------------------------

function readme(ctx: PythonContext): string {
  const python = venvPython(ctx.windows);
  const activate = ctx.windows ? '.venv\\Scripts\\activate' : 'source .venv/bin/activate';
  const requirements = requirementsFileOf(ctx);
  const commands = pythonCommands(ctx).map((c) => `${c.command.padEnd(44)} # ${c.label}`).join('\n');
  const intro: Record<PythonTemplate, string> = {
    game: 'pygame-ce ile 2D pixel-art bir simülasyon: kasaba haritası, kendi kendine dolaşan karakterler, gün/gece saati.',
    api: 'FastAPI ile bir REST API. Çalışınca Swagger dokümantasyonu http://localhost:8000/docs adresinde.',
    cli: 'Terminalden çalışan, alt komutları olan bir program.',
  };

  return `# ${ctx.title}

${intro[ctx.template]}

## Başlarken

**VS Code ile:** klasörü aç, sağ altta önerilen Python eklentilerini kur, **F5** ile çalıştır.
Yorumlayıcı olarak \`.venv\` kendiliğinden seçilir.

**Terminalden:**

\`\`\`bash
${commands}
\`\`\`

Sanal ortamı her seferinde yazmak istemezsen önce \`${activate}\` çalıştır; sonra kısaca \`python -m ${ctx.pkg}\` yazabilirsin.

Sanal ortam yoksa (ör. projeyi başka bir bilgisayara aldıysan) önce kur:

\`\`\`bash
python -m venv .venv
${python} -m pip install -r ${requirements}
\`\`\`
${ctx.options.has('ai') ? aiReadme(ctx) : ''}${templateReadme(ctx)}${ctx.options.has('exe') ? exeReadme(ctx) : ''}`;
}

function aiReadme(ctx: PythonContext): string {
  const usage: Record<PythonTemplate, string> = {
    game: 'Oyunda bir karaktere tıklayıp **T** tuşuna bas: Claude o karakterin o anki düşüncesini yazar. İstek arka planda çalışır, oyun donmaz (`brain.py`).',
    api: '`POST /api/ask` uç noktası soruyu Claude\'a iletir. Swagger\'dan (`/docs`) deneyebilirsin.',
    cli: '`python -m ' + ctx.pkg + ' sor "Python\'da liste ile demet farkı ne?"` komutu cevabı yazdırır.',
  };
  return `
## Claude ile AI

\`.env\` dosyasına API anahtarını yaz (anahtar: https://console.anthropic.com/settings/keys):

\`\`\`
ANTHROPIC_API_KEY=sk-ant-...
\`\`\`

${usage[ctx.template]} Kendi kodunda \`from .ai import ask\` ile kullanabilirsin.
Model \`.env\` dosyasındaki \`CLAUDE_MODEL\` ile değişir. \`.env\` git'e eklenmez; paylaşmak için \`.env.example\` var.
`;
}

function exeReadme(ctx: PythonContext): string {
  return `
## .exe üretme

\`\`\`bash
${venvPython(ctx.windows)} build_exe.py
\`\`\`

Sonuç \`dist/${ctx.name}.exe\`. İmzasız olduğu için Windows SmartScreen ya da Smart App Control uyarı verebilir.
`;
}

function templateReadme(ctx: PythonContext): string {
  if (ctx.template === 'game') {
    return `
## Kontroller

| Tuş | Ne yapar |
|---|---|
| Ok tuşları / WASD | Kamerayı kaydır |
| Sol tık | Karakteri seç (bilgisi altta görünür) |
| F | Seçili karakteri takip et |
| Boşluk | Durdur / devam |
| 1, 2, 3 | Hız: normal, hızlı, çok hızlı |${ctx.options.has('ai') ? '\n| T | Seçili karaktere Claude ile düşündür |' : ''}
| Esc | Çık |

## Yapı

\`\`\`
${ctx.pkg}/
├── settings.py     Harita boyu, hız, saat gibi ayarlar
├── world.py        Harita: kareler, binalar, yol bulma (pygame kullanmaz)
├── agent.py        Karakter: günlük plan ve yürüme
├── simulation.py   Saat, karakterler ve olaylar; her karede update() çağrılır
├── sprites.py      Pixel-art çizimler (dosya yok, kodla çizilir)
├── game.py         pygame penceresi: çizim, kamera, tuşlar${ctx.options.has('ai') ? '\n├── brain.py        Karakterlerin Claude ile düşünmesi (arka planda)\n├── ai.py           Claude yardımcısı' : ''}
└── __main__.py     python -m ${ctx.pkg}
\`\`\`

Simülasyonun kuralları (\`world.py\`, \`agent.py\`, \`simulation.py\`) pygame'den ayrıdır: pencere açmadan
test edilebilir, istersen ileride başka bir arayüze taşınabilir. Yeni bir kural eklemek için genelde
\`Simulation.update\` ve \`Agent.plan\` yeterli.
`;
  }
  if (ctx.template === 'api') {
    return `
## Uç noktalar

| Yöntem | Yol | Ne yapar |
|---|---|---|
| GET | /api/hello | Örnek selam |
| GET | /api/health | Sağlık kontrolü |
| GET | /api/items | Tüm kayıtlar |
| POST | /api/items | Yeni kayıt |
| GET | /api/items/{id} | Tek kayıt (yoksa 404) |
| DELETE | /api/items/{id} | Kaydı sil |${ctx.options.has('ai') ? '\n| POST | /api/ask | Claude\'a soru sor |' : ''}

Kayıtlar bellekte tutulur, API yeniden başlayınca silinir. Kalıcı olması için bir veritabanı (ör. SQLModel + SQLite) ekleyebilirsin.
Port 8000 doluysa \`PORT\` ortam değişkeniyle değiştir.

## Yapı

\`\`\`
${ctx.pkg}/
├── main.py      FastAPI uygulaması
├── routes.py    Uç noktalar
├── models.py    İstek ve cevap şemaları (Pydantic)${ctx.options.has('ai') ? '\n├── ai.py        Claude yardımcısı' : ''}
└── __main__.py  python -m ${ctx.pkg} (uvicorn, otomatik yenilemeli)
\`\`\`
${ctx.options.has('docker') ? `
## Docker ile

\`\`\`bash
docker compose up --build
\`\`\`
` : ''}`;
  }
  return `
## Komutlar

\`\`\`bash
python -m ${ctx.pkg} --help
python -m ${ctx.pkg} merhaba --ad Ada${ctx.options.has('ai') ? `\npython -m ${ctx.pkg} sor "Bir soru"` : ''}
\`\`\`

Yeni bir komut eklemek için \`${ctx.pkg}/cli.py\` içindeki \`build_parser\` fonksiyonuna bir alt komut ekle.
`;
}

// ---------------------------------------------------------------------------
// Oyun / simülasyon
// ---------------------------------------------------------------------------

function gameFiles(ctx: PythonContext): Record<string, string> {
  const ai = ctx.options.has('ai');
  const files: Record<string, string> = {
    [`${ctx.pkg}/__main__.py`]: py`"""python -m ${ctx.pkg} ile oyunu açar."""

from ${ctx.pkg}.game import main

if __name__ == "__main__":
    main()
`,
    [`${ctx.pkg}/settings.py`]: py`"""Oyunun ayarları. Değerleri değiştirip etkisini hemen görebilirsin."""

TITLE = "${ctx.title}"

TILE = 16  # bir karenin piksel boyu (pixel art ölçüsü)
MAP_W, MAP_H = 48, 32  # harita, kare cinsinden
VIEW_W, VIEW_H = 320, 180  # oyunun çizildiği küçük ekran (piksel)
SCALE = 3  # pencere = küçük ekran x SCALE (960 x 540)
FPS = 60

START_HOUR = 7  # oyun bu saatte başlar
MINUTES_PER_SECOND = 2  # gerçek 1 saniye = 2 oyun dakikası (1. hızda)
SPEEDS = (1, 4, 16)  # 1, 2, 3 tuşlarıyla seçilen hız çarpanları
AGENT_SPEED = 1.2  # karakterlerin hızı: oyun dakikası başına kare
AGENT_COUNT = 8
SEED = 7  # aynı sayı = aynı harita ve aynı karakterler
`,
    [`${ctx.pkg}/world.py`]: worldModule(),
    [`${ctx.pkg}/agent.py`]: agentModule(),
    [`${ctx.pkg}/simulation.py`]: simulationModule(ctx),
    [`${ctx.pkg}/sprites.py`]: spritesModule(),
    [`${ctx.pkg}/game.py`]: gameModule(ctx),
  };
  if (ai) files[`${ctx.pkg}/brain.py`] = brainModule();
  if (ctx.options.has('tests')) {
    files['tests/__init__.py'] = '';
    files['tests/test_simulation.py'] = py`from ${ctx.pkg}.simulation import Simulation
from ${ctx.pkg}.world import World


def test_every_building_is_reachable():
    world = World(48, 32, seed=7)
    start = world.buildings[0].door
    for building in world.buildings[1:]:
        path = world.find_path(start, building.door)
        assert path, f"{building.name} binasına yol yok"
        assert path[-1] == building.door


def test_paths_only_use_walkable_tiles():
    world = World(48, 32, seed=3)
    path = world.find_path(world.buildings[0].door, world.buildings[-1].door)
    assert all(world.is_walkable(x, y) for x, y in path[1:-1])


def test_agents_are_at_work_by_noon():
    sim = Simulation(seed=7)
    while sim.clock.hour < 12:
        sim.update(0.5)
    assert all(agent.place is agent.work for agent in sim.agents)


def test_clock_rolls_over_to_next_day():
    sim = Simulation(seed=7)
    sim.clock.advance(24 * 60)
    assert sim.clock.day == 2
    assert sim.clock.hour == sim.clock.start_hour


def test_paused_simulation_does_not_advance():
    sim = Simulation(seed=7)
    sim.paused = True
    before = sim.clock.minutes
    sim.update(10)
    assert sim.clock.minutes == before
`;
  }
  return files;
}

function worldModule(): string {
  return py`"""Harita: kareler, binalar ve yol bulma. pygame kullanmaz, pencere açmadan test edilebilir."""

import heapq
import random
from dataclasses import dataclass
from enum import IntEnum


class Tile(IntEnum):
    GRASS = 0
    ROAD = 1
    WATER = 2
    TREE = 3
    BUILDING = 4
    DOOR = 5


# Yürüme maliyeti: karakterler yolu çimene tercih eder. Listede olmayan kareler geçilmez.
WALK_COST = {Tile.ROAD: 1, Tile.GRASS: 3, Tile.DOOR: 1}

# Ev olmayan binalar; karakterler buralarda çalışır
WORKPLACES = ["Fırın", "Kahvehane", "Okul", "Market", "Atölye", "Belediye", "Eczane", "Kütüphane"]


@dataclass(eq=False)
class Building:
    name: str
    x: int
    y: int
    w: int
    h: int
    door: tuple[int, int]
    kind: str  # "ev" ya da "iş"

    def contains(self, x: int, y: int) -> bool:
        return self.x <= x < self.x + self.w and self.y <= y < self.y + self.h


class World:
    def __init__(self, width: int, height: int, seed: int):
        self.width = width
        self.height = height
        self.tiles = [[Tile.GRASS] * width for _ in range(height)]
        self.buildings: list[Building] = []
        rng = random.Random(seed)
        self._lay_roads()
        self._place_buildings(rng)
        self._scatter_nature(rng)

    # -- Kurulum --------------------------------------------------------------

    def _lay_roads(self) -> None:
        """Haritayı bölen iki yatay ve üç dikey, iki kare genişliğinde yollar."""
        self.road_rows = [self.height // 4, self.height * 5 // 8]
        self.road_cols = [self.width // 8, self.width // 2, self.width * 7 // 8]
        for row in self.road_rows:
            for x in range(self.width):
                self.tiles[row][x] = self.tiles[row + 1][x] = Tile.ROAD
        for col in self.road_cols:
            for y in range(self.height):
                self.tiles[y][col] = self.tiles[y][col + 1] = Tile.ROAD

    def _place_buildings(self, rng: random.Random) -> None:
        """Yatay yolların iki yanına, kapısı yola bakan binalar dizer."""
        workplaces = iter(WORKPLACES)
        houses = 0
        for row in self.road_rows:
            for above in (True, False):
                top = row - 3 if above else row + 2
                x = 1
                while x < self.width - 4:
                    w = rng.choice((3, 4))
                    if self._area_is_grass(x, top, w, 3):
                        door = (x + w // 2, top + 2 if above else top)
                        work = next(workplaces, None) if rng.random() < 0.3 else None
                        if work:
                            name, kind = work, "iş"
                        else:
                            houses += 1
                            name, kind = f"Ev {houses}", "ev"
                        self._add_building(Building(name, x, top, w, 3, door, kind))
                        x += w + rng.choice((1, 2))
                    else:
                        x += 1
        # Her zaman en az birkaç iş yeri olsun
        for name in workplaces:
            houses_left = [b for b in self.buildings if b.kind == "ev"]
            if len(houses_left) <= 8:
                break
            building = rng.choice(houses_left)
            building.name, building.kind = name, "iş"

    def _area_is_grass(self, x: int, y: int, w: int, h: int) -> bool:
        if x < 0 or y < 0 or x + w > self.width or y + h > self.height:
            return False
        return all(
            self.tiles[yy][xx] == Tile.GRASS for yy in range(y, y + h) for xx in range(x, x + w)
        )

    def _add_building(self, building: Building) -> None:
        for yy in range(building.y, building.y + building.h):
            for xx in range(building.x, building.x + building.w):
                self.tiles[yy][xx] = Tile.BUILDING
        dx, dy = building.door
        self.tiles[dy][dx] = Tile.DOOR
        self.buildings.append(building)

    def _scatter_nature(self, rng: random.Random) -> None:
        """Haritanın alt kısmına bir gölet, boş çimenlere ağaçlar."""
        cx, cy = self.width * 3 // 4, self.height - 4
        crowded = (Tile.ROAD, Tile.DOOR, Tile.BUILDING)
        for y in range(self.height):
            for x in range(self.width):
                if self.tiles[y][x] != Tile.GRASS or self._next_to(x, y, crowded):
                    continue
                if ((x - cx) / 5) ** 2 + ((y - cy) / 2.5) ** 2 < 1:
                    self.tiles[y][x] = Tile.WATER
                elif rng.random() < 0.07:
                    self.tiles[y][x] = Tile.TREE

    def _next_to(self, x: int, y: int, kinds: tuple[Tile, ...]) -> bool:
        return any(self.tile(x + dx, y + dy) in kinds for dx in (-1, 0, 1) for dy in (-1, 0, 1))

    # -- Sorgular -------------------------------------------------------------

    def tile(self, x: int, y: int) -> Tile | None:
        if 0 <= x < self.width and 0 <= y < self.height:
            return self.tiles[y][x]
        return None

    def is_walkable(self, x: int, y: int) -> bool:
        return self.tile(x, y) in WALK_COST

    def building_at(self, x: int, y: int) -> Building | None:
        return next((b for b in self.buildings if b.contains(x, y)), None)

    def find_path(self, start: tuple[int, int], goal: tuple[int, int]) -> list[tuple[int, int]]:
        """En ucuz yolu bulur (Dijkstra): başlangıç ve hedef dahil kareler, yoksa boş liste."""
        frontier = [(0, start)]
        came_from: dict[tuple[int, int], tuple[int, int] | None] = {start: None}
        cost = {start: 0}
        while frontier:
            _, current = heapq.heappop(frontier)
            if current == goal:
                break
            x, y = current
            for nxt in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                tile = self.tile(*nxt)
                if tile not in WALK_COST:
                    continue
                new_cost = cost[current] + WALK_COST[tile]
                if nxt not in cost or new_cost < cost[nxt]:
                    cost[nxt] = new_cost
                    came_from[nxt] = current
                    heapq.heappush(frontier, (new_cost, nxt))
        if goal not in came_from:
            return []
        path = [goal]
        while path[-1] != start:
            path.append(came_from[path[-1]])
        return path[::-1]
`;
}

function agentModule(): string {
  return py`"""Karakter: günlük planı ve yürümesi."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from .world import Building

if TYPE_CHECKING:
    from .simulation import Simulation


@dataclass(eq=False)
class Agent:
    id: int
    name: str
    home: Building
    work: Building
    shirt: int  # sprites.SHIRTS içindeki renk
    leave_minute: int  # sabah evden çıkış dakikası (07:00 + 0..60)
    x: float = 0.0
    y: float = 0.0
    place: Building | None = None  # içinde bulunduğu bina (yoldaysa None)
    path: list[tuple[int, int]] = field(default_factory=list)
    thought: str = ""

    @property
    def state(self) -> str:
        if self.place is self.home:
            return "evde"
        if self.place is self.work:
            return "işte"
        return "yolda"

    def plan(self, minute_of_day: int) -> Building:
        """Şu an nerede olmak istiyor? Kendi kurallarını buraya ekleyebilirsin."""
        leave = 7 * 60 + self.leave_minute
        come_back = 17 * 60 + self.leave_minute
        return self.work if leave <= minute_of_day < come_back else self.home

    def update(self, minutes: float, sim: Simulation) -> None:
        """Geçen oyun dakikası kadar düşün ve yürü."""
        target = self.plan(int(sim.clock.minute_of_day))
        if self.place is not target and not self.path:
            start = self.place.door if self.place else (round(self.x), round(self.y))
            self.path = sim.world.find_path(start, target.door)[1:]
            if self.place:
                sim.log(f"{self.name} {self.place.name} binasından çıktı")
            self.place = None
        self._walk(minutes * sim.agent_speed, target, sim)

    def _walk(self, distance: float, target: Building, sim: Simulation) -> None:
        while self.path and distance > 0:
            tx, ty = self.path[0]
            dx, dy = tx - self.x, ty - self.y
            gap = abs(dx) + abs(dy)
            if gap <= distance:
                self.x, self.y = float(tx), float(ty)
                distance -= gap
                self.path.pop(0)
            else:
                self.x += distance * dx / gap
                self.y += distance * dy / gap
                distance = 0
        if not self.path and self.place is None and (round(self.x), round(self.y)) == target.door:
            self.place = target
            sim.log(f"{self.name} {target.name} binasına vardı")
`;
}

function simulationModule(ctx: PythonContext): string {
  return py`"""Simülasyon: saat, karakterler ve olay kaydı. Her karede update(saniye) çağrılır."""

import random
from collections import deque

from . import settings
from .agent import Agent
from .world import World

NAMES = "Ayşe Mehmet Zeynep Can Elif Mert Selin Emre Deniz Burak Ece Kaan".split()


class Clock:
    def __init__(self, start_hour: int):
        self.start_hour = start_hour
        self.minutes = 0.0  # başlangıçtan beri geçen oyun dakikası

    def advance(self, minutes: float) -> None:
        self.minutes += minutes

    @property
    def minute_of_day(self) -> float:
        return (self.start_hour * 60 + self.minutes) % (24 * 60)

    @property
    def hour(self) -> int:
        return int(self.minute_of_day // 60)

    @property
    def day(self) -> int:
        return int((self.start_hour * 60 + self.minutes) // (24 * 60)) + 1

    @property
    def daylight(self) -> float:
        """0 = gece, 1 = gündüz; şafak (06-08) ve akşam (18-20) arasında yumuşak geçiş."""
        hour = self.minute_of_day / 60
        if 8 <= hour < 18:
            return 1.0
        if 6 <= hour < 8:
            return (hour - 6) / 2
        if 18 <= hour < 20:
            return 1 - (hour - 18) / 2
        return 0.0

    def __str__(self) -> str:
        minute = int(self.minute_of_day)
        return f"Gün {self.day} · {minute // 60:02d}:{minute % 60:02d}"


class Simulation:
    def __init__(self, seed: int = settings.SEED):
        self.rng = random.Random(seed)
        self.world = World(settings.MAP_W, settings.MAP_H, seed)
        self.clock = Clock(settings.START_HOUR)
        self.agent_speed = settings.AGENT_SPEED
        self.speed = settings.SPEEDS[0]
        self.paused = False
        self.events: deque[str] = deque(maxlen=6)
        self.agents = self._create_agents(settings.AGENT_COUNT)

    def _create_agents(self, count: int) -> list[Agent]:
        homes = [b for b in self.world.buildings if b.kind == "ev"]
        works = [b for b in self.world.buildings if b.kind == "iş"]
        names = self.rng.sample(NAMES, k=min(count, len(NAMES)))
        agents = []
        for i, name in enumerate(names):
            home = homes[i % len(homes)]
            agent = Agent(
                id=i,
                name=name,
                home=home,
                work=self.rng.choice(works),
                shirt=i,
                leave_minute=self.rng.randrange(0, 60),
                x=float(home.door[0]),
                y=float(home.door[1]),
                place=home,
            )
            agents.append(agent)
        return agents

    def log(self, message: str) -> None:
        self.events.appendleft(f"{self.clock}  {message}")

    def update(self, seconds: float) -> None:
        """Gerçek zamanda geçen saniyeyi oyun dakikasına çevirip dünyayı ilerletir."""
        if self.paused:
            return
        minutes = seconds * settings.MINUTES_PER_SECOND * self.speed
        # Hızlı modda karakterler kapıları atlamasın diye zamanı küçük adımlarla ilerlet
        while minutes > 0:
            step = min(minutes, 1.0)
            self.clock.advance(step)
            for agent in self.agents:
                agent.update(step, self)
            minutes -= step

    def agent_near(self, x: float, y: float, radius: float = 0.8) -> Agent | None:
        """Haritadaki bir noktaya en yakın, dışarıda olan karakter."""
        outside = [a for a in self.agents if a.place is None]
        best = min(outside, key=lambda a: (a.x - x) ** 2 + (a.y - y) ** 2, default=None)
        if best and (best.x - x) ** 2 + (best.y - y) ** 2 <= radius**2:
            return best
        return None

    def people_in(self, building) -> list[Agent]:
        return [a for a in self.agents if a.place is building]
`;
}

function spritesModule(): string {
  return py`"""Pixel-art çizimler. Görsel dosya yok: her şey küçük karakter haritalarından kodla çizilir."""

import random

import pygame

from .settings import TILE

# Karakter haritalarındaki harflerin renkleri ("." = saydam)
PALETTE = {
    "k": (28, 27, 38),  # kontur
    "s": (241, 196, 158),  # ten
    "h": (92, 58, 40),  # saç
    "p": (52, 63, 92),  # pantolon
    "w": (255, 255, 255),
}

# Karakterlerin gömlek renkleri; her karakter sırayla birini alır
SHIRTS = [
    (214, 69, 65),
    (52, 120, 210),
    (240, 176, 40),
    (64, 170, 100),
    (150, 90, 200),
    (235, 120, 60),
    (40, 170, 170),
    (220, 90, 150),
]

# 8 x 12 piksel karakter; "c" gömlek rengiyle boyanır
PERSON = [
    "..kkkk..",
    ".khhhhk.",
    ".khsssk.",
    ".kskssk.",
    "..kssk..",
    ".kcccck.",
    "kcccccck",
    "ksccccsk",
    ".kcccck.",
    ".kppppk.",
    ".kpkkpk.",
    ".kk..kk.",
]

GRASS = (98, 168, 82)
GRASS_DARK = (84, 150, 72)
ROAD = (122, 118, 128)
ROAD_EDGE = (104, 100, 110)
WATER = (64, 132, 200)
WATER_LIGHT = (110, 170, 225)
TRUNK = (110, 74, 50)
LEAVES = (52, 128, 70)
LEAVES_LIGHT = (78, 156, 84)
WALL = (232, 220, 196)
WALL_WORK = (206, 214, 226)
ROOF = (176, 72, 58)
ROOF_WORK = (66, 96, 150)
WINDOW = (70, 86, 110)
WINDOW_LIT = (255, 214, 110)
DOOR = (120, 80, 52)


def from_map(rows: list[str], colors: dict[str, tuple[int, int, int]]) -> pygame.Surface:
    surface = pygame.Surface((len(rows[0]), len(rows)), pygame.SRCALPHA)
    for y, row in enumerate(rows):
        for x, char in enumerate(row):
            if char in colors:
                surface.set_at((x, y), colors[char])
    return surface


class Sprites:
    """Oyun başlarken bir kez çizilen kareler ve karakterler."""

    def __init__(self):
        rng = random.Random(1)
        self.grass = [self._grass(rng) for _ in range(4)]
        self.road = self._road()
        self.water = [self._water(rng, frame) for frame in range(2)]
        self.tree = self._tree()
        self.people = [from_map(PERSON, {**PALETTE, "c": shirt}) for shirt in SHIRTS]

    def person(self, shirt: int) -> pygame.Surface:
        return self.people[shirt % len(self.people)]

    def _grass(self, rng: random.Random) -> pygame.Surface:
        tile = pygame.Surface((TILE, TILE))
        tile.fill(GRASS)
        for _ in range(6):
            tile.set_at((rng.randrange(TILE), rng.randrange(TILE)), GRASS_DARK)
        return tile

    def _road(self) -> pygame.Surface:
        tile = pygame.Surface((TILE, TILE))
        tile.fill(ROAD)
        for x in range(0, TILE, 4):
            tile.set_at((x, 0), ROAD_EDGE)
        return tile

    def _water(self, rng: random.Random, frame: int) -> pygame.Surface:
        tile = pygame.Surface((TILE, TILE))
        tile.fill(WATER)
        for _ in range(3):
            x, y = rng.randrange(TILE - 3), rng.randrange(TILE)
            pygame.draw.line(tile, WATER_LIGHT, (x + frame, y), (x + frame + 2, y))
        return tile

    def _tree(self) -> pygame.Surface:
        tile = pygame.Surface((TILE, TILE), pygame.SRCALPHA)
        pygame.draw.rect(tile, TRUNK, (7, 10, 2, 5))
        pygame.draw.circle(tile, LEAVES, (8, 7), 6)
        pygame.draw.circle(tile, LEAVES_LIGHT, (6, 5), 3)
        return tile

    @staticmethod
    def building(w: int, h: int, door_x: int, door_on_top: bool, work: bool) -> pygame.Surface:
        """Bir binanın tamamı (çatı, duvar, kapı). Pencereler gece ışığı için ayrı çizilir."""
        surface = pygame.Surface((w * TILE, h * TILE), pygame.SRCALPHA)
        wall = WALL_WORK if work else WALL
        roof = ROOF_WORK if work else ROOF
        pygame.draw.rect(surface, wall, (1, 6, w * TILE - 2, h * TILE - 7))
        pygame.draw.rect(surface, roof, (0, 0, w * TILE, 9))
        pygame.draw.line(surface, PALETTE["k"], (0, 9), (w * TILE - 1, 9))
        door_px = door_x * TILE + 5
        door_y = 10 if door_on_top else h * TILE - 11
        pygame.draw.rect(surface, DOOR, (door_px, door_y, 6, 10))
        return surface

    @staticmethod
    def window_spots(w: int, h: int, door_x: int) -> list[pygame.Rect]:
        """Binanın üzerindeki pencerelerin yerleri (bina sol üstüne göre)."""
        spots = []
        for tx in range(w):
            if tx == door_x:
                continue
            spots.append(pygame.Rect(tx * TILE + 4, 18, 8, 7))
        return spots
`;
}

function brainModule(): string {
  return py`"""Karakterlerin Claude ile düşünmesi.

Claude'un cevabı birkaç saniye sürebilir; oyun döngüsü beklerse ekran donar. Bu yüzden istekler
arka plandaki iş parçacıklarında çalışır, oyun her karede collect() ile biten cevapları toplar.
"""

from concurrent.futures import Future, ThreadPoolExecutor

from .agent import Agent
from .ai import AIError, ask
from .simulation import Simulation

SYSTEM = (
    "Küçük bir kasabada yaşayan bir simülasyon karakterisin. Sana durumun anlatılınca "
    "o anki düşünceni birinci tekil şahısla, Türkçe ve en fazla iki kısa cümleyle yaz. "
    "Sadece düşünceyi yaz."
)


class Brain:
    def __init__(self, workers: int = 2):
        self._pool = ThreadPoolExecutor(max_workers=workers)
        self._pending: dict[int, Future[str]] = {}

    def is_thinking(self, agent: Agent) -> bool:
        return agent.id in self._pending

    def think(self, agent: Agent, sim: Simulation) -> None:
        """Karakter için düşünce isteği başlatır (zaten düşünüyorsa bir şey yapmaz)."""
        if self.is_thinking(agent):
            return
        where = agent.place.name if agent.place else "yolda yürüyor"
        recent = "; ".join(list(sim.events)[:3]) or "sakin bir gün"
        prompt = (
            f"Adın {agent.name}. Saat: {sim.clock}. Şu an: {where}. "
            f"Evin: {agent.home.name}. İşin: {agent.work.name}. "
            f"Kasabada son olanlar: {recent}."
        )
        # Kısa cevap istense de sınır geniş: modelin düşünmesi de bu sınırdan harcanır
        self._pending[agent.id] = self._pool.submit(ask, prompt, SYSTEM, "low", 4000)

    def collect(self, sim: Simulation) -> None:
        """Biten cevapları karakterlere yazar."""
        for agent_id, future in list(self._pending.items()):
            if not future.done():
                continue
            del self._pending[agent_id]
            agent = sim.agents[agent_id]
            try:
                agent.thought = future.result()
            except AIError as error:
                agent.thought = f"(AI: {error})"

    def shutdown(self) -> None:
        self._pool.shutdown(wait=False, cancel_futures=True)
`;
}

function gameModule(ctx: PythonContext): string {
  const ai = ctx.options.has('ai');
  return py`"""pygame penceresi: dünyayı çizer, tuşları ve fareyi dinler."""

import pygame

from . import settings as S
${ai ? 'from .brain import Brain\n' : ''}from .simulation import Simulation
from .sprites import WINDOW, WINDOW_LIT, Sprites
from .world import Tile

HELP = "Ok/WASD: kamera · Tık: seç · F: takip · Boşluk: durdur · 1-2-3: hız${ai ? ' · T: düşün' : ''} · Esc: çık"


class Camera:
    """Küçük ekranın haritadaki sol üst köşesi (piksel)."""

    def __init__(self):
        self.x = 0.0
        self.y = 0.0

    def move(self, dx: float, dy: float) -> None:
        self.x = max(0.0, min(self.x + dx, S.MAP_W * S.TILE - S.VIEW_W))
        self.y = max(0.0, min(self.y + dy, S.MAP_H * S.TILE - S.VIEW_H))

    def center_on(self, x: float, y: float) -> None:
        self.x, self.y = 0.0, 0.0
        self.move(x - S.VIEW_W / 2, y - S.VIEW_H / 2)


class Game:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption(S.TITLE)
        self.window = pygame.display.set_mode((S.VIEW_W * S.SCALE, S.VIEW_H * S.SCALE))
        self.view = pygame.Surface((S.VIEW_W, S.VIEW_H))
        self.night = pygame.Surface((S.VIEW_W, S.VIEW_H), pygame.SRCALPHA)
        self.font = pygame.font.Font(None, 26)
        self.small = pygame.font.Font(None, 21)
        self.clock = pygame.time.Clock()
        self.sim = Simulation()
        self.sprites = Sprites()
        self.camera = Camera()
        self.camera.center_on(S.MAP_W * S.TILE / 2, S.MAP_H * S.TILE / 3)
        self.selected = None
        self.follow = False
        self.time = 0.0
        self.building_images = {
            b: Sprites.building(b.w, b.h, b.door[0] - b.x, b.door[1] == b.y, b.kind == "iş")
            for b in self.sim.world.buildings
        }${ai ? '\n        self.brain = Brain()' : ''}

    def run(self) -> None:
        running = True
        while running:
            seconds = self.clock.tick(S.FPS) / 1000
            self.time += seconds
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    self.on_key(event.key)
                elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    self.on_click(event.pos)
            self.scroll(seconds)
            self.sim.update(seconds)${ai ? '\n            self.brain.collect(self.sim)' : ''}
            self.draw()
${ai ? '        self.brain.shutdown()\n' : ''}        pygame.quit()

    # -- Girdi ----------------------------------------------------------------

    def on_key(self, key: int) -> None:
        if key == pygame.K_SPACE:
            self.sim.paused = not self.sim.paused
        elif key in (pygame.K_1, pygame.K_2, pygame.K_3):
            self.sim.speed = S.SPEEDS[key - pygame.K_1]
        elif key == pygame.K_f and self.selected:
            self.follow = not self.follow${ai ? `
        elif key == pygame.K_t and self.selected:
            self.brain.think(self.selected, self.sim)` : ''}

    def on_click(self, pos: tuple[int, int]) -> None:
        x = (pos[0] / S.SCALE + self.camera.x) / S.TILE
        y = (pos[1] / S.SCALE + self.camera.y) / S.TILE
        self.selected = self.sim.agent_near(x - 0.5, y - 0.5)
        building = self.sim.world.building_at(int(x), int(y))
        if not self.selected and building:
            # Binaya tıklanınca içindeki ilk kişi seçilir
            people = self.sim.people_in(building)
            self.selected = people[0] if people else None
        self.follow = self.follow and self.selected is not None

    def scroll(self, seconds: float) -> None:
        keys = pygame.key.get_pressed()
        dx = (keys[pygame.K_RIGHT] or keys[pygame.K_d]) - (keys[pygame.K_LEFT] or keys[pygame.K_a])
        dy = (keys[pygame.K_DOWN] or keys[pygame.K_s]) - (keys[pygame.K_UP] or keys[pygame.K_w])
        if dx or dy:
            self.follow = False
            self.camera.move(dx * 160 * seconds, dy * 160 * seconds)
        elif self.follow and self.selected:
            agent = self.selected
            self.camera.center_on((agent.x + 0.5) * S.TILE, (agent.y + 0.5) * S.TILE)

    # -- Çizim ----------------------------------------------------------------

    def draw(self) -> None:
        self.view.fill((0, 0, 0))
        self.draw_tiles()
        self.draw_buildings()
        self.draw_agents()
        self.draw_night()
        pygame.transform.scale(self.view, self.window.get_size(), self.window)
        self.draw_hud()
        pygame.display.flip()

    def to_screen(self, tile_x: float, tile_y: float) -> tuple[int, int]:
        return round(tile_x * S.TILE - self.camera.x), round(tile_y * S.TILE - self.camera.y)

    def draw_tiles(self) -> None:
        world = self.sim.world
        first_x, first_y = int(self.camera.x // S.TILE), int(self.camera.y // S.TILE)
        frame = int(self.time * 2) % 2
        for ty in range(first_y, min(first_y + S.VIEW_H // S.TILE + 2, world.height)):
            for tx in range(first_x, min(first_x + S.VIEW_W // S.TILE + 2, world.width)):
                tile = world.tiles[ty][tx]
                pos = self.to_screen(tx, ty)
                if tile == Tile.ROAD:
                    self.view.blit(self.sprites.road, pos)
                elif tile == Tile.WATER:
                    self.view.blit(self.sprites.water[(frame + tx) % 2], pos)
                else:
                    self.view.blit(self.sprites.grass[(tx * 7 + ty * 3) % 4], pos)
                    if tile == Tile.TREE:
                        self.view.blit(self.sprites.tree, pos)

    def draw_buildings(self) -> None:
        for building, image in self.building_images.items():
            self.view.blit(image, self.to_screen(building.x, building.y))

    def draw_agents(self) -> None:
        outside = sorted((a for a in self.sim.agents if a.place is None), key=lambda a: a.y)
        for agent in outside:
            x, y = self.to_screen(agent.x, agent.y)
            self.view.blit(self.sprites.person(agent.shirt), (x + 4, y + 2))
        if self.selected and self.selected.place is None:
            x, y = self.to_screen(self.selected.x, self.selected.y)
            pygame.draw.ellipse(self.view, (255, 255, 255), (x + 2, y + 12, 12, 5), 1)

    def draw_night(self) -> None:
        darkness = 1 - self.sim.clock.daylight
        if darkness <= 0:
            return
        self.night.fill((12, 18, 48, int(165 * darkness)))
        self.view.blit(self.night, (0, 0))
        # İçinde biri olan binaların pencereleri yanar
        for building in self.building_images:
            lit = bool(self.sim.people_in(building))
            bx, by = self.to_screen(building.x, building.y)
            for spot in Sprites.window_spots(building.w, building.h, building.door[0] - building.x):
                self.view.fill(WINDOW_LIT if lit else WINDOW, spot.move(bx, by))

    def draw_hud(self) -> None:
        status = "durdu" if self.sim.paused else f"x{self.sim.speed}"
        self.text(f"{self.sim.clock}   {status}", (14, 10), self.font)
        width, height = self.window.get_size()
        if self.selected:
            self.draw_agent_panel(width, height)
        else:
            for i, event in enumerate(list(self.sim.events)[:4]):
                self.text(event, (14, height - 48 - i * 20), self.small, alpha=255 - i * 50)
        self.text(HELP, (14, height - 22), self.small, color=(200, 204, 214))

    def draw_agent_panel(self, width: int, height: int) -> None:
        agent = self.selected
        lines = [f"{agent.name} · {agent.state}", f"Ev: {agent.home.name} · İş: {agent.work.name}"]${ai ? `
        if self.brain.is_thinking(agent):
            lines.append("düşünüyor…")
        elif agent.thought:
            lines.extend(self.wrap(f"“{agent.thought}”", width - 60))` : ''}
        panel = pygame.Rect(10, height - 44 - len(lines) * 22, width - 20, len(lines) * 22 + 14)
        shade = pygame.Surface(panel.size, pygame.SRCALPHA)
        shade.fill((16, 18, 28, 200))
        self.window.blit(shade, panel.topleft)
        for i, line in enumerate(lines):
            font = self.font if i == 0 else self.small
            self.text(line, (panel.x + 12, panel.y + 8 + i * 22), font)

    def wrap(self, text: str, max_width: int) -> list[str]:
        lines, current = [], ""
        for word in text.split():
            candidate = f"{current} {word}".strip()
            if self.small.size(candidate)[0] > max_width and current:
                lines.append(current)
                current = word
            else:
                current = candidate
        return [*lines, current] if current else lines

    def text(
        self,
        value: str,
        pos: tuple[int, int],
        font: pygame.font.Font,
        color=(255, 255, 255),
        alpha=255,
    ) -> None:
        shadow = font.render(value, True, (0, 0, 0))
        image = font.render(value, True, color)
        shadow.set_alpha(alpha)
        image.set_alpha(alpha)
        self.window.blit(shadow, (pos[0] + 1, pos[1] + 1))
        self.window.blit(image, pos)


def main() -> None:
    Game().run()
`;
}

// ---------------------------------------------------------------------------
// FastAPI
// ---------------------------------------------------------------------------

function apiFiles(ctx: PythonContext): Record<string, string> {
  const ai = ctx.options.has('ai');
  const files: Record<string, string> = {
    [`${ctx.pkg}/__main__.py`]: py`"""python -m ${ctx.pkg} ile API'yi otomatik yenilemeli başlatır."""

import os

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    print(f"Swagger: http://localhost:{port}/docs")
    uvicorn.run("${ctx.pkg}.main:app", host="127.0.0.1", port=port, reload=True)
`,
    [`${ctx.pkg}/main.py`]: py`"""FastAPI uygulaması. Uç noktalar routes.py dosyasında."""

from fastapi import FastAPI

from . import __version__
from .routes import router

app = FastAPI(
    title="${ctx.title}",
    version=__version__,
    description="create-hazal-app ile oluşturuldu. Uç noktaları bu sayfadan deneyebilirsin.",
)
app.include_router(router, prefix="/api")
`,
    [`${ctx.pkg}/models.py`]: py`"""İstek ve cevap şemaları. FastAPI gelen veriyi bunlara göre doğrular, Swagger'da gösterir."""

from pydantic import BaseModel, Field


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, examples=["Klavye"])
    price: float = Field(ge=0, examples=[750.0])


class Item(ItemCreate):
    id: int
${ai ? `

class Question(BaseModel):
    question: str = Field(min_length=1, max_length=4000, examples=["FastAPI nedir?"])


class Answer(BaseModel):
    answer: str
` : ''}`,
    [`${ctx.pkg}/routes.py`]: py`"""Uç noktalar. Kayıtlar örnek olsun diye bellekte tutulur."""

from itertools import count

from fastapi import APIRouter, HTTPException, status

${ai ? 'from .ai import AIError, ask\n' : ''}from .models import ${ai ? 'Answer, ' : ''}Item, ItemCreate${ai ? ', Question' : ''}

router = APIRouter()

_items: dict[int, Item] = {}
_ids = count(1)


@router.get("/hello")
def hello() -> dict[str, str]:
    return {"message": "Merhaba! ${ctx.title} çalışıyor."}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/items")
def list_items() -> list[Item]:
    return list(_items.values())


@router.post("/items", status_code=status.HTTP_201_CREATED)
def create_item(data: ItemCreate) -> Item:
    item = Item(id=next(_ids), **data.model_dump())
    _items[item.id] = item
    return item


@router.get("/items/{item_id}")
def get_item(item_id: int) -> Item:
    if item_id not in _items:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    return _items[item_id]


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int) -> None:
    if _items.pop(item_id, None) is None:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
${ai ? `

# "async def" değil "def": FastAPI bunu ayrı bir iş parçacığında çalıştırır,
# böylece Claude'u beklerken diğer istekler durmaz
@router.post("/ask")
def ask_claude(data: Question) -> Answer:
    try:
        return Answer(answer=ask(data.question))
    except AIError as error:
        raise HTTPException(status_code=503, detail=str(error)) from None
` : ''}`,
  };
  if (ctx.options.has('tests')) {
    files['tests/__init__.py'] = '';
    files['tests/test_api.py'] = py`from fastapi.testclient import TestClient

from ${ctx.pkg}.main import app

client = TestClient(app)


def test_hello():
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert "Merhaba" in response.json()["message"]


def test_create_and_read_item():
    created = client.post("/api/items", json={"name": "Klavye", "price": 750})
    assert created.status_code == 201
    item = created.json()
    assert client.get(f"/api/items/{item['id']}").json() == item
    assert item in client.get("/api/items").json()


def test_invalid_item_is_rejected():
    response = client.post("/api/items", json={"name": "", "price": -1})
    assert response.status_code == 422


def test_missing_item_returns_404():
    assert client.get("/api/items/9999").status_code == 404
    assert client.delete("/api/items/9999").status_code == 404
`;
  }
  if (ctx.options.has('docker')) {
    files['Dockerfile'] = `FROM python:3.13-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ${ctx.pkg} ./${ctx.pkg}
EXPOSE 8000
CMD ["uvicorn", "${ctx.pkg}.main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
    files['.dockerignore'] = '.venv\n__pycache__\n.pytest_cache\n.ruff_cache\n.env\ntests\n.git\n';
    files['compose.yaml'] = `services:
  api:
    build: .
    ports:
      - "\${PORT:-8000}:8000"${ai ? `
    env_file:
      - path: .env
        required: false` : ''}
`;
  }
  return files;
}

// ---------------------------------------------------------------------------
// Konsol uygulaması
// ---------------------------------------------------------------------------

function cliFiles(ctx: PythonContext): Record<string, string> {
  const ai = ctx.options.has('ai');
  const files: Record<string, string> = {
    [`${ctx.pkg}/__main__.py`]: py`"""python -m ${ctx.pkg} ile programı çalıştırır."""

from ${ctx.pkg}.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
`,
    [`${ctx.pkg}/cli.py`]: py`"""Komut satırı arayüzü. Yeni bir komut eklemek için build_parser'a bir alt komut ekle."""

import argparse

from . import __version__


def cmd_merhaba(args: argparse.Namespace) -> int:
    print(f"Merhaba {args.ad}!")
    return 0
${ai ? `

def cmd_sor(args: argparse.Namespace) -> int:
    from .ai import AIError, ask

    try:
        print(ask(" ".join(args.soru)))
    except AIError as error:
        print(f"Hata: {error}")
        return 1
    return 0
` : ''}

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="${ctx.name}", description="${ctx.title}")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    commands = parser.add_subparsers(dest="komut", required=True, metavar="komut")

    merhaba = commands.add_parser("merhaba", help="Selam verir")
    merhaba.add_argument("--ad", default="dünya", help="Kime selam verilecek")
    merhaba.set_defaults(func=cmd_merhaba)
${ai ? `
    sor = commands.add_parser("sor", help="Claude'a soru sorar")
    sor.add_argument("soru", nargs="+", help="Sorulacak soru")
    sor.set_defaults(func=cmd_sor)
` : ''}
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)
`,
  };
  if (ctx.options.has('tests')) {
    files['tests/__init__.py'] = '';
    files['tests/test_cli.py'] = py`import pytest

from ${ctx.pkg}.cli import main


def test_merhaba_uses_given_name(capsys):
    assert main(["merhaba", "--ad", "Ada"]) == 0
    assert capsys.readouterr().out.strip() == "Merhaba Ada!"


def test_merhaba_default_name(capsys):
    main(["merhaba"])
    assert "dünya" in capsys.readouterr().out


def test_unknown_command_exits_with_error():
    with pytest.raises(SystemExit) as error:
        main(["olmayan-komut"])
    assert error.value.code != 0
`;
  }
  return files;
}
