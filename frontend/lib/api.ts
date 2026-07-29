// API client wrapper for the shoe store inventory system
// Preserves all existing endpoints without modification

const API_BASE = '/api';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
      };
    };
  }
}

export interface InventoryItem {
  size: number;
  quantity: number;
}

export interface BoxStockItem {
  id: number;
  sizeRange: string;
  quantity: number;
}

export interface ProductImage {
  name?: string;
  path?: string;
  type?: string;
  data?: string;
  tempId?: string;
  uploading?: boolean;
  error?: string;
}

export interface Product {
  id?: number;
  variantId?: number;
  artNo: string;
  name: string;
  type: string;
  seasons: string[];
  colour: string;
  material: string;
  price: number;
  landingPrice: number | null;
  inventory: InventoryItem[];
  boxStock?: BoxStockItem[];
  box_quantity?: number;
  images: ProductImage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Metadata {
  types: string[];
  seasons: string[];
  colours: string[];
  materials: string[];
}

export interface ProductVariantLookup {
  productId: number;
  variantId: number;
  colour: string;
  material: string;
  quantity: number;
}

export interface ProductLookup {
  product: Pick<Product, 'id' | 'artNo' | 'name' | 'type' | 'seasons' | 'landingPrice' | 'price'>;
  colours: string[];
  materials: string[];
  variants: ProductVariantLookup[];
}

// New sold-product feature code starts.
export type SoldProductPayload =
  | {
      sale_type?: 'pair';
      art_no: string;
      colour_name: string;
      material_type: string;
      size: string;
      sold_price: number;
      quantity: number;
      open_box_if_needed?: boolean;
    }
  | {
      sale_type: 'box';
      art_no: string;
      colour_name: string;
      material_type: string;
      quantity: number;
      pair_price: number;
      box_price: number;
      box_stock_id?: number;
    };

export interface SoldProductResponse {
  success: boolean;
  message: string;
  remaining_quantity: number;
  opened_box?: boolean;
}

export class APIError extends Error {
  status: number;
  data: any;
  requiresBoxOpen: boolean;

  constructor(message: string, status: number, data: any = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
    this.requiresBoxOpen = Boolean(data?.requiresBoxOpen);
  }
}

export interface SoldProductAnalyticsItem {
  id: string;
  saleType?: 'pair' | 'box';
  artNo: string;
  name: string;
  colour: string;
  material: string;
  type: string;
  size: string;
  quantity: number;
  soldPrice: number;
  landingPrice: number | null;
  soldAt: string;
  soldBy?: string;
  imagePath?: string;
  isCancelled?: boolean;
}

export interface SoldProductsAnalyticsResponse {
  date: string;
  viewer?: {
    canViewLandingPrice: boolean;
  };
  items: SoldProductAnalyticsItem[];
}

export interface CancelSoldProductResponse {
  id: string;
  isCancelled: boolean;
  restoredQuantity: number;
}

export interface PriceUpdatePayload {
  artNo: string;
  landingPriceUpdate?: number;
  sellingPrice?: number;
}

export interface PriceUpdateResponse {
  artNo: string;
  updatedVariants: number;
  lookup?: ProductLookup | null;
}

export interface OpenBoxStockResponse {
  opened: {
    productVariantId: number;
    productId: number;
    remainingQuantity: number;
    inventory: InventoryItem[];
  };
  product: Product | null;
}

export interface AuthSession {
  user: {
    id: number;
    fname: string;
    lname: string;
    phoneNumber: string;
    role: string;
  };
  store: {
    id: number;
    storeName: string;
    storeRole: string;
  } | null;
}
// New sold-product feature code ends.

export interface APIResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

class APIClient {
  private baseUrl: string;
  private assetBaseUrl: string;

  constructor() {
    this.baseUrl = API_BASE.replace(/\/$/, '');
    this.assetBaseUrl = this.getAssetBaseUrl(this.baseUrl);
  }

