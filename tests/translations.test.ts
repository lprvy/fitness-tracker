import { detectDeviceLanguage, translateContent, translations } from '../src/i18n/translations';
import {
  INITIAL_SHOPPING_LIST,
  INITIAL_STOCK,
  INITIAL_WORKOUTS,
  MENU_TEMPLATES,
} from '../src/constants/mockData';

describe('translations', () => {
  const { tr, en } = translations;

  it('has the same keys in Turkish and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });

  it('uses the same value type for every key', () => {
    for (const key of Object.keys(tr) as (keyof typeof tr)[]) {
      expect([key, typeof en[key]]).toEqual([key, typeof tr[key]]);
    }
  });

  it('has no empty strings', () => {
    for (const lang of [tr, en]) {
      for (const [key, value] of Object.entries(lang)) {
        if (typeof value === 'string') expect([key, value.trim().length > 0]).toEqual([key, true]);
      }
    }
  });

  it('formats the week label in each language', () => {
    expect(tr.week(3)).toBe('Hafta 3');
    expect(en.week(3)).toContain('3');
  });
});

describe('translateContent', () => {
  it('returns Turkish text unchanged', () => {
    expect(translateContent('tr', 'Pazartesi')).toBe('Pazartesi');
  });

  it('translates known content to English', () => {
    expect(translateContent('en', 'Pazartesi')).toBe('Monday');
    expect(translateContent('en', 'Tempo Koşusu')).toBe('Tempo Run');
  });

  it('falls back to the original text when there is no translation', () => {
    expect(translateContent('en', 'Squat Jump')).toBe('Squat Jump');
  });

  // Names shown through tc() on screen: a missing entry shows Turkish in the English UI.
  it('has an English name for every training day and workout', () => {
    const missing = Object.values(INITIAL_WORKOUTS)
      .flatMap((w) => [w.day, w.name])
      .filter((text) => translateContent('en', text) === text);
    expect(missing).toEqual([]);
  });

  it('has an English name for every menu, meal and ingredient', () => {
    const missing = MENU_TEMPLATES.flatMap((m) => [
      m.name,
      ...m.meals.flatMap((meal) => [meal.name, ...meal.ingredients.map((i) => i.name)]),
    ]).filter((text) => translateContent('en', text) === text);
    expect([...new Set(missing)]).toEqual([]);
  });

  it('has an English name for every shopping and stock item', () => {
    const names = [
      ...INITIAL_SHOPPING_LIST.map((i) => i.name),
      ...Object.values(INITIAL_STOCK).map((s) => s.name),
    ];
    const missing = names.filter((text) => translateContent('en', text) === text);
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('detectDeviceLanguage', () => {
  const realIntl = global.Intl;
  afterEach(() => {
    global.Intl = realIntl;
  });

  const withLocale = (locale: string) => {
    global.Intl = {
      ...realIntl,
      DateTimeFormat: (() => ({ resolvedOptions: () => ({ locale }) })) as unknown as typeof Intl.DateTimeFormat,
    };
  };

  it('picks Turkish for a Turkish locale', () => {
    withLocale('tr-TR');
    expect(detectDeviceLanguage()).toBe('tr');
  });

  it('picks English for any other locale', () => {
    withLocale('de-DE');
    expect(detectDeviceLanguage()).toBe('en');
  });

  it('falls back to Turkish when the locale cannot be read', () => {
    global.Intl = {
      ...realIntl,
      DateTimeFormat: (() => {
        throw new Error('no Intl');
      }) as unknown as typeof Intl.DateTimeFormat,
    };
    expect(detectDeviceLanguage()).toBe('tr');
  });
});
