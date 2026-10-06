import type { CSSProperties, ReactNode } from 'react';

/**
 * Ek servislerin web arayüzlerinin temsili önizlemeleri. Gerçek ekran görüntüsü değildir;
 * her ürünün bilinen düzeni, renkleri ve ilk açılışta göreceğin ekran sade şekilde çizilir.
 */

const SYS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = 'ui-monospace, "JetBrains Mono Variable", monospace';

export interface ServicePreviewInfo {
  /** Tarayıcı çerçevesinde gösterilecek yol */
  path: string;
  /** Önizlemenin altındaki açıklama */
  note: string;
  render: () => ReactNode;
}

/** Deterministik, "canlı" görünen grafik çizgisi */
function Line({ color, seed = 1, height = 70, fill = false }: { color: string; seed?: number; height?: number; fill?: boolean }) {
  const points = Array.from({ length: 24 }, (_, i) => {
    const y = 0.5 + 0.28 * Math.sin(i * 0.55 + seed) + 0.12 * Math.sin(i * 1.7 + seed * 2);
    return [(i / 23) * 300, (1 - y) * height] as const;
  });
  const d = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 300 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      {fill && <polygon points={`0,${height} ${d} 300,${height}`} fill={color} opacity={0.15} />}
      <polyline points={d} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const box = (style: CSSProperties): CSSProperties => ({ boxSizing: 'border-box', ...style });

// ---------------------------------------------------------------------------

function Grafana() {
  const panel = (title: string, children: ReactNode) => (
    <div style={box({ background: '#181b1f', border: '1px solid #2c3235', borderRadius: 4, padding: 8 })}>
      <div style={{ fontSize: 10.5, color: '#ccccdc', marginBottom: 6, fontWeight: 500 }}>{title}</div>
      {children}
    </div>
  );
  const stat = (title: string, value: string, color: string) => panel(title, (
    <div style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1.1 }}>{value}</div>
  ));
  return (
    <div style={{ background: '#111217', color: '#ccccdc', fontFamily: SYS, height: '100%', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', borderBottom: '1px solid #2c3235' }}>
        <span style={{ width: 16, height: 16, borderRadius: 99, background: 'conic-gradient(#f05a28, #fbca0a, #f05a28)' }} />
        <span style={{ color: '#8e8e8e' }}>Dashboards ›</span>
        <strong style={{ color: '#fff' }}>Spring Boot</strong>
        <span style={{ marginLeft: 'auto', border: '1px solid #2c3235', borderRadius: 3, padding: '2px 6px', color: '#8e8e8e' }}>Son 15 dk</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: 8 }}>
        {stat('Bellek', '312 MB', '#73bf69')}
        {stat('p95 yanıt', '84 ms', '#fade2a')}
        {stat('Hata oranı', '0,2%', '#73bf69')}
      </div>
      <div style={{ padding: '0 8px 8px' }}>
        {panel('HTTP istek / sn', (
          <>
            <Line color="#73bf69" seed={1} fill />
            <div style={{ marginTop: -70 }}><Line color="#5794f2" seed={3} /></div>
          </>
        ))}
      </div>
    </div>
  );
}

function Prometheus() {
  return (
    <div style={{ background: '#fff', color: '#212529', fontFamily: SYS, height: '100%', fontSize: 11 }}>
      <div style={{ background: '#e6522c', color: '#fff', height: 32, display: 'flex', alignItems: 'center', gap: 14, padding: '0 10px' }}>
        <strong>Prometheus</strong>
        <span style={{ opacity: 0.85 }}>Query</span>
        <span style={{ opacity: 0.85 }}>Alerts</span>
        <span style={{ opacity: 0.85 }}>Status</span>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={box({ flex: 1, border: '1px solid #ced4da', borderRadius: 4, padding: '6px 8px', fontFamily: MONO, fontSize: 10.5 })}>
            rate(http_server_requests_seconds_count[1m])
          </div>
          <span style={{ background: '#1971c2', color: '#fff', borderRadius: 4, padding: '6px 10px' }}>Execute</span>
        </div>
        <div style={{ display: 'flex', gap: 12, margin: '10px 0 6px', borderBottom: '1px solid #dee2e6' }}>
          <span style={{ color: '#868e96', paddingBottom: 4 }}>Table</span>
          <span style={{ borderBottom: '2px solid #1971c2', paddingBottom: 4, fontWeight: 600 }}>Graph</span>
        </div>
        <Line color="#1971c2" seed={2} height={90} />
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: '#495057', marginTop: 6 }}>
          {'{job="backend", uri="/api/hello"}'}
        </div>
      </div>
    </div>
  );
}

