import type { StepId } from './types.js';

/** Oluşturma adımları, sırasıyla. Arayüz ve CLI aynı etiketleri kullanır. */
export const STEP_LABELS: Record<StepId, string> = {
  backend: 'Spring Boot projesi indiriliyor',
  frontend: 'Frontend oluşturuluyor',
  'docker-files': 'Docker ve ayar dosyaları yazılıyor',
  git: 'Git deposu başlatılıyor',
  'docker-build': 'Docker imajları derleniyor',
  services: 'Servisler başlatılıyor',
};

export const STEP_ORDER = Object.keys(STEP_LABELS) as StepId[];
