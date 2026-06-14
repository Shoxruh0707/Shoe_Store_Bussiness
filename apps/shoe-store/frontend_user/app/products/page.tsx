'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProducts, type StoreProduct } from '@/lib/store-api';
import ProductCard from '@/components/product-card';

export default function ProductsPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedCategory(params.get('category') || '');
    setSelectedSeason(params.get('season') || '');
    setInStockOnly(params.get('stock') === 'in');

    getProducts()
      .then((items) => {
        setProducts(items);
        const maxPrice = Math.max(1000, ...items.map((product) => Number(product.price) || 0));
        setPriceRange([0, Math.ceil(maxPrice)]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products]
  );
  const colors = useMemo(
    () => Array.from(new Set(products.map((product) => product.color).filter(Boolean))).sort(),
    [products]
  );
  const sizes = useMemo(
    () => Array.from(new Set(products.flatMap((product) => product.sizes))).sort((a, b) => Number(a) - Number(b)),
    [products]
  );
  const seasons = useMemo(
    () => Array.from(new Set(products.map((product) => product.season).filter(Boolean) as string[])).sort(),
    [products]
  );
  const maxPrice = Math.max(1000, ...products.map((product) => Number(product.price) || 0));

  const filteredProducts = products.filter((product) => {
    const query = searchTerm.trim().toLowerCase();
    if (
      query &&
      ![product.name, product.artNo, product.brand, product.type, product.color]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    ) {
      return false;
    }
    if (selectedCategory && product.category.toLowerCase() !== selectedCategory.toLowerCase()) return false;
    if (selectedColor && product.color.toLowerCase() !== selectedColor.toLowerCase()) return false;
    if (selectedSize && !product.sizes.includes(selectedSize)) return false;
    if (selectedSeason && product.season?.toLowerCase() !== selectedSeason.toLowerCase()) return false;
    if (inStockOnly && !product.inStock) return false;
    if (product.price < priceRange[0] || product.price > priceRange[1]) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'price-low') return Number(a.price) - Number(b.price);
    if (sortBy === 'price-high') return Number(b.price) - Number(a.price);
    if (sortBy === 'stock') return Number(b.stockQuantity) - Number(a.stockQuantity);
    return Number(b.id) - Number(a.id);
  });

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedColor('');
    setSelectedSize('');
    setSelectedSeason('');
    setInStockOnly(false);
    setSortBy('newest');
    setPriceRange([0, Math.ceil(maxPrice)]);
  };

  const filterPanel = (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Filters</h3>

      <div>
        <h4 className="font-semibold mb-3 text-foreground">Type</h4>
        <div className="space-y-2">
          {categories.map((cat) => (
            <label key={cat} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCategory === cat}
                onChange={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                className="rounded"
              />
              <span className="text-sm text-foreground">{cat}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-3 text-foreground">Colour</h4>
        <div className="space-y-2">
          {colors.map((color) => (
            <label key={color} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedColor === color}
                onChange={() => setSelectedColor(selectedColor === color ? '' : color)}
                className="rounded"
              />
              <span className="text-sm text-foreground">{color}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-3 text-foreground">Size</h4>
        <div className="grid grid-cols-2 gap-2">
          {sizes.map((size) => (
            <label key={size} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedSize === size}
                onChange={() => setSelectedSize(selectedSize === size ? '' : size)}
                className="rounded"
              />
              <span className="text-sm text-foreground">{size}</span>
            </label>
          ))}
        </div>
      </div>

      {seasons.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 text-foreground">Season</h4>
          <div className="space-y-2">
            {seasons.map((season) => (
              <label key={season} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSeason.toLowerCase() === season.toLowerCase()}
                  onChange={() => setSelectedSeason(selectedSeason.toLowerCase() === season.toLowerCase() ? '' : season)}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{season}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="font-semibold mb-3 text-foreground">Price Range</h4>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max={Math.ceil(maxPrice)}
            value={priceRange[1]}
            onChange={(event) => setPriceRange([0, Number(event.target.value)])}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">
            0 - {priceRange[1].toLocaleString()}
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={() => setInStockOnly(!inStockOnly)}
          className="rounded"
        />
        <span className="text-sm text-foreground">In stock only</span>
      </label>

      <Button variant="outline" className="w-full" onClick={clearFilters}>
        Clear Filters
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <div className="flex flex-1">
        <aside className="hidden lg:block w-64 bg-card border-r border-border p-6 overflow-y-auto">
          {filterPanel}
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="lg:hidden flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Products</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="lg:hidden mb-6 bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Filters</h3>
                <button onClick={() => setShowFilters(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              {filterPanel}
            </div>
          )}

          <div className="mb-6 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="hidden text-3xl font-bold lg:block">Products</h1>
                <p className="text-muted-foreground">
                  {isLoading ? 'Loading products...' : `${filteredProducts.length} items found`}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative block min-w-0 sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search shoes, brand, art no"
                    className="h-11 w-full rounded border border-border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>

                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="h-11 rounded border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                  <option value="stock">Most stock</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded border border-destructive/30 bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                {isLoading ? 'Loading products...' : 'No products found.'}
              </p>
              {!isLoading && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
