import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyPreset,
  resolve,
  setNeed,
  suggestedServices,
  toggleDependency,
  toggleFrontendOption,
  toggleService,
  validate,
} from '../dist/core/selection.js';
import { baseSelection, withDatabase, withFrontend } from './helpers.mjs';

const fieldsOf = (sel) => validate(sel).map((i) => i.field);

describe('validate', () => {
  it('geçerli seçimde sorun bulmaz', () => {
    assert.deepEqual(validate(baseSelection()), []);
  });

  it('proje adı kurallarını uygular', () => {
    for (const name of ['', 'MyApp', '1abc', 'my_app', 'my-app-', 'class', 'new']) {
      assert.deepEqual(fieldsOf(baseSelection({ name })), ['name'], `"${name}" reddedilmeli`);
    }
    for (const name of ['a', 'siparis-takip', 'app2', 'classroom']) {
      assert.deepEqual(fieldsOf(baseSelection({ name })), [], `"${name}" kabul edilmeli`);
    }
  });

  it('konumun tam yol olmasını ister', () => {
    for (const location of ['', 'Projeler', '.\\x', 'C:Projeler']) {
      assert.deepEqual(fieldsOf(baseSelection({ location })), ['location'], `"${location}" reddedilmeli`);
    }
    for (const location of ['C:\\Projeler', 'D:/kod', '/home/user', '\\\\sunucu\\paylasim']) {
      assert.deepEqual(fieldsOf(baseSelection({ location })), [], `"${location}" kabul edilmeli`);
    }
  });

  it('Group ID için Java paket kurallarını uygular', () => {
    const withGroup = (groupId) => baseSelection({ backend: { ...baseSelection().backend, groupId } });
    for (const groupId of ['Com.Example', 'com..x', 'com.new', '1com']) {
      assert.deepEqual(fieldsOf(withGroup(groupId)), ['groupId'], `"${groupId}" reddedilmeli`);
    }
    assert.deepEqual(fieldsOf(withGroup('tr.com.uludag_enerji')), []);
  });
});

describe('şablonlar ve ihtiyaçlar', () => {
  it('Fullstack şablonu React, Swagger ve doğrulamayı seçer', () => {
    const resolved = resolve(applyPreset(baseSelection(), 'fullstack'));
    assert.equal(resolved.selection.frontend.framework, 'react');
    assert.ok(resolved.dependencies.includes('web'));
    assert.ok(resolved.dependencies.includes('validation'));
    assert.ok(resolved.libraries.includes('springdoc'));
  });

  it('şablon adı, konumu ve veritabanını korur', () => {
    const sel = withDatabase(baseSelection({ name: 'korunsun' }), 'postgresql');
    const next = applyPreset(sel, 'rest-api');
    assert.equal(next.name, 'korunsun');
    assert.equal(next.database.sql, 'postgresql');
  });

  it('Fullstack projede frontend\'siz şablon seçilince frontend korunur (tür değişmez)', () => {
    const sel = withFrontend(baseSelection(), 'vue', ['pinia']);
    const next = applyPreset(sel, 'secure-api');
    assert.deepEqual(next.frontend, { framework: 'vue', options: ['pinia'] });
    assert.equal(next.needs.security, 'jwt');
  });

  it('REST API projesinde frontend\'siz şablon frontend eklemez', () => {
    assert.equal(applyPreset(baseSelection(), 'rest-api').frontend.framework, null);
  });

  it('JWT güvenliği Spring Security ve resource server ekler', () => {
    const resolved = resolve(setNeed(baseSelection(), 'security', 'jwt'));
    assert.ok(resolved.dependencies.includes('security'));
    assert.ok(resolved.dependencies.includes('oauth2-resource-server'));
    assert.equal(resolved.dependencySources.security, 'Güvenlik');
  });

  it('varyant değişince önceki varyantın servisleri kalkar', () => {
    let sel = setNeed(baseSelection(), 'security', 'keycloak');
    assert.ok(sel.services.includes('keycloak'));
    sel = setNeed(sel, 'security', 'jwt');
    assert.ok(!sel.services.includes('keycloak'));
    sel = setNeed(sel, 'security', null);
    assert.equal(sel.needs.security, undefined);
  });

  it('elle seçilen paketin kaynağı "Elle seçildi" olur', () => {
    const resolved = resolve(toggleDependency(baseSelection(), 'lombok'));
    assert.equal(resolved.dependencySources.lombok, 'Elle seçildi');
  });

  it('SQL veritabanı seçilince migration paketi eklenir', () => {
    const resolved = resolve(withDatabase(baseSelection(), 'mysql'));
    assert.ok(resolved.dependencies.includes('mysql'));
    assert.ok(resolved.dependencies.includes('data-jpa'));
    assert.ok(resolved.dependencies.includes('flyway'));
  });
});

describe('frontend seçenekleri', () => {
  it('shadcn Tailwind ister, Tailwind kalkınca shadcn de kalkar', () => {
    let sel = withFrontend(baseSelection(), 'react');
    sel = toggleFrontendOption(sel, 'shadcn');
    assert.deepEqual([...sel.frontend.options].sort(), ['shadcn', 'tailwind']);
    sel = toggleFrontendOption(sel, 'tailwind');
    assert.deepEqual(sel.frontend.options, []);
  });

  it('aynı gruptan tek UI kütüphanesi seçilebilir', () => {
    let sel = withFrontend(baseSelection(), 'react');
    sel = toggleFrontendOption(sel, 'mui');
    sel = toggleFrontendOption(sel, 'antd');
    assert.deepEqual(sel.frontend.options, ['antd']);
  });

  it('framework olmadan seçenek eklenmez', () => {
    const sel = toggleFrontendOption(baseSelection(), 'tailwind');
    assert.deepEqual(sel.frontend.options, []);
  });
});

describe('servisler', () => {
  it('Grafana, Prometheus\'u da ekler; Prometheus kalkınca Grafana da kalkar', () => {
    let sel = toggleService(baseSelection(), 'grafana');
    assert.ok(sel.services.includes('prometheus'));
    sel = toggleService(sel, 'prometheus');
    assert.deepEqual(sel.services, []);
  });

  it('ilgili veritabanı yoksa veritabanı arayüzü projeye girmez', () => {
    const sel = { ...baseSelection(), services: ['pgadmin'] };
    assert.deepEqual(resolve(sel).services, []);
    assert.deepEqual(resolve(withDatabase(sel, 'postgresql')).services, ['pgadmin']);
  });

  it('MySQL seçilince Adminer önerilir', () => {
    const ids = suggestedServices(resolve(withDatabase(baseSelection(), 'mysql'))).map((s) => s.id);
    assert.ok(ids.includes('adminer'));
  });

  it('JWT seçiliyken Keycloak önerilmez, sadece resource server varken önerilir', () => {
    const jwt = suggestedServices(resolve(setNeed(baseSelection(), 'security', 'jwt'))).map((s) => s.id);
    assert.ok(!jwt.includes('keycloak'));
    const manual = suggestedServices(resolve(toggleDependency(baseSelection(), 'oauth2-resource-server'))).map((s) => s.id);
    assert.ok(manual.includes('keycloak'));
  });
});
