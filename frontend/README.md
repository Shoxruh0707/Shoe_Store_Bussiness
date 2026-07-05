# Shoe Store Inventory Management System

A professional, modern inventory management dashboard for shoe stores built with Next.js 15 and React 19.

## Overview

This is a complete redesign of a functional shoe store inventory system, transforming it from a "vibe coded" application into a modern SaaS-style dashboard featuring:

- Professional dashboard with summary statistics
- Real-time product inventory table with search functionality
- Product detail drawer with image gallery
- Multi-step product creation/editing modal
- Size-based inventory management (sizes 33-44)
- Responsive mobile-first design
- Clean, accessible UI following modern design patterns

## Features

### Dashboard Summary
- **Total Products**: Count of all products in inventory
- **Total Stock**: Sum of all inventory across all sizes
- **Low Stock Alert**: Products with less than 5 units
- **Out of Stock Alert**: Products with zero inventory

### Product Listing
- Professional data table (desktop) / card layout (mobile)
- Display: Image, Art Number, Product Name, Type, Colour, Price, Total Stock, Status
- Real-time search across: Art Number, Product Name, Colour, Type, Material
- Color-coded status badges (In Stock, Low Stock, Out of Stock)
- Quick action buttons: View, Edit, Delete

### Product Details Drawer
- Slides in from the right (full-screen on mobile)
- Image gallery with thumbnail navigation
- Complete product information display
- Pricing breakdown (Selling Price / Landing Price / Margin)
- Size inventory table with status indicators
- Edit and Delete buttons

### Add/Edit Product Modal
- **Multi-step form** (5 steps) reduces cognitive load:
  1. **Basic Info**: Art Number, Product Name, Type, Seasons
  2. **Details**: Colour, Material
  3. **Pricing**: Selling Price, Landing Price (with margin calculation)
  4. **Images**: Drag-and-drop upload with preview
  5. **Inventory**: Size quantity selectors (33-44) with +/- buttons
- Progress indicator shows current step
- All fields remember values when navigating between steps
- Unsaved changes warning on close

### Stock Management
- Clear visual indicators of inventory levels
- Color-coded status (green/yellow/red)
- Size-by-size inventory breakdown
- Total stock summary

## Architecture

### Tech Stack
- **Framework**: Next.js 16 with React 19
- **Styling**: Tailwind CSS v4
- **State Management**: React Context + Hooks
- **API**: Express backend proxied through Next rewrites
- **Icons**: Lucide React
- **Language**: TypeScript

### Project Structure

```
/app
  /inventory
    page.tsx                     # Main inventory page
  layout.tsx                     # Root layout
  page.tsx                       # Redirect to inventory

/components
  /inventory
    DashboardCards.tsx          # Summary statistics
    ProductTable.tsx            # Data table + search
    ProductDrawer.tsx           # Side detail view
    AddProductModal.tsx         # Multi-step product form

/hooks
  useProducts.ts                # Product data management
  useSearch.ts                  # Search filtering

/lib
  api.ts                        # API client wrapper
  constants.ts                  # Shoe sizes, status enums
  utils.ts                      # Utility functions
```

## API Integration

### Endpoints
All endpoints follow REST conventions and are compatible with your backend:

- `GET /api/meta` - Get metadata (types, seasons, colours, materials)
- `GET /api/products` - List all products
- `GET /api/products/[id]` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Delete product

### Configuration
Set the backend API URL for the Next proxy:
```env
BACKEND_API_URL=http://localhost:3000/api
```

In development, browser requests to `/api/*` are rewritten to the Express backend. On the backend, keep Telegram auth enabled for production; for local browser-only testing you can set `API_AUTH_REQUIRED=false`.

## Responsive Design

### Mobile (< 640px)
- Full-screen modals and drawers
- Card-based product listing (no table)
- Touch-friendly 44x44px buttons
- Single column layout

### Tablet (640px - 1024px)
- Responsive table with adjusted columns
- Side-by-side layout elements
- Medium-sized cards

### Desktop (> 1024px)
- Full data table with all columns
- Side drawer for details
- Full dashboard experience

## Design System

### Colors
- **Primary**: Blue (#1267c4) - Brand actions and highlights
- **Success**: Green - In stock status
- **Warning**: Amber - Low stock alerts
- **Danger**: Red - Out of stock
- **Neutral**: Gray scale - Text, borders, backgrounds

### Typography
- **Headings**: Bold, clear hierarchy
- **Body**: 0.95rem, line-height 1.4-1.6
- **Font**: System UI fonts (no external CDN)

### Spacing & Sizing
- 4px base unit
- Touch targets: minimum 44x44px
- Rounded corners: 0.625rem (10px)

## Key UX Improvements

✓ **Fast Inventory Lookup** - Prominent search, real-time results
✓ **Easy Stock Management** - Clear size-quantity tables, quick +/- buttons
✓ **Quick Product Editing** - One-click edit from table, preserves context
✓ **Clear Visual Hierarchy** - Art No bold and prominent, status color-coded
✓ **Mobile-First** - Works great on phones, tablets, and desktops
✓ **Professional Appearance** - Inspired by Shopify, Stripe, Vercel dashboards

## Development

### Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Start the dev server:
```bash
npm run dev
```

3. Open http://localhost:3001/inventory in your browser

### Building for Production

```bash
pnpm build
pnpm start
```

## Data Management

### Connecting to Your Backend
1. Start the Express backend from the repo root with `npm run dev`
2. Start this Next frontend with `npm run dev`
3. Ensure `BACKEND_API_URL` points to the backend API if it is not running on `http://localhost:3000/api`

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile: iOS 12+, Android 9+

## Performance

- First page load: < 2 seconds
- Search results: Real-time (< 200ms)
- Image optimization: Unsplash CDN
- No external CDN dependencies
- Telegram Web App compatible

## Accessibility

- WCAG 2.1 AA compliant
- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Focus states for all interactive elements
- Color contrast ratios > 4.5:1

## Future Enhancements

- [ ] Batch operations (update multiple products)
- [ ] Export to CSV/Excel
- [ ] Inventory history/audit log
- [ ] Barcode scanning
- [ ] Low stock notifications
- [ ] Multi-warehouse support
- [ ] Role-based access control
- [ ] Dark mode toggle

## License

Proprietary - Shoe Store Inventory System

## Support

For issues or questions about the redesign, please refer to the original design specification in `/v0_plans/swift-spec.md`.
