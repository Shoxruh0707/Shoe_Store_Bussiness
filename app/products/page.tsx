'use client';

import { useState } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import Link from 'next/link';
import { Star, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  color: string[];
  size: string[];
  material: string;
  type: string;
  rating: number;
  inStock: boolean;
}

const allProducts: Product[] = [
  {
    id: '1',
    name: 'Premium Leather Sneaker',
    price: 189.99,
    originalPrice: 239.99,
    category: 'Sneakers',
    color: ['Black', 'White', 'Navy'],
    size: ['6', '7', '8', '9', '10', '11', '12', '13'],
    material: 'Leather',
    type: 'Sneaker',
    rating: 4.8,
    inStock: true,
  },
  {
    id: '2',
    name: 'Urban Casual Loafer',
    price: 159.99,
    category: 'Casual',
    color: ['Brown', 'Black', 'Tan'],
    size: ['6', '7', '8', '9', '10', '11', '12'],
    material: 'Suede',
    type: 'Loafer',
    rating: 4.7,
    inStock: true,
  },
  {
    id: '3',
    name: 'Winter Wool Boot',
    price: 249.99,
    originalPrice: 299.99,
    category: 'Winter',
    color: ['Black', 'Brown', 'Grey'],
    size: ['6', '7', '8', '9', '10', '11', '12'],
    material: 'Wool',
    type: 'Boot',
    rating: 4.9,
    inStock: true,
  },
  {
    id: '4',
    name: 'Summer Canvas Slip-On',
    price: 89.99,
    category: 'Summer',
    color: ['White', 'Blue', 'Red'],
    size: ['5', '6', '7', '8', '9', '10', '11'],
    material: 'Canvas',
    type: 'Slip-on',
    rating: 4.6,
    inStock: true,
  },
  {
    id: '5',
    name: 'Kids Colorful Sneaker',
    price: 69.99,
    category: 'Kids',
    color: ['Rainbow', 'Pink', 'Blue'],
    size: ['1', '2', '3', '4', '5', '6'],
    material: 'Canvas',
    type: 'Sneaker',
    rating: 4.5,
    inStock: true,
  },
  {
    id: '6',
    name: 'Athletic Running Shoe',
    price: 179.99,
    category: 'Sneakers',
    color: ['Black', 'White', 'Red'],
    size: ['6', '7', '8', '9', '10', '11', '12', '13'],
    material: 'Mesh',
    type: 'Running',
    rating: 4.7,
    inStock: true,
  },
];

export default function ProductsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 300]);
  const [showFilters, setShowFilters] = useState(false);

  const filteredProducts = allProducts.filter((product) => {
    let matches = true;

    if (selectedCategory && product.category.toLowerCase() !== selectedCategory.toLowerCase()) {
      matches = false;
    }

    if (selectedColor && !product.color.some(c => c.toLowerCase().includes(selectedColor.toLowerCase()))) {
      matches = false;
    }

    if (selectedSize && !product.size.includes(selectedSize)) {
      matches = false;
    }

    if (product.price < priceRange[0] || product.price > priceRange[1]) {
      matches = false;
    }

    return matches;
  });

  const categories = ['Sneakers', 'Casual', 'Winter', 'Summer', 'Kids'];
  const colors = ['Black', 'White', 'Brown', 'Navy', 'Grey', 'Red', 'Blue'];
  const sizes = ['5', '6', '7', '8', '9', '10', '11', '12', '13'];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <div className="flex flex-1">
        {/* Sidebar Filters - Desktop */}
        <aside className="hidden lg:block w-64 bg-card border-r border-border p-6 overflow-y-auto">
          <div className="space-y-6">
            <h3 className="text-lg font-bold">Filters</h3>

            {/* Category Filter */}
            <div>
              <h4 className="font-semibold mb-3 text-foreground">Category</h4>
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

            {/* Color Filter */}
            <div>
              <h4 className="font-semibold mb-3 text-foreground">Color</h4>
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

            {/* Size Filter */}
            <div>
              <h4 className="font-semibold mb-3 text-foreground">Size</h4>
              <div className="space-y-2">
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

            {/* Price Filter */}
            <div>
              <h4 className="font-semibold mb-3 text-foreground">Price Range</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="300"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([parseInt(e.target.value), priceRange[1]])}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="300"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="w-full"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  ${priceRange[0]} - ${priceRange[1]}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSelectedCategory('');
                setSelectedColor('');
                setSelectedSize('');
                setPriceRange([0, 300]);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* Mobile Filter Toggle */}
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

          {/* Mobile Filters Modal */}
          {showFilters && (
            <div className="lg:hidden mb-6 bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Filters</h3>
                <button onClick={() => setShowFilters(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Category */}
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Category</h4>
                <div className="space-y-1">
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

              {/* Color */}
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Color</h4>
                <div className="space-y-1">
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

              {/* Size */}
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Size</h4>
                <div className="space-y-1">
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

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedCategory('');
                  setSelectedColor('');
                  setSelectedSize('');
                  setPriceRange([0, 300]);
                  setShowFilters(false);
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Products Grid */}
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h1 className="hidden lg:block text-3xl font-bold">Products</h1>
              <p className="text-muted-foreground">
                {filteredProducts.length} items found
              </p>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <Link key={product.id} href={`/products/${product.id}`}>
                    <div className="group cursor-pointer">
                      <div className="bg-muted rounded-lg aspect-square overflow-hidden mb-4 relative group-hover:shadow-lg transition-shadow">
                        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted flex items-center justify-center group-hover:to-accent/10 transition-colors">
                          <span className="text-muted-foreground font-medium">[Product Image]</span>
                        </div>
                        {product.originalPrice && (
                          <div className="absolute top-4 right-4 bg-accent text-accent-foreground px-3 py-1 rounded text-sm font-semibold">
                            Sale
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-accent text-accent" />
                            <span className="text-sm text-muted-foreground">{product.rating}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{product.type}</p>

                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-foreground">
                            ${product.price.toFixed(2)}
                          </span>
                          {product.originalPrice && (
                            <span className="text-sm text-muted-foreground line-through">
                              ${product.originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="pt-2">
                          <span
                            className={`text-sm font-medium ${
                              product.inStock ? 'text-green-600' : 'text-destructive'
                            }`}
                          >
                            {product.inStock ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                  No products found matching your filters.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setSelectedCategory('');
                    setSelectedColor('');
                    setSelectedSize('');
                    setPriceRange([0, 300]);
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
