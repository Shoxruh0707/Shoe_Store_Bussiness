import { useState, useMemo, useCallback } from 'react';
import { Product } from '@/lib/api';

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

    const lowerQuery = searchQuery.toLowerCase();

    return products.filter((product) => {
      // Search in: Art No, Product Name, Colour, Type, Material
      return (
        product.artNo.toLowerCase().includes(lowerQuery) ||
        product.name.toLowerCase().includes(lowerQuery) ||
        product.colour.toLowerCase().includes(lowerQuery) ||
        product.type.toLowerCase().includes(lowerQuery) ||
        product.material.toLowerCase().includes(lowerQuery)
      );
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
