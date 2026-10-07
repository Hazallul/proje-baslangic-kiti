// Testler derlenmiş çekirdeği (dist/core) kullanır: "npm test" önce tsc çalıştırır.
import { defaultSelection } from '../dist/core/selection.js';

/** Geçerli bir temel seçim; testler üzerine sadece ilgilendiği alanı yazar */
export function baseSelection(overrides = {}) {
  return { ...defaultSelection(), name: 'demo-app', location: 'C:\\Projeler', ...overrides };
}

export function withDatabase(sel, sql, nosql = []) {
  return { ...sel, database: { ...sel.database, sql, nosql } };
}

export function withFrontend(sel, framework, options = []) {
  return { ...sel, frontend: { framework, options } };
}
