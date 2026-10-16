import { describe, it, expect } from 'vitest';
import { normalizeArabic, calculateWordOverlap, isVerseMatch } from '../../src/services/arabic-normalizer.js';

describe('Arabic Normalizer & Verification', () => {
  it('normalizes diacritics, tatweel, and letter variants', () => {
    const raw = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    const normalized = normalizeArabic(raw);
    expect(normalized).toBe('بسم الله الرحمن الرحيم');
  });

  it('normalizes hamza variants, ta marbuta, and alif maqsura', () => {
    expect(normalizeArabic('إِنَّا أَعْطَيْنَاكَ')).toBe('انا اعطيناك');
    expect(normalizeArabic('الْقَارِعَةُ')).toBe('القارعه');
    expect(normalizeArabic('هُدًى')).toBe('هدي');
  });

  it('calculates word overlap between recited snippet and full verse', () => {
    const verse = 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ';
    const recited = 'فباي الاء ربكما';
    const overlap = calculateWordOverlap(verse, recited);
    expect(overlap).toBeGreaterThan(0.7);
  });

  it('validates verse match when recited words are present in verse', () => {
    const fullVerse = 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ';
    const recitedPart = 'لا اله الا هو الحي';
    expect(isVerseMatch(fullVerse, recitedPart)).toBe(true);
    expect(isVerseMatch(fullVerse, 'قل هو الله احد')).toBe(false);
  });

  it('handles empty or whitespace strings gracefully', () => {
    expect(normalizeArabic('')).toBe('');
    expect(normalizeArabic(null)).toBe('');
    expect(calculateWordOverlap('', '')).toBe(0);
    expect(isVerseMatch('', '')).toBe(false);
  });
});
