/**
 * İhtiyaçlar: kullanıcının sade dille işaretlediği tikler ("Güvenlik", "Önbellek"...).
 * Her ihtiyacın bir veya daha fazla varyantı var; varyant seçilince ilgili paketler,
 * veritabanları ve önerilen servisler projeye eklenir.
 */

export interface NeedVariant {
  id: string;
  label: string;
  description: string;
  dependencies: string[];
  libraries?: string[];
  databases?: string[];
  /** İhtiyaç işaretlenince birlikte eklenen servisler (kullanıcı kaldırabilir) */
  services?: string[];
}

export interface NeedDef {
  id: string;
  label: string;
  description: string;
  /** Arayüzde kullanılan lucide ikon adı */
  icon: string;
  variants: NeedVariant[];
}

export const NEEDS: NeedDef[] = [
  {
    id: 'security',
    label: 'Güvenlik',
    description: 'Kimlik doğrulama ve yetkilendirme',
    icon: 'shield',
    variants: [
      {
        id: 'basic',
        label: 'Kullanıcı adı / şifre',
        description: 'Spring Security, HTTP Basic',
        dependencies: ['security'],
      },
      {
        id: 'jwt',
        label: 'JWT',
        description: 'Token tabanlı API güvenliği, giriş endpoint\'i dahil',
        dependencies: ['security', 'oauth2-resource-server'],
      },
      {
        id: 'keycloak',
        label: 'Keycloak',
        description: 'OAuth2 / OpenID Connect, Keycloak servisiyle',
        dependencies: ['security', 'oauth2-resource-server'],
        services: ['keycloak'],
      },
    ],
  },
  {
    id: 'validation',
    label: 'Girdi doğrulama',
    description: '@Valid, @NotBlank, @Email gibi kurallar',
    icon: 'check-check',
    variants: [{ id: 'default', label: 'Bean Validation', description: '', dependencies: ['validation'] }],
  },
  {
    id: 'api-docs',
    label: 'API dokümantasyonu',
    description: 'Otomatik Swagger arayüzü',
    icon: 'book-open',
    variants: [
      { id: 'swagger', label: 'Swagger UI', description: 'SpringDoc OpenAPI', dependencies: [], libraries: ['springdoc'] },
    ],
  },
  {
    id: 'cache',
    label: 'Önbellek',
    description: '@Cacheable ile sık kullanılan veriyi hızlandırma',
    icon: 'zap',
    variants: [
      { id: 'memory', label: 'Bellek içi', description: 'Ek servis gerektirmez', dependencies: ['cache'] },
      { id: 'redis', label: 'Redis', description: 'Paylaşımlı, kalıcı önbellek', dependencies: ['cache'], databases: ['redis'] },
    ],
  },
  {
    id: 'messaging',
    label: 'Mesajlaşma',
    description: 'Servisler arası olay ve kuyruk iletişimi',
    icon: 'messages-square',
    variants: [
      { id: 'kafka', label: 'Kafka', description: 'Olay akışı, Kafka UI ile', dependencies: ['kafka'], services: ['kafka', 'kafka-ui'] },
      { id: 'rabbitmq', label: 'RabbitMQ', description: 'Mesaj kuyruğu, yönetim paneliyle', dependencies: ['rabbitmq'], services: ['rabbitmq'] },
    ],
  },
  {
    id: 'monitoring',
    label: 'İzleme',
    description: 'Sağlık kontrolü ve metrikler',
    icon: 'activity',
    variants: [
      { id: 'health', label: 'Sağlık kontrolü', description: 'Actuator /health', dependencies: ['actuator'] },
      {
        id: 'prometheus',
        label: 'Prometheus + Grafana',
        description: 'Metrikler ve hazır panolar',
        dependencies: ['actuator', 'prometheus'],
        services: ['prometheus', 'grafana'],
      },
    ],
  },
  {
    id: 'mail',
    label: 'E-posta gönderme',
    description: 'JavaMailSender; geliştirmede Mailpit yakalar',
    icon: 'mail',
    variants: [{ id: 'smtp', label: 'SMTP', description: '', dependencies: ['mail'], services: ['mailpit'] }],
  },
  {
    id: 'realtime',
    label: 'Gerçek zamanlı',
    description: 'WebSocket / STOMP ile anlık iletişim',
    icon: 'radio',
    variants: [{ id: 'websocket', label: 'WebSocket', description: '', dependencies: ['websocket'] }],
  },
  {
    id: 'graphql',
    label: 'GraphQL API',
    description: 'REST yanında GraphQL şeması ve sorguları',
    icon: 'share-2',
    variants: [{ id: 'default', label: 'Spring for GraphQL', description: '', dependencies: ['graphql'] }],
  },
  {
    id: 'scheduling',
    label: 'Zamanlanmış görevler',
    description: 'Cron benzeri tekrar eden işler',
    icon: 'clock',
    variants: [{ id: 'quartz', label: 'Quartz', description: '', dependencies: ['quartz'] }],
  },
];

export function findNeed(id: string): NeedDef {
  const need = NEEDS.find((n) => n.id === id);
  if (!need) throw new Error(`Bilinmeyen ihtiyaç: ${id}`);
  return need;
}

export function findVariant(needId: string, variantId: string): NeedVariant {
  const variant = findNeed(needId).variants.find((v) => v.id === variantId);
  if (!variant) throw new Error(`Bilinmeyen varyant: ${needId}/${variantId}`);
  return variant;
}
