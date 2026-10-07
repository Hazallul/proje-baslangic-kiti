import AdmZip from 'adm-zip';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import snapshot from './data/initializr-snapshot.json' with { type: 'json' };
import type { BuildTool } from './types.js';

const BASE_URL = 'https://start.spring.io';

export interface InitializrDependency {
  id: string;
  name: string;
  description: string;
}

export interface InitializrCatalog {
  bootVersion: string;
  javaVersions: string[];
  groups: { name: string; dependencies: InitializrDependency[] }[];
  /** live: start.spring.io'dan şimdi alındı, cache: önceki kayıt, snapshot: uygulamayla gelen kopya */
  source: 'live' | 'cache' | 'snapshot';
}

interface RawMetadata {
  bootVersion: { default: string };
  javaVersion: { values: { id: string }[] };
  dependencies: {
    values: { name: string; values: { id: string; name: string; description?: string; versionRange?: string }[] }[];
  };
}

/**
 * Initializr kataloğunu getirir. Önce canlı, olmazsa önbellek, o da yoksa uygulamayla gelen kopya.
 * @param cacheFile Canlı sonucun kaydedileceği dosya
 */
export async function loadCatalog(cacheFile: string): Promise<InitializrCatalog> {
  try {
    const res = await fetch(BASE_URL, {
      headers: { Accept: 'application/vnd.initializr.v2.2+json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const raw = (await res.json()) as RawMetadata;
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(raw));
    return toCatalog(raw, 'live');
  } catch {
    if (existsSync(cacheFile)) {
      try {
        return toCatalog(JSON.parse(readFileSync(cacheFile, 'utf8')) as RawMetadata, 'cache');
      } catch {
        // bozuk önbellek: gömülü kopyaya düş
      }
    }
    return toCatalog(snapshot as RawMetadata, 'snapshot');
  }
}

function toCatalog(raw: RawMetadata, source: InitializrCatalog['source']): InitializrCatalog {
  const bootVersion = raw.bootVersion.default;
  return {
    bootVersion,
    // Sadece LTS sürümler: 17, 21, 25...
    javaVersions: raw.javaVersion.values
      .map((v) => v.id)
      .filter((v) => ['17', '21', '25'].includes(v))
      .sort((a, b) => Number(a) - Number(b)),
    groups: raw.dependencies.values
      .map((group) => ({
        name: group.name,
        dependencies: group.values
          .filter((d) => !d.versionRange || inRange(bootVersion, d.versionRange))
          .map((d) => ({ id: d.id, name: d.name, description: d.description ?? '' })),
      }))
      .filter((g) => g.dependencies.length > 0),
    source,
  };
}

export interface DownloadOptions {
  name: string;
  groupId: string;
  packageName: string;
  javaVersion: string;
  buildTool: BuildTool;
  dependencies: string[];
}

/** Spring Boot iskeletini indirip `<projectDir>/backend` klasörüne açar. */
export async function downloadProject(opts: DownloadOptions, projectDir: string, signal?: AbortSignal): Promise<void> {
  const params = new URLSearchParams({
    type: opts.buildTool === 'gradle' ? 'gradle-project' : 'maven-project',
    language: 'java',
    baseDir: 'backend',
    groupId: opts.groupId,
    artifactId: opts.name,
    name: opts.name,
    packageName: opts.packageName,
    javaVersion: opts.javaVersion,
    dependencies: opts.dependencies.join(','),
  });

  const res = await fetch(`${BASE_URL}/starter.zip?${params}`, { signal });
  if (!res.ok) {
    throw new Error(`Spring Initializr hata döndü (${res.status}): ${await res.text()}`);
  }
  new AdmZip(Buffer.from(await res.arrayBuffer())).extractAllTo(projectDir, true);

  if (process.platform !== 'win32') {
    for (const script of ['mvnw', 'gradlew']) {
      const file = join(projectDir, 'backend', script);
      if (existsSync(file)) chmodSync(file, 0o755);
    }
  }
}

/** Maven Central'daki en son kararlı sürümü döner. */
export async function latestMavenVersion(groupId: string, artifactId: string): Promise<string> {
  const url = `https://repo1.maven.org/maven2/${groupId.replaceAll('.', '/')}/${artifactId}/maven-metadata.xml`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${artifactId} sürümü alınamadı (${res.status})`);
  const xml = await res.text();
  const release = xml.match(/<release>([^<]+)<\/release>/)?.[1];
  if (!release) throw new Error(`${artifactId} için sürüm bulunamadı`);
  return release;
}

// ---------------------------------------------------------------------------
// Initializr sürüm aralıkları: "4.0.0" (en az) veya "[4.0.0,4.3.0-M1)"
// ---------------------------------------------------------------------------

export function inRange(version: string, range: string): boolean {
  const match = range.match(/^([[(])(.+),(.+)([\])])$/);
  if (!match) return compareVersions(version, range) >= 0;
  const [, open, min, max, close] = match;
  const aboveMin = open === '[' ? compareVersions(version, min) >= 0 : compareVersions(version, min) > 0;
  const belowMax = close === ']' ? compareVersions(version, max) <= 0 : compareVersions(version, max) < 0;
  return aboveMin && belowMax;
}

/** Kararlı sürüm, aynı numaralı M / RC / SNAPSHOT sürümlerinden büyüktür. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [nums, qualifier = ''] = v.split(/-(.*)/);
    const parts = nums.split('.').map(Number);
    const rank = qualifier.startsWith('M') ? 0 : qualifier.startsWith('RC') ? 1 : qualifier.startsWith('SNAPSHOT') ? 2 : 3;
    return { parts, rank, qualifier };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa.parts[i] ?? 0) - (pb.parts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (pa.rank !== pb.rank) return pa.rank - pb.rank;
  return pa.qualifier.localeCompare(pb.qualifier, undefined, { numeric: true });
}