  private getAssetBaseUrl(baseUrl: string): string {
    if (!/^https?:\/\//i.test(baseUrl)) return '';

    try {
      const url = new URL(baseUrl);
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    } catch (_error) {
      return '';
    }
  }

  private normalizeProduct(product: Product): Product {
    return {
      ...product,
      landingPrice: product.landingPrice === null ? null : Number(product.landingPrice || 0),
      inventory: (product.inventory || []).map((item) => ({
        size: Number(item.size),
        quantity: Number(item.quantity || 0),
      })),
      boxStock: (product.boxStock || []).map((item) => ({
        id: Number(item.id),
        sizeRange: String(item.sizeRange || ''),
        quantity: Number(item.quantity || 0),
      })),
      images: (product.images || []).map((image) => ({
        ...image,
        path:
          image.path && image.path.startsWith('/') && this.assetBaseUrl
            ? `${this.assetBaseUrl}${image.path}`
            : image.path,
      })),
    };
  }

  // New sold-product analytics code starts.
  private normalizeSoldProduct(item: SoldProductAnalyticsItem): SoldProductAnalyticsItem {
    return {
      ...item,
      quantity: Number(item.quantity || 0),
      soldPrice: Number(item.soldPrice || 0),
      landingPrice: item.landingPrice === null ? null : Number(item.landingPrice || 0),
      isCancelled: Boolean(item.isCancelled),
      imagePath:
        item.imagePath && item.imagePath.startsWith('/') && this.assetBaseUrl
          ? `${this.assetBaseUrl}${item.imagePath}`
          : item.imagePath,
    };
  }
  // New sold-product analytics code ends.

  private async request<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const telegramInitData =
      typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '';

    if (telegramInitData) {
      (options.headers as Record<string, string>)['X-Telegram-Init-Data'] = telegramInitData;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const error = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : { message: await response.text().catch(() => '') };
      throw new APIError(
        error.error || error.message || `API Error: ${response.statusText || response.status}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  async getHealth(): Promise<any> {
    return this.request('GET', '/health');
  }

  async getMetadata(): Promise<Metadata> {
    const response = await this.request<{ data: Metadata }>('GET', '/meta');
    return response.data || { types: [], seasons: [], colours: [], materials: [] };
  }

  async getAuthSession(): Promise<AuthSession> {
    return this.request('GET', '/auth/me');
  }

  async getProducts(): Promise<Product[]> {
    const response = await this.request<{ data: Product[] }>('GET', '/products');
    return (response.data || []).map((product) => this.normalizeProduct(product));
  }

  async getProduct(id: number): Promise<Product> {
    const response = await this.request<{ data: Product }>('GET', `/products/${id}`);
    return this.normalizeProduct(response.data || ({} as Product));
  }

  async lookupProductByArtNo(artNo: string): Promise<ProductLookup | null> {
    const params = new URLSearchParams({ artNo });
    const response = await this.request<{ data: ProductLookup | null }>(
      'GET',
      `/products/lookup?${params}`
    );
    return response.data || null;
  }

  async uploadTempProductImage(file: File): Promise<ProductImage> {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Rasm faylini o\'qib bo\'lmadi'));
      reader.readAsDataURL(file);
    });

    const response = await this.request<{ data: { tempId: string; path: string } }>(
      'POST',
      '/uploads/temp',
      {
        image: {
          name: file.name,
          type: file.type,
          data,
        },
      }
    );

    return {
      name: file.name,
      type: file.type,
      tempId: response.data.tempId,
      path: response.data.path,
    };
  }

  async deleteTempProductImage(tempId: string): Promise<void> {
    await this.request('DELETE', `/uploads/temp/${encodeURIComponent(tempId)}`);
  }

  async createProduct(product: Product): Promise<Product> {
    const response = await this.request<{ data: Product }>('POST', '/products', product);
    return this.normalizeProduct(response.data || ({} as Product));
  }

  async updateProduct(id: number, product: Product): Promise<Product> {
    const response = await this.request<{ data: Product }>('PUT', `/products/${id}`, product);
    return this.normalizeProduct(response.data || ({} as Product));
  }

  async deleteProduct(id: number): Promise<any> {
    return this.request('DELETE', `/products/${id}`);
  }

  async updateProductPrices(payload: PriceUpdatePayload): Promise<PriceUpdateResponse> {
    const response = await this.request<{ data: PriceUpdateResponse }>('POST', '/products/prices', payload);
    return response.data;
  }

  async openBoxStock(boxStockId: number): Promise<OpenBoxStockResponse> {
    const response = await this.request<{ data: OpenBoxStockResponse }>(
      'POST',
      `/box-stock/${boxStockId}/open`
    );

    return {
      ...response.data,
      product: response.data?.product ? this.normalizeProduct(response.data.product) : null,
    };
  }

  // New sold-product feature code starts.
  async markProductSold(payload: SoldProductPayload): Promise<SoldProductResponse> {
    return this.request('POST', '/inventory/sold', payload);
  }

  async getSoldProducts(date?: string): Promise<SoldProductsAnalyticsResponse> {
    const params = date ? `?${new URLSearchParams({ date })}` : '';
    const response = await this.request<{ data: SoldProductsAnalyticsResponse }>(
      'GET',
      `/sold-products${params}`
    );

    return {
      date: response.data?.date || date || '',
      viewer: response.data?.viewer,
      items: (response.data?.items || []).map((item) => this.normalizeSoldProduct(item)),
    };
  }

  async cancelSoldProduct(id: string): Promise<CancelSoldProductResponse> {
    const response = await this.request<{ data: CancelSoldProductResponse }>(
      'POST',
      `/sold-products/${encodeURIComponent(id)}/cancel`
    );
    return response.data;
  }
  // New sold-product feature code ends.

  async matchProduct(
    artNo: string,
    colour: string,
    material: string
  ): Promise<Product[]> {
    const params = new URLSearchParams({
      artNo,
      colour,
      material,
    });
    const response = await this.request<{ data: Product[] }>(
      'GET',
      `/products/match?${params}`
    );
    return (response.data || []).map((product) => this.normalizeProduct(product));
  }
}

export const api = new APIClient();
