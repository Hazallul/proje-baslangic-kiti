import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FRAMEWORKS } from '../dist/core/catalog/frontend.js';
import {
  angularStartPage,
  localeFiles,
  reactStartPage,
  reactStartPageTest,
  svelteStartPage,
  vueStartPage,
} from '../dist/core/generate/startpage.js';

const opts = (options, backend = true) => ({ name: 'demo-app', options: new Set(options), backend });

/** Framework'ün başlangıç sayfası metni (Angular'da ts + html birlikte) */
function pageOf(framework, options, backend = true) {
  const o = opts(options, backend);
  switch (framework) {
    case 'react': return reactStartPage(o);
    case 'vue': return vueStartPage(o);
    case 'svelte': return svelteStartPage(o);
    case 'angular': return Object.values(angularStartPage(o)).join('\n');
  }
}

/** UI kütüphanesi seçilince sayfada görünmesi gereken içe aktarma / bileşen */
const KIT_MARKERS = {
  shadcn: "from '@/components/ui/button'",
  mui: "from '@mui/material'",
  antd: "from 'antd'",
  mantine: "from '@mantine/core'",
  vuetify: '<v-card',
  primevue: "from 'primevue/button'",
  'element-plus': '<el-card',
  'angular-material': "from '@angular/material/card'",
  primeng: "from 'primeng/card'",
};

describe('başlangıç sayfası', () => {
  for (const fw of FRAMEWORKS) {
    const kits = [null, ...fw.options.filter((o) => o.group === 'ui').map((o) => o.id)];
    for (const kit of kits) {
      const options = kit ? [kit, ...(fw.options.find((o) => o.id === kit).requires ?? [])] : [];
      it(`${fw.label} · ${kit ?? 'kütüphanesiz'}: proje adı, durum listesi ve merhaba formu`, () => {
        const page = pageOf(fw.id, options);
        assert.ok(page.includes('demo-app'));
        assert.ok(page.includes('Bağlantı durumu'));
        assert.ok(page.includes('Merhaba dünya'));
        assert.ok(page.includes('/hello'));
        if (kit) assert.ok(page.includes(KIT_MARKERS[kit]), `${kit} bileşenleri kullanılmamış`);
      });

      it(`${fw.label} · ${kit ?? 'kütüphanesiz'} · sadece frontend: backend'e istek atmaz, kurulum listesini gösterir`, () => {
        const page = pageOf(fw.id, options, false);
        assert.ok(page.includes('demo-app'));
        assert.ok(page.includes('Kurulum'));
        assert.ok(!page.includes('/hello'), 'backend isteği kalmış');
        assert.ok(!page.includes('Bağlantı durumu'));
        assert.ok(page.includes(fw.description), 'framework kurulum listesinde yok');
        if (kit) assert.ok(page.includes(KIT_MARKERS[kit]), `${kit} bileşenleri kullanılmamış`);
      });
    }
  }

  it('Tailwind varsa düz CSS dosyası kullanılmaz', () => {
    assert.ok(reactStartPage(opts([])).includes("import './status.css'"));
    assert.ok(!reactStartPage(opts(['tailwind'])).includes('status.css'));
    assert.equal(angularStartPage(opts(['tailwind']))['src/app/pages/status-page.css'], undefined);
  });

  it('Axios seçiliyse istekler ortak istemciden gider', () => {
    assert.match(reactStartPage(opts(['axios'])), /api\.get<HelloResponse>\('\/hello'/);
    assert.match(vueStartPage(opts([])), /fetch\('\/api\/hello'/);
  });

  it('Mantine testinde sayfa provider ile render edilir', () => {
    assert.match(reactStartPageTest(opts(['mantine'])), /<MantineProvider>/);
    assert.ok(!reactStartPageTest(opts(['mui'])).includes('MantineProvider'));
  });

  it('Kurulum listesinde Vercel gibi yayınlama seçenekleri yer almaz', () => {
    const page = reactStartPage(opts(['tailwind', 'vercel'], false));
    assert.ok(page.includes('Tailwind CSS'));
    assert.ok(!page.includes('Vercel'));
  });

  it('Svelte sayfası kullanılmayan Status tipini içe aktarmaz', () => {
    assert.ok(!svelteStartPage(opts([], false)).includes('type Status'));
    assert.ok(svelteStartPage(opts(['tailwind'], false)).includes('type Status'));
    assert.ok(svelteStartPage(opts([])).includes('type Status'));
  });
});

describe('Motion', () => {
  it('kartlar ve selamlama animasyonla gelir', () => {
    const page = reactStartPage(opts(['motion'], false));
    assert.ok(page.includes("import { motion } from 'motion/react'"));
    assert.ok(page.includes('<motion.div'));
    assert.ok(page.includes('<motion.p'));
    assert.ok(page.includes('index={1}'));
  });

  it('seçilmediyse motion kullanılmaz', () => {
    const page = reactStartPage(opts([], false));
    assert.ok(!page.includes('motion'));
    assert.ok(!page.includes('index'));
  });
});

describe('çoklu dil', () => {
  it('React: metinler t() ile gelir, dil düğmesi i18next dilini değiştirir', () => {
    const page = reactStartPage(opts(['i18n'], false));
    assert.ok(page.includes("import { useTranslation } from 'react-i18next'"));
    assert.ok(page.includes("t('setupTitle')"));
    assert.ok(page.includes("t('greeting', { name })"));
    assert.ok(page.includes('i18n.changeLanguage'));
    assert.ok(!page.includes('>Kurulum<') && !page.includes('"Kurulum"'), 'Türkçe metin sayfada sabit kalmış');
  });

  it('React testi i18n kurulumunu yükler', () => {
    assert.ok(reactStartPageTest(opts(['i18n'])).includes("import '../i18n'"));
  });

  it('Vue: metinler useI18n ile gelir, dil düğmesi locale değiştirir', () => {
    const page = vueStartPage(opts(['i18n'], false));
    assert.ok(page.includes("import { useI18n } from 'vue-i18n'"));
    assert.ok(page.includes("{{ t('setupTitle') }}"));
    assert.ok(page.includes('toggleLanguage'));
  });

  it('dil dosyalarında aynı anahtarlar var, değişken biçimi kütüphaneye uygun', () => {
    const keysOf = (src) => [...src.matchAll(/"([\w.]+)":/g)].map((m) => m[1]).sort();
    for (const fw of ['react', 'vue']) {
      const files = localeFiles(fw);
      assert.deepEqual(keysOf(files['src/locales/tr.ts']), keysOf(files['src/locales/en.ts']));
    }
    assert.ok(localeFiles('react')['src/locales/en.ts'].includes('Hello, {{name}}!'));
    assert.ok(localeFiles('vue')['src/locales/en.ts'].includes('Hello, {name}!'));
    assert.ok(localeFiles('vue')['src/locales/tr.ts'].includes('Merhaba, {name}!'));
  });
});
