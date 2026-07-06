import { useState, useMemo, useCallback } from 'react';
import { Product } from '@/lib/api';

function normalizeSearchValue(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function searchableProductText(product: Product): string {
  const existingSizes = (product.inventory || [])
    .filter((item) => item.quantity > 0)
    .flatMap((item) => [
      String(item.size),
      `${item.size}x${item.quantity}`,
      `${item.size} ${item.quantity}`,
    ]);

  return [
    product.artNo,
    product.name,
    product.colour,
    product.material,
    product.type,
    ...(product.seasons || []),
    ...existingSizes,
  ]
    .map(normalizeSearchValue)
    .filter(Boolean)
    .join(' ');
}

export interface UseSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredProducts: Product[];
  resultCount: number;
  clearSearch: () => void;
}

export function useSearch(products: Product[]): UseSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return products;
    }

    const tokens = normalizeSearchValue(searchQuery).split(/\s+/).filter(Boolean);

    return products.filter((product) => {
      const productText = searchableProductText(product);
      return tokens.every((token) => productText.includes(token));
    });
  }, [products, searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    filteredProducts,
    resultCount: filteredProducts.length,
    clearSearch,
  };
}
