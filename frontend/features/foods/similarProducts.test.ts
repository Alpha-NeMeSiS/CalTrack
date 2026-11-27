import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedFood } from './types';
import { searchOFF } from './openfoodfacts';
import {
  brandFilter,
  estimateFromSimilar,
  estimateOrigin,
  estimateSource,
  estimateSummary,
  findSimilarProducts,
  nameTokens,
  productOrigin,
  rankSimilarProducts,
  RankedProduct,
  SimilarTarget,
} from './similarProducts';

vi.mock('./openfoodfacts', () => ({ searchOFF: vi.fn() }));
const mockedSearchOFF = vi.mocked(searchOFF);

afterEach(() => {
  mockedSearchOFF.mockReset();
});

function off(
  offCode: string,
  name: string,
  brand: string | undefined,
  [kcal, protein, fat, carbs]: [number, number, number, number],
): NormalizedFood {
  return {
    source: 'off',
    name,
    ...(brand ? { brand } : {}),
    offCode,
    kcal_per_100g: kcal,
    protein_g: protein,
    fat_g: fat,
    carbs_g: carbs,
    fiber_g: 0,
  };
}

// PastaBox bolognaise Sodebo scannée sans valeurs (étiquette : 127 kcal, P 7,5, L 2,8, G 17)
const TARGET: SimilarTarget = {
  code: '3242272270157',
  name: 'Sodebo pastabox 330g fusilli a la bolognaise',
  brand: 'Sodebo',
};

// Résultats réels d'Open Food Facts (réduits), dans un ordre mêlé
const PASTABOX_CANDIDATES: NormalizedFood[] = [
  off('3242272252528', 'Pastabox fusilli carbonara', 'Sodebo', [160, 5.8, 7.6, 17]),
  off('3240000000001', 'Box fusilli bolognaise', 'Belle France', [144, 6.3, 5.2, 17]),
  off('3242272251750', 'Pastabox fusilli napolitaine au poulet', 'Sodebo', [123, 6.6, 2.8, 17]),
  off('3242272252054', 'Pasta Box fusilli à la bolognaise', 'Sodebo', [123, 6.7, 3, 16]),
  off('3242272251767', 'Pastabox fusilli aux fromages italiens', 'Sodebo', [176, 6.6, 8.5, 17]),
  off('3242272253754', 'PastaBOX Fusilli Jambon Champignons à la crème', 'Sodebo, PastaBOX', [147, 6.7, 4.8, 18.4]),
  off('3242272349150', 'Dolce Pizza Bolognese', 'Sodebo', [183, 9.6, 4.6, 25]),
  off('3242272270157', 'PastaBox pâtes fraîches bolognaise', 'Sodebo', [128, 7.5, 2.8, 17]),
  off('3242272252559', 'Pastabox fusilli carbonara', 'Sodebo', [160, 5.8, 7.6, 17]),
  off('3242272299999', 'Pastabox test', 'Sodebo', [400, 1, 1, 1]),
  off('3564700542606', 'Fusilli bolognaise', 'Côté Snack, Marque Repère', [140, 5.6, 5.1, 17]),
];

function ranked(food: NormalizedFood, score: number, sameBrand = true): RankedProduct {
  return { food, score, sameBrand };
}

describe('nameTokens', () => {
  it('garde les mots qui décrivent le produit (sans marque, quantité ni petits mots)', () => {
    expect(nameTokens('Sodebo pastabox 330g fusilli a la bolognaise', 'Sodebo')).toEqual([
      'pastabox',
      'fusilli',
      'bolognaise',
    ]);
  });

  it('retire les accents, les quantités et le « s » du pluriel', () => {
    expect(nameTokens('Pâtes fraîches Bolognaises 1kg')).toEqual(['pate', 'fraiche', 'bolognaise']);
  });

  it('ne garde rien pour un nom réduit à la marque et à une quantité', () => {
    expect(nameTokens('Sodebo 330g', 'Sodebo')).toEqual([]);
  });

  it('retire les mots vides et garde au plus 6 mots', () => {
    expect(nameTokens('Salade avec poulet pour midi sans sauce tomates basilic olives croutons')).toEqual([
      'salade',
      'poulet',
      'midi',
      'sauce',
      'tomate',
      'basilic',
    ]);
  });
});

