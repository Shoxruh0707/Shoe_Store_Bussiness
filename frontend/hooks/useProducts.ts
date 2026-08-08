import { useState, useCallback, useEffect } from 'react';
import { api, Product, Metadata, PriceUpdatePayload, SoldProductPayload, SoldProductResponse } from '@/lib/api';

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
  updatePairInventory: (id: number, variantId: number | undefined, inventory: Product['inventory']) => Promise<Product | null>;
  updateBoxStock: (id: number, variantId: number | undefined, boxes: NonNullable<Product['boxStock']>) => Promise<Product | null>;
  cancelStockAddition: (id: number) => Promise<Product | null>;
  updateProductPrices: (payload: PriceUpdatePayload) => Promise<boolean>;
  openBoxStock: (boxStockId: number) => Promise<Product | null>;
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
      const message = err instanceof Error ? err.message : 'Mahsulotlarni yuklab bo\'lmadi';
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
      const message = err instanceof Error ? err.message : 'Mahsulotni yaratib bo\'lmadi';
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
        const message = err instanceof Error ? err.message : 'Mahsulotni yangilab bo\'lmadi';
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
      const message = err instanceof Error ? err.message : 'Mahsulotni o\'chirib bo\'lmadi';
      setError(message);
      console.error('[v0] Failed to delete product:', message);
      return false;
    }
  }, []);

  const updateProductPrices = useCallback(
    async (payload: PriceUpdatePayload): Promise<boolean> => {
      try {
        await api.updateProductPrices(payload);
        await fetchProducts();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Narxlarni yangilab bo\'lmadi';
        setError(message);
        console.error('[v0] Failed to update product prices:', message);
        return false;
      }
    },
    [fetchProducts]
  );

  const replaceProductInState = useCallback((updated: Product, fallbackId?: number) => {
    const updatedKey = productRowKey(updated);
    setProducts((prev) =>
      prev.map((product) =>
        productRowKey(product) === updatedKey || (!updated.variantId && fallbackId && product.id === fallbackId)
          ? updated
          : product
      )
    );
  }, []);

  const updatePairInventory = useCallback(
    async (id: number, variantId: number | undefined, inventory: Product['inventory']): Promise<Product | null> => {
      try {
        const updated = await api.updatePairInventory(id, variantId, inventory);
        replaceProductInState(updated, id);
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Juft inventarini yangilab bo\'lmadi';
        setError(message);
        console.error('[v0] Failed to update pair inventory:', message);
        return null;
      }
    },
    [replaceProductInState]
  );

  const updateBoxStock = useCallback(
    async (id: number, variantId: number | undefined, boxes: NonNullable<Product['boxStock']>): Promise<Product | null> => {
      try {
        const updated = await api.updateBoxStock(id, variantId, boxes);
        replaceProductInState(updated, id);
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Quti zaxirasini yangilab bo\'lmadi';
        setError(message);
        console.error('[v0] Failed to update box stock:', message);
        return null;
      }
    },
    [replaceProductInState]
  );

  const cancelStockAddition = useCallback(
    async (id: number): Promise<Product | null> => {
      try {
        const result = await api.cancelStockAddition(id);
        if (!result.product) {
          await fetchProducts();
          return null;
        }
        replaceProductInState(result.product);
        return result.product;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Qo\'shilgan zaxirani bekor qilib bo\'lmadi';
        setError(message);
        console.error('[v0] Failed to cancel stock addition:', message);
        return null;
      }
    },
    [fetchProducts, replaceProductInState]
  );

  const openBoxStock = useCallback(
    async (boxStockId: number): Promise<Product | null> => {
      try {
        const result = await api.openBoxStock(boxStockId);
        const updatedProduct = result.product;

        if (!updatedProduct) {
          await fetchProducts();
          return null;
        }

        const updatedKey = productRowKey(updatedProduct);
        setProducts((prev) => prev.map((product) => (productRowKey(product) === updatedKey ? updatedProduct : product)));
        return updatedProduct;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Qutini ochib bo\'lmadi';
        setError(message);
        console.error('[v0] Failed to open box stock:', message);
        throw err;
      }
    },
    [fetchProducts]
  );

  // New sold-product feature code starts.
  const markProductSold = useCallback(
    async (payload: SoldProductPayload): Promise<SoldProductResponse> => {
      try {
        const result = await api.markProductSold(payload);
        await fetchProducts();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Mahsulotni sotilgan deb belgilab bo\'lmadi';
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
    updatePairInventory,
    updateBoxStock,
    cancelStockAddition,
    updateProductPrices,
    openBoxStock,
    deleteProduct,
    markProductSold,
    getTotalStock,
    getLowStockCount,
    getOutOfStockCount,
  };
}
