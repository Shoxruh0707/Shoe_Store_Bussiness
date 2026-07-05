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

export interface ProductImage {
  name?: string;
  path?: string;
  type?: string;
  data?: string;
}

export interface Product {
  id?: number;
  artNo: string;
  name: string;
  type: string;
  seasons: string[];
  colour: string;
  material: string;
  price: number;
  landingPrice: number;
  inventory: InventoryItem[];
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
      inventory: (product.inventory || []).map((item) => ({
        size: Number(item.size),
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
      throw new Error(error.error || error.message || `API Error: ${response.statusText || response.status}`);
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
