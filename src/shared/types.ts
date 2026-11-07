export type CategoryId =
  | 'car'
  | 'color'
  | 'body'
  | 'wheels'
  | 'garage'
  | 'decor'
  | 'helmet'
  | 'suit'
  | 'plate'
  | 'decal'
  | 'underglow'
  | 'trail'
  | 'profile'
  | 'bundle'
  | 'windowTint';
export interface Product {
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  price: number;
  color: string;
  variant: number;
  stats?: { speed: number; acceleration: number; handling: number };
  bundle?: string[];
}
export interface User {
  id: string;
  login: string;
  balance: number;
  owned: string[];
  equipped: Record<string, string>;
}
export type PaymentMode = 'arco' | 'disabled';
export type PaymentMethod = 'card' | 'sbp';
export type PaymentStatus = 'pending' | 'success' | 'failed';
export interface Topup {
  id: string;
  date: string;
  method: PaymentMethod;
  rub: number;
  fapix: number;
  status: PaymentStatus;
}
export interface Purchase {
  id: string;
  date: string;
  name: string;
  fapix: number;
  status: 'success';
}
export interface CatalogResponse {
  products: Product[];
  categories: { id: CategoryId; name: string }[];
  popularIds: string[];
}
export interface SessionResponse {
  user: User | null;
  paymentMode: PaymentMode;
}
