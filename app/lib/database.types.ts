export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderAddon = {
  id: number;
  name: string;
  price_cents: number;
};

export type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  unit_price_cents: number;
  addons?: OrderAddon[];
  special_sauce?: boolean;
  note?: string | null;
};

export type SaleOrder = {
  id: number;
  user_id: string;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string;
  items: OrderItem[];
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  status: OrderStatus;
  created_at: string;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      menu_catalog: {
        Row: {
          id: number;
          name: string;
          price_cents: number;
          available: boolean;
          description: string;
          category: string;
          image: string;
          old_price_cents: number | null;
          badge: string | null;
          highlighted: boolean;
        };
        Insert: {
          id: number;
          name: string;
          price_cents: number;
          available?: boolean;
          description?: string;
          category?: string;
          image?: string;
          old_price_cents?: number | null;
          badge?: string | null;
          highlighted?: boolean;
        };
        Update: {
          id?: number;
          name?: string;
          price_cents?: number;
          available?: boolean;
          description?: string;
          category?: string;
          image?: string;
          old_price_cents?: number | null;
          badge?: string | null;
          highlighted?: boolean;
        };
        Relationships: [];
      };
      product_addons: {
        Row: {
          id: number;
          name: string;
          price_cents: number;
          available: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          price_cents: number;
          available?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          price_cents?: number;
          available?: boolean;
        };
        Relationships: [];
      };
      product_categories: {
        Row: {
          id: number;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          created_at?: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: SaleOrder;
        Insert: {
          user_id: string;
          customer_name?: string | null;
          customer_email: string;
          customer_phone?: string | null;
          customer_address: string;
          items: Json;
          subtotal_cents: number;
          delivery_fee_cents: number;
          total_cents: number;
          status?: OrderStatus;
        };
        Update: {
          status?: OrderStatus;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      place_order: {
        Args: { p_items: Json };
        Returns: SaleOrder;
      };
    };
    Enums: {
      order_status: OrderStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
