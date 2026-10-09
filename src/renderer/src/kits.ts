import { AppWindow, Layers, type LucideIcon, Server, SquareTerminal } from 'lucide-react';
import { PYTHON_TEMPLATES } from '../../core/catalog/python';
import type { ProjectKind, PythonTemplate } from '../../core/types';
import type { ToolStatus } from '../../shared/bridge';

/** Açılış ekranındaki proje türleri ("kitler") ve kutudan neler çıktığı */
export interface KitDef {
  id: ProjectKind;
  label: string;
  tagline: string;
  icon: LucideIcon;
  /** Kartta "Kutuda" başlığı altında listelenen parçalar; template varsa satır o şablonu doğrudan açar */
  contents: { label: string; detail?: string; template?: PythonTemplate }[];
}

export const KITS: KitDef[] = [
  {
    id: 'fullstack',
    label: 'Fullstack web',
    tagline: 'Spring Boot backend ve frontend, aynı Docker Compose içinde.',
    icon: Layers,
    contents: [
      { label: 'Spring Boot API', detail: 'Maven ya da Gradle' },
      { label: 'Frontend', detail: 'React, Vue, Angular, Svelte' },
      { label: 'Veritabanı ve servisler', detail: 'MySQL, PostgreSQL, Redis…' },
      { label: 'Docker Compose', detail: 'canlı yenilemeli' },
    ],
  },
  {
    id: 'backend',
    label: 'REST API',
    tagline: 'Arayüzü olmayan bir Spring Boot servisi.',
    icon: Server,
    contents: [
      { label: 'Spring Boot API', detail: 'Maven ya da Gradle' },
      { label: 'İhtiyaçlar', detail: 'JWT, Swagger, Kafka…' },
      { label: 'Veritabanı', detail: 'SQL ve NoSQL' },
      { label: 'Docker Compose' },
    ],
  },
  {
    id: 'frontend',
    label: 'Web sitesi',
    tagline: 'Backend\'siz bir site: portfolyo, tanıtım sayfası.',
    icon: AppWindow,
    contents: [
      { label: 'Frontend', detail: 'React, Vue, Angular, Svelte' },
      { label: 'UI kütüphanesi', detail: 'Tailwind, shadcn/ui, MUI…' },
      { label: 'Çoklu dil ve animasyon' },
      { label: 'Vercel', detail: 'ücretsiz yayına hazır' },
    ],
  },
  {
    id: 'python',
    label: 'Python',
    tagline: 'Sanal ortamı ve VS Code ayarları kurulu bir Python projesi.',
    icon: SquareTerminal,
    contents: PYTHON_TEMPLATES.map((t) => ({ label: t.label, detail: t.summary, template: t.id })),
  },
];

export function findKit(id: ProjectKind): KitDef {
  return KITS.find((k) => k.id === id)!;
}

/** Açılış ekranının başlık çubuğu için bütün araçlar */
export function allRequirements(tools: ToolStatus | null): { label: string; ok: boolean; hint: string }[] {
  const seen = new Set<string>();
  return (['fullstack', 'python'] as const)
    .flatMap((kit) => kitRequirements(kit, tools))
    .filter((r) => !seen.has(r.label) && seen.add(r.label));
}

/** Bu kit için gereken araçların durumu: kartın altında ve ayar sayfasında gösterilir */
export function kitRequirements(kit: ProjectKind, tools: ToolStatus | null): { label: string; ok: boolean; hint: string }[] {
  if (!tools) return [];
  const docker = { label: 'Docker', ok: tools.docker, hint: tools.docker ? 'Docker Desktop çalışıyor' : 'Docker Desktop kapalı; proje oluşur ama başlatılamaz' };
  const node = { label: 'Node.js', ok: tools.node, hint: tools.node ? 'npm bulundu' : 'Frontend için Node.js gerekli' };
  if (kit === 'python') {
    return [{
      label: tools.python ? `Python ${tools.python}` : 'Python',
      ok: Boolean(tools.python),
      hint: tools.python ? 'Sanal ortam bu sürümle kurulur' : 'Python 3.10+ bulunamadı; dosyalar oluşur, kurulumu sonra yaparsın',
    }];
  }
  if (kit === 'backend') return [docker];
  if (kit === 'frontend') return [node, docker];
  return [docker, node];
}
