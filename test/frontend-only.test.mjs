import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { composeFile, envFile, portsFromEnv, serviceLinks } from '../dist/core/generate/compose.js';
import { readme } from '../dist/core/generate/docs.js';
import {
  applyPreset,
  hasBackend,
  projectKindOf,
  resolve,
  setNeed,
  setProjectKind,
  validate,
} from '../dist/core/selection.js';
import { baseSelection, withDatabase, withFrontend } from './helpers.mjs';

/** Sadece frontend projesi; backend tarafında kalmış seçimler yok sayılmalı */
function frontendOnly(options = []) {
  let sel = withDatabase(baseSelection(), 'mysql', ['redis']);
  sel = setNeed(sel, 'security', 'jwt');
  sel = setProjectKind(withFrontend(sel, 'react', options), 'frontend');
  return sel;
}

describe('proje türü', () => {
  it('eski kayıtlarda alan yoksa backend var sayılır', () => {
    const sel = baseSelection();
    delete sel.backend.enabled;
    assert.equal(hasBackend(sel), true);
  });

  it('tür seçimle tutarlı okunur', () => {
    assert.equal(projectKindOf(baseSelection()), 'backend');
    assert.equal(projectKindOf(withFrontend(baseSelection(), 'vue')), 'fullstack');
    assert.equal(projectKindOf(setProjectKind(baseSelection(), 'frontend')), 'frontend');
  });

  it('frontend türüne geçince framework yoksa React seçilir', () => {
    const sel = setProjectKind(baseSelection(), 'frontend');
    assert.equal(sel.frontend.framework, 'react');
    assert.equal(sel.backend.enabled, false);
  });

  it('sadece backend türü frontend seçimini temizler', () => {
    const sel = setProjectKind(withFrontend(baseSelection(), 'react', ['tailwind']), 'backend');
    assert.deepEqual(sel.frontend, { framework: null, options: [] });
    assert.equal(sel.backend.enabled, true);
  });

  it('backend açılınca Vercel seçeneği kalkar', () => {
    const sel = setProjectKind(frontendOnly(['tailwind', 'vercel']), 'fullstack');
    assert.deepEqual(sel.frontend.options, ['tailwind']);
  });

  it('şablon uygulanınca backend tekrar açılır', () => {
    assert.equal(hasBackend(applyPreset(frontendOnly(), 'fullstack')), true);
  });
});

describe('sadece frontend projesi', () => {
  it('backend paketleri, veritabanı ve servisler projeye girmez', () => {
    const resolved = resolve(frontendOnly());
    assert.deepEqual(resolved.dependencies, []);
    assert.deepEqual(resolved.libraries, []);
    assert.deepEqual(resolved.databases, []);
    assert.deepEqual(resolved.services, []);
  });

  it('Group ID kontrol edilmez, framework zorunludur', () => {
    const sel = frontendOnly();
    sel.backend.groupId = 'Geçersiz';
    assert.deepEqual(validate(sel), []);
    sel.frontend = { framework: null, options: [] };
    assert.deepEqual(validate(sel).map((i) => i.field), ['frontend']);
  });

  it('compose sadece frontend servisini içerir', () => {
    const compose = composeFile(resolve(frontendOnly()));
    assert.ok(compose.includes('  frontend:'));
    assert.ok(!compose.includes('  backend:'));
    assert.ok(!compose.includes('API_URL'));
    assert.ok(!compose.includes('depends_on'));
    assert.ok(!compose.includes('mysql'));
  });

  it('.env sadece frontend portunu içerir, şifre üretmez', () => {
    const resolved = resolve(frontendOnly());
    const ports = portsFromEnv(resolved, '');
    assert.deepEqual(ports.map((p) => p.envName), ['FRONTEND_PORT']);
    const env = envFile(resolved, ports, true);
    assert.ok(env.includes('FRONTEND_PORT='));
    assert.ok(!/PASSWORD|BACKEND_PORT|JWT/.test(env));
    assert.deepEqual(serviceLinks(resolved, ports).map((l) => l.label), ['Uygulama']);
  });

  it('README backend bölümlerini değil Docker\'sız çalıştırma ve Vercel adımlarını anlatır', () => {
    const resolved = resolve(frontendOnly(['vercel']));
    const text = readme(resolved, portsFromEnv(resolved, ''));
    assert.ok(!text.includes('Spring Boot'));
    assert.ok(!text.includes('backend'));
    assert.ok(!text.includes('Güvenlik'));
    assert.ok(text.includes('npm run dev'));
    assert.ok(text.includes('Vercel'));
  });

  it('Vercel seçilmediyse README yayınlama adımı içermez', () => {
    const resolved = resolve(frontendOnly());
    assert.ok(!readme(resolved, portsFromEnv(resolved, '')).includes('Vercel'));
  });
});
