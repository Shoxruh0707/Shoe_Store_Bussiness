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
  landingPrice?: number;
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

// New sold-product feature code starts.
export interface SoldProductPayload {
  art_no: string;
  colour_name: string;
  material_type: string;
  size: string;
  sold_price: number;
  quantity: number;
}

export interface SoldProductResponse {
  success: boolean;
  message: string;
  remaining_quantity: number;
}

export interface SoldProductAnalyticsItem {
  id: string | number;
  artNo: string;
  name: string;
  colour: string;
  material: string;
  size: string;
  quantity?: number;
  soldPrice?: number;
  landingPrice?: number;
  sellerName?: string;
  soldAt: string;
  imagePath?: string;
}

export interface SoldProductsAnalyticsResponse {
  date: string;
  items: SoldProductAnalyticsItem[];
}
// New sold-product feature code ends.

export interface APIResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface AuthMe {
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
    storeRole?: 'owner' | 'manager' | 'staff';
  } | null;
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
      ...(product.landingPrice === undefined ? {} : { landingPrice: Number(product.landingPrice || 0) }),
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

  // New sold-product analytics code starts.
  private normalizeSoldProduct(item: SoldProductAnalyticsItem): SoldProductAnalyticsItem {
    return {
      ...item,
      ...(item.quantity === undefined ? {} : { quantity: Number(item.quantity || 0) }),
      ...(item.soldPrice === undefined ? {} : { soldPrice: Number(item.soldPrice || 0) }),
      ...(item.landingPrice === undefined ? {} : { landingPrice: Number(item.landingPrice || 0) }),
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
      throw new Error(error.error || error.message || `API xatosi: ${response.statusText || response.status}`);
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

  async getAuthMe(): Promise<AuthMe> {
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
      reader.onerror = () => reject(new Error('Rasm faylini o\'qishda xatolik'));
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
      items: (response.data?.items || []).map((item) => this.normalizeSoldProduct(item)),
    };
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
