import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worksSource = await readFile(
  new URL('../src/components/Works.jsx', import.meta.url),
  'utf8',
);

test('Works presents Friz as the only featured case', () => {
  assert.match(worksSource, /const featuredWork/);
  assert.doesNotMatch(worksSource, /\b(?:Kadr|Volna|Atlas)\b/);
  assert.match(worksSource, /Frontend-разработка/);
  assert.match(worksSource, /React 19, Vite 8, GSAP, Lenis/);
});

test('the featured case uses three real Friz visuals', () => {
  const visuals = worksSource.match(/assets\/works\/friz-[^']+\.(?:png|webp|jpg)/g) ?? [];
  assert.equal(new Set(visuals).size, 3);
});

test('the clickable Friz screen uses the white intro screenshot', () => {
  assert.match(worksSource, /import frizMain from '..\/assets\/works\/friz-intro\.png'/);
});