describe('brandFilter', () => {
  it('filtre sur la première marque, sous ses formes de l’index (avec ou sans « xx: »)', () => {
    expect(brandFilter('Sodebo, PastaBOX')).toBe(
      '(brands:"Sodebo" OR brands:"sodebo" OR brands:"xx:Sodebo" OR brands:"xx:sodebo")'
    );
  });

  it('garde les accents, retire les guillemets et ajoute la forme courte de la marque', () => {
    expect(brandFilter('Côté "Snack"')).toBe(
      '(brands:"Côté Snack" OR brands:"côté snack" OR brands:"xx:Côté Snack" OR brands:"xx:côté snack" OR brands:"xx:cote-snack")'
    );
  });

  it('ne filtre pas sans marque', () => {
    expect(brandFilter(undefined)).toBeNull();
    expect(brandFilter('  ')).toBeNull();
  });
});

describe('rankSimilarProducts', () => {
  const result = rankSimilarProducts(TARGET, PASTABOX_CANDIDATES);
  const names = result.map((item) => item.food.name);

  it('met en tête le produit de la même marque qui a tous les mots du nom', () => {
    expect(result[0].food.name).toBe('Pasta Box fusilli à la bolognaise');
    expect(result[0].score).toBeCloseTo(1.25);
    expect(result[0].sameBrand).toBe(true);
  });

  it('écarte le produit scanné, les produits sans mot commun, les doublons et les fiches incohérentes', () => {
    expect(result.some((item) => item.food.offCode === '3242272270157')).toBe(false);
    expect(names).not.toContain('Dolce Pizza Bolognese');
    expect(result.filter((item) => item.food.name === 'Pastabox fusilli carbonara')).toHaveLength(1);
    expect(result.find((item) => item.food.name === 'Pastabox fusilli carbonara')?.food.offCode).toBe('3242272252528');
    expect(names).not.toContain('Pastabox test');
  });

  it('classe les autres marques après la même marque', () => {
    expect(names).toEqual([
      'Pasta Box fusilli à la bolognaise',
      'Pastabox fusilli carbonara',
      'Pastabox fusilli napolitaine au poulet',
      'Pastabox fusilli aux fromages italiens',
      'PastaBOX Fusilli Jambon Champignons à la crème',
      'Box fusilli bolognaise',
      'Fusilli bolognaise',
    ]);
    expect(result[5].score).toBeCloseTo(2 / 3);
    expect(result[5].sameBrand).toBe(false);
  });
});

describe('estimateFromSimilar', () => {
  it('reprend le produit le plus proche quand il est seul en tête (jeu réel PastaBox)', () => {
    const estimate = estimateFromSimilar(rankSimilarProducts(TARGET, PASTABOX_CANDIDATES));
    expect(estimate?.values).toEqual({ kcal_per_100g: 123, protein_g: 6.7, fat_g: 3, carbs_g: 16, fiber_g: 0 });
    expect(estimate?.used).toHaveLength(1);
    expect(estimate?.proximity).toBe('same-brand');
    expect(estimate?.choices).toHaveLength(5);
    expect(estimate?.choices[0]).toBe(estimate?.used[0]);
  });

  it('prend la médiane de 3 produits à égalité, sans les suivants', () => {
    const estimate = estimateFromSimilar([
      ranked(off('1', 'A', 'Sodebo', [100, 4, 2, 15]), 1),
      ranked(off('2', 'B', 'Sodebo', [150, 6, 5, 18]), 1),
      ranked(off('3', 'C', 'Sodebo', [130, 5, 3, 16]), 1.005),
      ranked(off('4', 'D', 'Sodebo', [300, 9, 9, 30]), 0.5),
    ]);
    expect(estimate?.used).toHaveLength(3);
    expect(estimate?.values).toEqual({ kcal_per_100g: 130, protein_g: 5, fat_g: 3, carbs_g: 16, fiber_g: 0 });
  });

  it('fait la moyenne de 2 produits à égalité', () => {
    const estimate = estimateFromSimilar([
      ranked(off('1', 'A', 'Sodebo', [100, 5, 2, 15]), 1),
      ranked(off('2', 'B', 'Sodebo', [151, 6, 5, 18]), 1),
    ]);
    expect(estimate?.used).toHaveLength(2);
    expect(estimate?.values.kcal_per_100g).toBe(126);
    expect(estimate?.values.protein_g).toBe(5.5);
  });

  it('signale des marques différentes', () => {
    const estimate = estimateFromSimilar([
      ranked(off('1', 'A', 'Sodebo', [100, 5, 2, 15]), 0.67),
      ranked(off('2', 'B', 'Auchan', [151, 6, 5, 18]), 0.67, false),
    ]);
    expect(estimate?.proximity).toBe('other-brands');
  });

  it('ne propose rien sans produit', () => {
    expect(estimateFromSimilar([])).toBeNull();
  });
});

