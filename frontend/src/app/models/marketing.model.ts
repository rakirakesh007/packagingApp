export type MarketingTemplateCategory = 'follow_up' | 'offer' | 'festival' | 'payment' | 'general';

export interface MarketingTemplate {
  _id: string;
  title: string;
  category: MarketingTemplateCategory;
  body: string;
  isActive: boolean;
  usageCount: number;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingShop {
  shopId: string;
  name: string;
  mobile: string;
  address: string;
  totalOrdersCount: number;
  monthlySalesCount: number;
  monthlySalesTotal: number;
  lastOrderAt?: string | null;
}

export interface MarketingOverview {
  month: number;
  year: number;
  totals: {
    totalShops: number;
    activeShops: number;
    totalBroadcastTargets: number;
    totalMonthlySales: number;
  };
  templates: MarketingTemplate[];
  shops: MarketingShop[];
}