function KafkaUi() {
  const topics: [string, number, string][] = [['siparis-olusturuldu', 3, '1.284'], ['odeme-alindi', 3, '962'], ['bildirim-gonder', 1, '310']];
  return (
    <div style={{ display: 'flex', background: '#fff', fontFamily: SYS, height: '100%', fontSize: 11, color: '#171a1c' }}>
      <div style={{ width: 92, background: '#f1f2f3', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, color: '#454f54' }}>
        <strong style={{ color: '#171a1c' }}>kafka-ui</strong>
        <span>Dashboard</span>
        <span style={{ color: '#4f4ffa', fontWeight: 600 }}>Topics</span>
        <span>Consumers</span>
        <span>Brokers</span>
      </div>
      <div style={{ flex: 1, padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Topics</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px 50px', gap: 0, fontSize: 10.5 }}>
          {['Topic', 'Part.', 'Mesaj'].map((h) => <span key={h} style={{ color: '#73848c', paddingBottom: 6, borderBottom: '1px solid #e3e6e8' }}>{h}</span>)}
          {topics.flatMap(([name, parts, count]) => [
            <span key={`${name}n`} style={{ color: '#4f4ffa', padding: '7px 0', borderBottom: '1px solid #f1f2f3' }}>{name}</span>,
            <span key={`${name}p`} style={{ padding: '7px 0', borderBottom: '1px solid #f1f2f3' }}>{parts}</span>,
            <span key={`${name}c`} style={{ padding: '7px 0', borderBottom: '1px solid #f1f2f3' }}>{count}</span>,
          ])}
        </div>
      </div>
    </div>
  );
}

function RabbitMq() {
  return (
    <div style={{ background: '#fff', fontFamily: SYS, height: '100%', fontSize: 11, color: '#484848' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
        <strong style={{ color: '#ff6600', fontSize: 14 }}>RabbitMQ</strong>
        <span style={{ color: '#999' }}>4.x</span>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '0 10px' }}>
        {['Overview', 'Connections', 'Channels', 'Exchanges', 'Queues'].map((t, i) => (
          <span key={t} style={{ padding: '5px 8px', background: i === 0 ? '#ff6600' : '#f2f2f2', color: i === 0 ? '#fff' : '#484848', borderRadius: '3px 3px 0 0' }}>{t}</span>
        ))}
      </div>
      <div style={{ borderTop: '2px solid #ff6600', margin: '0 10px', paddingTop: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Kuyruktaki mesajlar</div>
        <Line color="#ff6600" seed={4} height={60} fill />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
          {[['Bağlantı', '2'], ['Kanal', '4'], ['Kuyruk', '3'], ['Tüketici', '2']].map(([k, v]) => (
            <div key={k} style={{ background: '#f8f8f8', padding: 6, borderRadius: 3 }}>
              <div style={{ color: '#888', fontSize: 9.5 }}>{k}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Keycloak({ realm }: { realm: string }) {
  const input = (label: string, value: string) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10.5, marginBottom: 3 }}>{label}</div>
      <div style={box({ border: '1px solid #8a8d90', borderBottomColor: '#6a6e73', padding: '5px 7px', fontSize: 11 })}>{value}</div>
    </div>
  );
  return (
    <div style={{ background: '#f0f0f0', fontFamily: SYS, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 13, letterSpacing: '0.12em', color: '#151515', marginBottom: 10, textTransform: 'uppercase' }}>{realm}</div>
      <div style={box({ background: '#fff', width: '78%', padding: 14, borderTop: '3px solid #0066cc', boxShadow: '0 1px 2px rgb(0 0 0 / .15)' })}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#151515' }}>Sign in to your account</div>
        {input('Username or email', 'demo')}
        {input('Password', '••••')}
        <div style={{ background: '#0066cc', color: '#fff', textAlign: 'center', padding: '6px 0', fontSize: 11.5, marginTop: 4 }}>Sign In</div>
      </div>
    </div>
  );
}

function Mailpit() {
  const mails: [string, string, string][] = [
    ['noreply@my-app.local', 'Hesabını doğrula', '2 dk'],
    ['noreply@my-app.local', 'Şifre sıfırlama bağlantın', '14 dk'],
    ['noreply@my-app.local', 'Siparişin alındı #1042', '1 sa'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: SYS, height: '100%', fontSize: 11 }}>
      <div style={{ background: '#2c3e50', color: '#fff', height: 32, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px' }}>
        <strong>Mailpit</strong>
        <div style={box({ flex: 1, background: 'rgb(255 255 255 / .15)', borderRadius: 3, padding: '3px 8px', color: 'rgb(255 255 255 / .7)' })}>Ara…</div>
      </div>
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ width: 82, borderRight: '1px solid #e5e5e5', padding: 8, color: '#555' }}>
          <div style={{ fontWeight: 600, color: '#2c3e50' }}>Gelen kutusu</div>
          <div style={{ marginTop: 4, background: '#0d6efd', color: '#fff', display: 'inline-block', borderRadius: 99, padding: '0 6px', fontSize: 10 }}>3</div>
        </div>
        <div style={{ flex: 1 }}>
          {mails.map(([from, subject, time], i) => (
            <div key={subject} style={{ padding: '8px 10px', borderBottom: '1px solid #eee', background: i === 0 ? '#f0f6ff' : '#fff' }}>
              <div style={{ display: 'flex', color: '#777', fontSize: 10 }}><span>{from}</span><span style={{ marginLeft: 'auto' }}>{time}</span></div>
              <div style={{ fontWeight: i === 0 ? 700 : 500, color: '#222' }}>{subject}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Adminer({ db }: { db: string }) {
  const tables = ['flyway_schema_history', 'customers', 'orders', 'order_items'];
  return (
    <div style={{ display: 'flex', background: '#fff', fontFamily: 'Verdana, Arial, sans-serif', height: '100%', fontSize: 10.5 }}>
      <div style={{ width: 120, background: '#eef3f8', padding: 8, borderRight: '1px solid #c0c0c0' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Adminer</div>
        <div style={{ color: '#000', marginBottom: 6 }}>DB: app</div>
        {tables.map((t) => <div key={t} style={{ color: '#03c', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>select {t}</div>)}
      </div>
      <div style={{ flex: 1, padding: 10 }}>
        <div style={{ color: '#777', marginBottom: 6 }}>{db} » db » app</div>
        <div style={{ fontSize: 15, marginBottom: 8 }}>Veritabanı: app</div>
        <div style={{ color: '#03c', marginBottom: 8 }}>SQL komutu · İçe aktar · Dışa aktar</div>
        <div style={{ border: '1px solid #c0c0c0' }}>
          {tables.map((t, i) => (
            <div key={t} style={{ display: 'flex', padding: '4px 6px', background: i % 2 ? '#fff' : '#f5f5f5', borderTop: i ? '1px solid #e0e0e0' : 'none' }}>
              <span style={{ color: '#03c' }}>{t}</span>
              <span style={{ marginLeft: 'auto', color: '#777' }}>{[3, 128, 342, 911][i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PgAdmin() {
  const tree = ['Servers', '  db', '    Databases', '      app', '        Schemas', '          public', '            Tables (3)'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: SYS, height: '100%', fontSize: 10.5 }}>
      <div style={{ background: '#326690', color: '#fff', height: 30, display: 'flex', alignItems: 'center', gap: 12, padding: '0 10px' }}>
        <strong>pgAdmin 4</strong><span style={{ opacity: 0.8 }}>Dosya</span><span style={{ opacity: 0.8 }}>Nesne</span><span style={{ opacity: 0.8 }}>Araçlar</span>
      </div>
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ width: 130, borderRight: '1px solid #dde0e6', padding: 8, fontFamily: MONO, fontSize: 10, whiteSpace: 'pre', color: '#222' }}>
          {tree.join('\n')}
        </div>
        <div style={{ flex: 1, padding: 8 }}>
          <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #dde0e6', marginBottom: 8 }}>
            {['Pano', 'Özellikler', 'SQL'].map((t, i) => <span key={t} style={{ paddingBottom: 4, borderBottom: i === 0 ? '2px solid #326690' : 'none', fontWeight: i === 0 ? 600 : 400 }}>{t}</span>)}
          </div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>İşlem / sn</div>
          <Line color="#326690" seed={5} height={50} />
          <div style={{ fontWeight: 600, margin: '6px 0 2px' }}>Oturumlar</div>
          <Line color="#2fa84f" seed={7} height={40} />
        </div>
      </div>
    </div>
  );
}

function MongoExpress() {
  return (
    <div style={{ background: '#fff', fontFamily: SYS, height: '100%', fontSize: 11 }}>
      <div style={{ background: '#222', color: '#9d9d9d', height: 32, display: 'flex', alignItems: 'center', gap: 12, padding: '0 10px' }}>
        <strong style={{ color: '#fff' }}>Mongo Express</strong><span>Veritabanı: app</span>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 15, marginBottom: 8 }}>Koleksiyonlar</div>
        {[['customers', '128'], ['orders', '342'], ['sessions', '57']].map(([name, count]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #ddd' }}>
            <span style={{ background: '#337ab7', color: '#fff', borderRadius: 3, padding: '2px 8px' }}>Görüntüle</span>
            <span style={{ color: '#337ab7' }}>{name}</span>
            <span style={{ marginLeft: 'auto', color: '#777' }}>{count} doküman</span>
          </div>
        ))}
        <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 10, background: '#f5f5f5', padding: 6, borderRadius: 3, color: '#333' }}>
          {'{ "_id": ObjectId("…"), "name": "Ayşe Yılmaz" }'}
        </div>
      </div>
    </div>
  );
}

function RedisInsight() {
  const keys: [string, string, string][] = [['cache:urunler', 'STRING', '#6a7685'], ['session:a81f', 'HASH', '#364cff'], ['kuyruk:mail', 'LIST', '#008556']];
  return (
    <div style={{ display: 'flex', background: '#fff', fontFamily: SYS, height: '100%', fontSize: 11 }}>
      <div style={{ width: 36, background: '#0d1a2b', display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
        <span style={{ width: 16, height: 16, borderRadius: 4, background: '#dc382c' }} />
      </div>
      <div style={{ flex: 1, padding: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>redis:6379 · Tarayıcı</div>
        <div style={box({ border: '1px solid #d4d8de', borderRadius: 4, padding: '5px 8px', color: '#8a96a8', marginBottom: 8 })}>Anahtar ara…</div>
        {keys.map(([key, type, color]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #eef0f3' }}>
            <span style={{ background: color, color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 3, padding: '1px 5px', width: 44, textAlign: 'center' }}>{type}</span>
            <span style={{ fontFamily: MONO, fontSize: 10.5 }}>{key}</span>
            <span style={{ marginLeft: 'auto', color: '#8a96a8', fontSize: 10 }}>TTL 300</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SwaggerUi({ security }: { security: boolean }) {
  const ops: [string, string, string, string][] = [
    ['GET', '/api/hello', '#61affe', '#ebf3fb'],
    ...(security ? [['POST', '/api/auth/token', '#49cc90', '#e8f6f0'] as [string, string, string, string]] : []),
    ['GET', '/actuator/health', '#61affe', '#ebf3fb'],
  ];
  return (
    <div style={{ background: '#fff', fontFamily: SYS, height: '100%', fontSize: 11, color: '#3b4151' }}>
      <div style={{ background: '#1b1b1b', height: 32, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8 }}>
        <span style={{ width: 16, height: 16, borderRadius: 99, background: '#85ea2d' }} />
        <strong style={{ color: '#fff' }}>Swagger</strong>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>OpenAPI definition <span style={{ fontSize: 9, background: '#7d8492', color: '#fff', borderRadius: 8, padding: '1px 5px', verticalAlign: 'middle' }}>v0</span></div>
        <div style={{ color: '#4990e2', margin: '2px 0 10px' }}>/v3/api-docs</div>
        {ops.map(([method, path, color, bg]) => (
          <div key={path} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${color}`, background: bg, borderRadius: 4, padding: 4, marginBottom: 6 }}>
            <span style={{ background: color, color: '#fff', fontWeight: 700, borderRadius: 3, padding: '3px 0', width: 46, textAlign: 'center', fontSize: 10.5 }}>{method}</span>
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 10.5 }}>{path}</span>
          </div>
        ))}
        <div style={{ marginTop: 8, color: '#888' }}>Her endpoint'i açıp "Try it out" ile tarayıcıdan deneyebilirsin.</div>
      </div>
    </div>
  );
}

/** Servis id'si → önizleme. Kafka'nın kendi arayüzü olmadığı için Kafka UI gösterilir. */
export function servicePreview(id: string, ctx: { projectName: string; sqlLabel: string }): ServicePreviewInfo | null {
  switch (id) {
    case 'grafana':
      return { path: '/d/spring-boot', note: 'Grafana: metrikleri panolarda izlersin. Kullanıcı admin, şifre .env içindeki GRAFANA_PASSWORD. Prometheus bağlantısı hazır gelir, panoları sen eklersin.', render: () => <Grafana /> };
    case 'prometheus':
      return { path: '/query', note: 'Prometheus: backend\'in metriklerini toplar. Sorgu yazıp grafiğini görebilirsin; kalıcı panolar için Grafana kullanılır.', render: () => <Prometheus /> };
    case 'kafka':
    case 'kafka-ui':
      return { path: '/ui/clusters/local/topics', note: 'Kafka\'nın kendi arayüzü yok; Kafka UI ile topic\'leri, mesajları ve tüketicileri görürsün.', render: () => <KafkaUi /> };
    case 'rabbitmq':
      return { path: '/#/', note: 'RabbitMQ yönetim paneli: kuyrukları ve mesaj akışını izlersin. Kullanıcı ve şifre .env içinde (RABBITMQ_USER / RABBITMQ_PASSWORD).', render: () => <RabbitMq /> };
    case 'keycloak':
      return { path: `/realms/${ctx.projectName}/account`, note: `Keycloak giriş ekranı. "${ctx.projectName}" realm'i ve demo / demo test kullanıcısı hazır gelir; yönetim paneli için .env içindeki KEYCLOAK_ADMIN bilgileri.`, render: () => <Keycloak realm={ctx.projectName} /> };
    case 'mailpit':
      return { path: '/', note: 'Mailpit: uygulamanın gönderdiği e-postalar burada toplanır, kimseye gerçekten gitmez. Tıklayınca HTML hâlini görürsün.', render: () => <Mailpit /> };
    case 'adminer':
      return { path: '/?server=db&db=app', note: 'Adminer: tabloları görür, veri düzenler, SQL çalıştırırsın. Sunucu: db, kullanıcı ve şifre .env içinde.', render: () => <Adminer db={ctx.sqlLabel} /> };
    case 'pgadmin':
      return { path: '/browser/', note: 'pgAdmin: PostgreSQL\'in gelişmiş yönetim arayüzü. Giriş e-postası ve şifre .env içinde (PGADMIN_EMAIL / PGADMIN_PASSWORD).', render: () => <PgAdmin /> };
    case 'mongo-express':
      return { path: '/db/app', note: 'Mongo Express: koleksiyonları ve dokümanları tarayıcıdan görüntüler, düzenlersin.', render: () => <MongoExpress /> };
    case 'redis-insight':
      return { path: '/browser', note: 'Redis Insight: önbellekteki anahtarları, türlerini ve sürelerini görürsün.', render: () => <RedisInsight /> };
    default:
      return null;
  }
}
