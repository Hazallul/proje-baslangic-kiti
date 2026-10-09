import { hasBackend, isPython } from './selection.js';
import type { Selection, StepId } from './types.js';

/** Oluşturma adımlarının etiketleri. Arayüz ve CLI aynı etiketleri kullanır. */
export const STEP_LABELS: Record<StepId, string> = {
  backend: 'Spring Boot projesi indiriliyor',
  frontend: 'Frontend oluşturuluyor',
  'docker-files': 'Docker ve ayar dosyaları yazılıyor',
  'python-files': 'Python projesi yazılıyor',
  'python-env': 'Sanal ortam kuruluyor, paketler indiriliyor',
  git: 'Git deposu başlatılıyor',
  'git-push': 'Uzak depoya gönderiliyor',
  'docker-build': 'Docker imajları derleniyor',
  services: 'Servisler başlatılıyor',
};

/**
 * Bu seçim için çalışacak adımlar, sırasıyla. Seçime göre hiç çalışmayacak adımlar listede yer almaz
 * (Python projesinde Docker adımları, git kapalıysa git adımı); çalışırken atlananlar ("Docker
 * çalışmıyor" gibi) listede kalır ve "atlandı" olarak görünür.
 */
export function planSteps(sel: Selection): StepId[] {
  if (isPython(sel)) {
    return [
      'python-files',
      ...(sel.python.install ? ['python-env' as const] : []),
      ...gitSteps(sel),
    ];
  }
  const steps: StepId[] = [];
  if (hasBackend(sel)) steps.push('backend');
  if (sel.frontend.framework) steps.push('frontend');
  steps.push('docker-files');
  steps.push(...gitSteps(sel));
  if (sel.start) steps.push('docker-build', 'services');
  return steps;
}

function gitSteps(sel: Selection): StepId[] {
  if (!sel.git) return [];
  return sel.gitRemote.mode === 'local' ? ['git'] : ['git', 'git-push'];
}
