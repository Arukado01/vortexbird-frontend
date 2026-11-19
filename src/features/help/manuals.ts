export const audiences = ['Visitante', 'Usuario estándar', 'Administrador', 'Administrador de partners', 'Operador'] as const;
export type Audience = typeof audiences[number];

export interface ManualSection {
  id: string;
  title: string;
  steps: string[];
  permission?: string;
  route?: string;
}

export interface Manual {
  id: string;
  title: string;
  module: string;
  category: string;
  summary: string;
  audiences: Audience[];
  owner: string;
  visibility: 'public';
  permissions: string[];
  keywords: string[];
  sections: ManualSection[];
  faq: { question: string; answer: string; permission?: string }[];
  history: { version: string; date: string; description: string }[];
  illustration?: { file: string; alt: string; caption: string; permission?: string };
  flow?: string[];
}

const sources = import.meta.glob<Manual>('../../../docs/user-manuals/*.json', { eager: true, import: 'default' });

export const manuals = Object.values(sources).sort((a, b) => a.title.localeCompare(b.title, 'es'));
export const categories = [...new Set(manuals.map(manual => manual.category))].sort((a, b) => a.localeCompare(b, 'es'));

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function findManuals(query: string, category: string, audience: string) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return manuals.filter(manual => {
    if (category && manual.category !== category || audience && !manual.audiences.some(profile => profile === audience)) return false;
    const text = [
      manual.title, manual.module, manual.category, manual.summary, ...manual.keywords,
      ...manual.sections.flatMap(section => [section.title, ...section.steps]),
      ...manual.faq.flatMap(item => [item.question, item.answer]),
    ];
    const corpus = normalize(text.join(' '));
    return terms.every(term => corpus.includes(term));
  });
}