describe('textes', () => {
  const one = estimateFromSimilar(rankSimilarProducts(TARGET, PASTABOX_CANDIDATES))!;
  const three = estimateFromSimilar([
    ranked(off('1', 'A', 'Sodebo', [100, 4, 2, 15]), 1),
    ranked(off('2', 'B', 'Auchan, Mmm', [150, 6, 5, 18]), 1, false),
    ranked(off('3', 'C', 'Sodebo', [130, 5, 3, 16]), 1),
  ])!;
  const two = estimateFromSimilar([
    ranked(off('1', 'A', undefined, [100, 5, 2, 15]), 1, false),
    ranked(off('2', 'B', undefined, [151, 6, 5, 18]), 1, false),
  ])!;

  it('origine : produit et marque, ou marques', () => {
    expect(productOrigin(one.used[0].food)).toBe('Pasta Box fusilli à la bolognaise (Sodebo)');
    expect(productOrigin(off('1', 'Sans marque', undefined, [1, 0, 0, 0]))).toBe('Sans marque');
    expect(estimateOrigin(one)).toBe('Pasta Box fusilli à la bolognaise (Sodebo)');
    expect(estimateOrigin(three)).toBe('Sodebo, Auchan');
  });

  it('source du bandeau', () => {
    expect(estimateSource(one)).toBe('1 produit proche : Pasta Box fusilli à la bolognaise (Sodebo)');
    expect(estimateSource(three)).toBe('3 produits proches (Sodebo, Auchan)');
    expect(estimateSource(two)).toBe('2 produits proches');
  });

  it('résumé selon le nombre de produits utilisés', () => {
    expect(estimateSummary(one)).toBe('D’après le produit le plus proche');
    expect(estimateSummary(two)).toBe('Moyenne des 2 produits les plus proches');
    expect(estimateSummary(three)).toBe('Médiane des 3 produits les plus proches');
  });
});

describe('findSimilarProducts', () => {
  const bolognaise = PASTABOX_CANDIDATES[3];
  const belleFrance = PASTABOX_CANDIDATES[1];

  it('cherche dans la même marque puis dans toutes les marques (30 résultats chacune)', async () => {
    mockedSearchOFF.mockResolvedValueOnce([bolognaise]).mockResolvedValueOnce([belleFrance]);
    const controller = new AbortController();

    const estimate = await findSimilarProducts(TARGET, controller.signal);

    // L'index combine les mots en ET : les mots du nom sont reliés par OR
    expect(mockedSearchOFF).toHaveBeenCalledWith(
      '(brands:"Sodebo" OR brands:"sodebo" OR brands:"xx:Sodebo" OR brands:"xx:sodebo") AND (pastabox OR fusilli OR bolognaise)',
      controller.signal,
      30,
      true
    );
    expect(mockedSearchOFF).toHaveBeenCalledWith('pastabox OR fusilli OR bolognaise', controller.signal, 30, true);
    expect(estimate?.used[0].food.name).toBe('Pasta Box fusilli à la bolognaise');
    expect(estimate?.choices.map((item) => item.food.name)).toEqual(['Pasta Box fusilli à la bolognaise', 'Box fusilli bolognaise']);
  });

  it('se contente d’une recherche si l’autre échoue', async () => {
    mockedSearchOFF.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce([belleFrance]);
    const estimate = await findSimilarProducts(TARGET);
    expect(estimate?.used[0].food.name).toBe('Box fusilli bolognaise');
    expect(estimate?.proximity).toBe('other-brands');
  });

  it('ne propose rien si les deux recherches échouent', async () => {
    mockedSearchOFF.mockRejectedValue(new Error('503'));
    expect(await findSimilarProducts(TARGET)).toBeNull();
  });

  it('cherche seulement dans toutes les marques sans marque connue', async () => {
    mockedSearchOFF.mockResolvedValue([belleFrance]);
    await findSimilarProducts({ code: '1', name: 'Box fusilli bolognaise' });
    expect(mockedSearchOFF).toHaveBeenCalledTimes(1);
    expect(mockedSearchOFF).toHaveBeenCalledWith('box OR fusilli OR bolognaise', undefined, 30, true);
  });

  it('ne cherche rien si le nom n’a pas de mot utile', async () => {
    expect(await findSimilarProducts({ code: '1', name: 'Sodebo 330g', brand: 'Sodebo' })).toBeNull();
    expect(mockedSearchOFF).not.toHaveBeenCalled();
  });

  it('propage l’annulation', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    mockedSearchOFF.mockRejectedValue(abort);
    const controller = new AbortController();
    controller.abort();
    await expect(findSimilarProducts(TARGET, controller.signal)).rejects.toBe(abort);
  });
});
