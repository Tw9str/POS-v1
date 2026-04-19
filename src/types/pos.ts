// ─────────────────────────────────────────────
// Client-side data types for dashboard components
// ─────────────────────────────────────────────

export interface Product {
  id: string;
  merchantId: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  barcode: string | null;
  price: number;
  costPrice: number;
  stock: number;
  lowStockAt: number;
  unit: string;
  trackStock: boolean;
  image: string | null;
  categoryId: string;
  categoryName: string | null;
  categoryColor: string | null;
  createdAt: number;
}

export interface Category {
  id: string;
  merchantId: string;
  name: string;
  color: string | null;
  sortOrder: number;
}

export interface Customer {
  id: string;
  merchantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  totalSpent: number;
  visitCount: number;
  balance: number;
  createdAt: string | null;
}

export interface Supplier {
  id: string;
  merchantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  _orderCount?: number;
}

export interface Promotion {
  id: string;
  merchantId: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  scope: "ORDER" | "PRODUCT" | "CATEGORY";
  scopeTargetId: string | null;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerCustomer: number | null;
  stackable: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string | null;
  price: number;
  costPrice: number;
  quantity: number;
  discount: number;
}

export interface Order {
  id: string;
  merchantId: string;
  orderNumber: string;
  items: OrderItem[];
  customerId: string | null;
  customerName?: string | null;
  staffId: string | null;
  staffName?: string | null;
  paymentMethod: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  creditAmount: number;
  changeAmount: number;
  paymentStatus: string;
  status?: string;
  notes: string | null;
  createdAt: number;
}
