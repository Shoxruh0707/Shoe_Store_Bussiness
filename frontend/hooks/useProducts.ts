import { useState, useCallback, useEffect } from 'react';
import { api, Product, Metadata, SoldProductPayload, SoldProductResponse } from '@/lib/api';

function productRowKey(product: Product): string {
  return product.variantId ? `variant-${product.variantId}` : `product-${product.id}`;
}

export interface UseProductsReturn {
  products: Product[];
  metadata: Metadata;
  loading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  fetchMetadata: () => Promise<void>;
  createProduct: (product: Product) => Promise<Product | null>;
  updateProduct: (id: number, product: Product) => Promise<Product | null>;
  deleteProduct: (id: number) => Promise<boolean>;
  markProductSold: (payload: SoldProductPayload) => Promise<SoldProductResponse>;
  getTotalStock: () => number;
  getLowStockCount: () => number;
  getOutOfStockCount: () => number;
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [metadata, setMetadata] = useState<Metadata>({
    types: [],
    seasons: [],
    colours: [],
    materials: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProducts();
      setProducts(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(message);
      console.error('[v0] Failed to fetch products:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMetadata = useCallback(async () => {
    try {
      const data = await api.getMetadata();
      setMetadata(data);
    } catch (err) {
      console.error('[v0] Failed to fetch metadata:', err);
    }
  }, []);

  const createProduct = useCallback(async (product: Product): Promise<Product | null> => {
    try {
      const newProduct = await api.createProduct(product);
      setProducts((prev) => {
        const newKey = productRowKey(newProduct);
        const existingIndex = prev.findIndex((item) => productRowKey(item) === newKey);
        if (existingIndex === -1) return [...prev, newProduct];

        return prev.map((item, index) => (index === existingIndex ? newProduct : item));
      });
      return newProduct;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create product';
      setError(message);
      console.error('[v0] Failed to create product:', message);
      return null;
    }
  }, []);

  const updateProduct = useCallback(
    async (id: number, product: Product): Promise<Product | null> => {
      try {
        const updated = await api.updateProduct(id, product);
        const updatedKey = productRowKey(updated);
        setProducts((prev) =>
          prev.map((p) => (productRowKey(p) === updatedKey || (!updated.variantId && p.id === id) ? updated : p))
        );
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update product';
        setError(message);
        console.error('[v0] Failed to update product:', message);
        return null;
      }
    },
    []
  );

  const deleteProduct = useCallback(async (id: number): Promise<boolean> => {
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete product';
      setError(message);
      console.error('[v0] Failed to delete product:', message);
      return false;
    }
  }, []);

  // New sold-product feature code starts.
  const markProductSold = useCallback(
    async (payload: SoldProductPayload): Promise<SoldProductResponse> => {
      try {
        const result = await api.markProductSold(payload);
        await fetchProducts();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to mark product as sold';
        if (!(err as any)?.requiresBoxOpen) {
          setError(message);
          console.error('[v0] Failed to mark product as sold:', message);
        }
        throw err;
      }
    },
    [fetchProducts]
  );
  // New sold-product feature code ends.

  const getTotalStock = useCallback(() => {
    return products.reduce((total, product) => {
      const productTotal = product.inventory.reduce((sum, item) => sum + item.quantity, 0);
      return total + productTotal;
    }, 0);
  }, [products]);

  const getLowStockCount = useCallback(() => {
    return products.filter((product) => {
      const total = product.inventory.reduce((sum, item) => sum + item.quantity, 0);
      return total > 0 && total < 5;
    }).length;
  }, [products]);

  const getOutOfStockCount = useCallback(() => {
    return products.filter((product) => {
      const total = product.inventory.reduce((sum, item) => sum + item.quantity, 0);
      return total === 0;
    }).length;
  }, [products]);

  // Initial load
  useEffect(() => {
    fetchProducts();
    fetchMetadata();
  }, [fetchProducts, fetchMetadata]);

  return {
    products,
    metadata,
    loading,
    error,
    fetchProducts,
    fetchMetadata,
    createProduct,
    updateProduct,
    deleteProduct,
    markProductSold,
    getTotalStock,
    getLowStockCount,
    getOutOfStockCount,
  };
}
