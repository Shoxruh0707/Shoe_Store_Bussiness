// Constants for the inventory system

export const SHOE_SIZES = [33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44] as const;

export const STOCK_STATUS = {
  IN_STOCK: 'in-stock',
  LOW_STOCK: 'low-stock',
  OUT_OF_STOCK: 'out-of-stock',
} as const;

export const LOW_STOCK_THRESHOLD = 5;

export type SizeType = (typeof SHOE_SIZES)[number];
export type StockStatus = (typeof STOCK_STATUS)[keyof typeof STOCK_STATUS];
