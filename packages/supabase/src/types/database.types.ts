export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      deal_redemptions: {
        Row: {
          code: string
          created_at: string
          deal_id: string
          discount_cents: number
          dispensary_id: string
          id: string
          order_id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          deal_id: string
          discount_cents: number
          dispensary_id: string
          id?: string
          order_id: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          deal_id?: string
          discount_cents?: number
          dispensary_id?: string
          id?: string
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_redemptions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_redemptions_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          auto_apply: boolean
          buy_quantity: number | null
          code: string | null
          created_at: string
          days_of_week: number[]
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          dispensary_id: string
          end_date: string
          exclude_product_ids: string[]
          featured: boolean
          get_discount_percent: number | null
          get_quantity: number | null
          id: string
          image_url: string | null
          is_active: boolean
          kind: Database["public"]["Enums"]["deal_kind"]
          max_discount_cents: number | null
          min_subtotal_cents: number | null
          new_customers_only: boolean
          order_types: Database["public"]["Enums"]["order_type"][]
          per_customer_limit: number | null
          sort_priority: number
          start_date: string
          stackable: boolean
          target_brand_ids: string[]
          target_category_ids: string[]
          target_product_ids: string[]
          target_scope: Database["public"]["Enums"]["deal_target_scope"]
          terms: string | null
          time_end: string | null
          time_start: string | null
          title: string
          total_limit: number | null
          updated_at: string
        }
        Insert: {
          auto_apply?: boolean
          buy_quantity?: number | null
          code?: string | null
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          dispensary_id: string
          end_date: string
          exclude_product_ids?: string[]
          featured?: boolean
          get_discount_percent?: number | null
          get_quantity?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: Database["public"]["Enums"]["deal_kind"]
          max_discount_cents?: number | null
          min_subtotal_cents?: number | null
          new_customers_only?: boolean
          order_types?: Database["public"]["Enums"]["order_type"][]
          per_customer_limit?: number | null
          sort_priority?: number
          start_date: string
          stackable?: boolean
          target_brand_ids?: string[]
          target_category_ids?: string[]
          target_product_ids?: string[]
          target_scope?: Database["public"]["Enums"]["deal_target_scope"]
          terms?: string | null
          time_end?: string | null
          time_start?: string | null
          title: string
          total_limit?: number | null
          updated_at?: string
        }
        Update: {
          auto_apply?: boolean
          buy_quantity?: number | null
          code?: string | null
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          dispensary_id?: string
          end_date?: string
          exclude_product_ids?: string[]
          featured?: boolean
          get_discount_percent?: number | null
          get_quantity?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: Database["public"]["Enums"]["deal_kind"]
          max_discount_cents?: number | null
          min_subtotal_cents?: number | null
          new_customers_only?: boolean
          order_types?: Database["public"]["Enums"]["order_type"][]
          per_customer_limit?: number | null
          sort_priority?: number
          start_date?: string
          stackable?: boolean
          target_brand_ids?: string[]
          target_category_ids?: string[]
          target_product_ids?: string[]
          target_scope?: Database["public"]["Enums"]["deal_target_scope"]
          terms?: string | null
          time_end?: string | null
          time_start?: string | null
          title?: string
          total_limit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispensaries: {
        Row: {
          address: string
          amenities: string[]
          announcement: string | null
          city: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          email: string | null
          featured: boolean
          hours: Json | null
          id: string
          is_delivery: boolean
          is_medical: boolean
          is_pickup: boolean
          is_recreational: boolean
          latitude: number | null
          license_number: string | null
          location: unknown
          logo_url: string | null
          longitude: number | null
          name: string
          owner_id: string | null
          phone: string | null
          rating_avg: number
          rating_count: number
          search_vector: unknown
          slug: string
          state: string
          status: Database["public"]["Enums"]["dispensary_status"]
          updated_at: string
          website: string | null
          zip: string
        }
        Insert: {
          address: string
          amenities?: string[]
          announcement?: string | null
          city: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          featured?: boolean
          hours?: Json | null
          id?: string
          is_delivery?: boolean
          is_medical?: boolean
          is_pickup?: boolean
          is_recreational?: boolean
          latitude?: number | null
          license_number?: string | null
          location: unknown
          logo_url?: string | null
          longitude?: number | null
          name: string
          owner_id?: string | null
          phone?: string | null
          rating_avg?: number
          rating_count?: number
          search_vector?: unknown
          slug: string
          state: string
          status?: Database["public"]["Enums"]["dispensary_status"]
          updated_at?: string
          website?: string | null
          zip: string
        }
        Update: {
          address?: string
          amenities?: string[]
          announcement?: string | null
          city?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          featured?: boolean
          hours?: Json | null
          id?: string
          is_delivery?: boolean
          is_medical?: boolean
          is_pickup?: boolean
          is_recreational?: boolean
          latitude?: number | null
          license_number?: string | null
          location?: unknown
          logo_url?: string | null
          longitude?: number | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          rating_avg?: number
          rating_count?: number
          search_vector?: unknown
          slug?: string
          state?: string
          status?: Database["public"]["Enums"]["dispensary_status"]
          updated_at?: string
          website?: string | null
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispensaries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          dispensary_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dispensary_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          dispensary_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operating_regions: {
        Row: {
          created_at: string
          is_medical_legal: boolean
          is_recreational_legal: boolean
          min_age: number
          notes: string | null
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_medical_legal?: boolean
          is_recreational_legal?: boolean
          min_age?: number
          notes?: string | null
          state: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_medical_legal?: boolean
          is_recreational_legal?: boolean
          min_age?: number
          notes?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          deal_id: string | null
          discount_cents: number
          dispensary_id: string
          id: string
          items: Json
          notes: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id?: string | null
          discount_cents?: number
          dispensary_id: string
          id?: string
          items: Json
          notes?: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string | null
          discount_cents?: number
          dispensary_id?: string
          id?: string
          items?: Json
          notes?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ownership_requests: {
        Row: {
          created_at: string
          dispensary_id: string
          id: string
          license_number: string | null
          message: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dispensary_id: string
          id?: string
          license_number?: string | null
          message?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dispensary_id?: string
          id?: string
          license_number?: string | null
          message?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_requests_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          author_name: string | null
          body: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          brand_id: string | null
          category_id: string
          cbd_percentage: number | null
          created_at: string
          description: string | null
          dispensary_id: string
          id: string
          image_urls: string[]
          in_stock: boolean
          is_featured: boolean
          name: string
          price_cents: number
          rating_avg: number
          rating_count: number
          search_vector: unknown
          slug: string
          strain_id: string | null
          strain_type: Database["public"]["Enums"]["strain_type"] | null
          thc_percentage: number | null
          unit: string | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          brand?: string | null
          brand_id?: string | null
          category_id: string
          cbd_percentage?: number | null
          created_at?: string
          description?: string | null
          dispensary_id: string
          id?: string
          image_urls?: string[]
          in_stock?: boolean
          is_featured?: boolean
          name: string
          price_cents: number
          rating_avg?: number
          rating_count?: number
          search_vector?: unknown
          slug: string
          strain_id?: string | null
          strain_type?: Database["public"]["Enums"]["strain_type"] | null
          thc_percentage?: number | null
          unit?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          brand?: string | null
          brand_id?: string | null
          category_id?: string
          cbd_percentage?: number | null
          created_at?: string
          description?: string | null
          dispensary_id?: string
          id?: string
          image_urls?: string[]
          in_stock?: boolean
          is_featured?: boolean
          name?: string
          price_cents?: number
          rating_avg?: number
          rating_count?: number
          search_vector?: unknown
          slug?: string
          strain_id?: string | null
          strain_type?: Database["public"]["Enums"]["strain_type"] | null
          thc_percentage?: number | null
          unit?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_strain_id_fkey"
            columns: ["strain_id"]
            isOneToOne: false
            referencedRelation: "strains"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string | null
          body: string | null
          created_at: string
          dispensary_id: string
          id: string
          owner_reply: string | null
          owner_reply_at: string | null
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body?: string | null
          created_at?: string
          dispensary_id: string
          id?: string
          owner_reply?: string | null
          owner_reply_at?: string | null
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string | null
          created_at?: string
          dispensary_id?: string
          id?: string
          owner_reply?: string | null
          owner_reply_at?: string | null
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strains: {
        Row: {
          created_at: string
          description: string | null
          effects: string[]
          flavors: string[]
          id: string
          image_url: string | null
          name: string
          slug: string
          thc_high: number | null
          thc_low: number | null
          type: Database["public"]["Enums"]["strain_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          effects?: string[]
          flavors?: string[]
          id?: string
          image_url?: string | null
          name: string
          slug: string
          thc_high?: number | null
          thc_low?: number | null
          type?: Database["public"]["Enums"]["strain_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          effects?: string[]
          flavors?: string[]
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          thc_high?: number | null
          thc_low?: number | null
          type?: Database["public"]["Enums"]["strain_type"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_ownership_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      compute_promo_discount: {
        Args: { p_code: string; p_dispensary_id: string; p_subtotal_cents: number }
        Returns: {
          deal_id: string
          discount_cents: number
          title: string
        }[]
      }
      create_order: {
        Args: {
          p_dispensary_id: string
          p_items: Json
          p_notes?: string
          p_order_type: Database["public"]["Enums"]["order_type"]
          p_promo_code?: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_dispensary_open: {
        Args: { at_ts?: string; hours: Json }
        Returns: boolean
      }
      owns_dispensary: {
        Args: { target_dispensary_id: string }
        Returns: boolean
      }
      recalc_dispensary_rating: {
        Args: { target_id: string }
        Returns: undefined
      }
      recalc_product_rating: { Args: { target_id: string }; Returns: undefined }
      reply_to_review: {
        Args: { p_reply: string; p_review_id: string }
        Returns: undefined
      }
      reject_ownership_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      search_dispensaries: {
        Args: {
          filter_category_slug?: string
          filter_delivery?: boolean
          filter_medical?: boolean
          filter_open_now?: boolean
          filter_pickup?: boolean
          filter_recreational?: boolean
          lat?: number
          lng?: number
          radius_meters?: number
          result_limit?: number
          result_offset?: number
          search_query?: string
        }
        Returns: {
          address: string
          city: string
          cover_image_url: string
          created_at: string
          description: string
          distance_meters: number
          email: string
          featured: boolean
          hours: Json
          id: string
          is_delivery: boolean
          is_medical: boolean
          is_open_now: boolean
          is_pickup: boolean
          is_recreational: boolean
          latitude: number
          license_number: string
          logo_url: string
          longitude: number
          name: string
          owner_id: string
          phone: string
          rank: number
          rating_avg: number
          rating_count: number
          slug: string
          state: string
          status: Database["public"]["Enums"]["dispensary_status"]
          total_count: number
          updated_at: string
          website: string
          zip: string
        }[]
      }
      search_products: {
        Args: {
          filter_category_slug?: string
          filter_dispensary_id?: string
          filter_strain?: Database["public"]["Enums"]["strain_type"]
          in_stock_only?: boolean
          max_price_cents?: number
          min_price_cents?: number
          result_limit?: number
          result_offset?: number
          search_query?: string
        }
        Returns: {
          brand: string
          category_id: string
          cbd_percentage: number
          created_at: string
          description: string
          dispensary_id: string
          id: string
          image_urls: string[]
          in_stock: boolean
          is_featured: boolean
          name: string
          price_cents: number
          rank: number
          rating_avg: number
          rating_count: number
          slug: string
          strain_type: Database["public"]["Enums"]["strain_type"]
          thc_percentage: number
          total_count: number
          unit: string
          updated_at: string
          weight_grams: number
        }[]
      }
    }
    Enums: {
      deal_kind:
        | "percentage"
        | "fixed_amount"
        | "price_target"
        | "bogo"
        | "bundle"
        | "gift"
        | "spend_threshold"
      deal_target_scope: "menu" | "category" | "brand" | "products"
      discount_type: "percentage" | "fixed" | "bogo"
      dispensary_status: "pending" | "active" | "suspended"
      order_status:
        | "pending"
        | "confirmed"
        | "ready"
        | "completed"
        | "cancelled"
      order_type: "pickup" | "delivery"
      payment_status: "unpaid" | "paid" | "refunded"
      strain_type: "indica" | "sativa" | "hybrid" | "cbd"
      user_role: "consumer" | "dispensary_owner" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      deal_kind: [
        "percentage",
        "fixed_amount",
        "price_target",
        "bogo",
        "bundle",
        "gift",
        "spend_threshold",
      ],
      deal_target_scope: ["menu", "category", "brand", "products"],
      discount_type: ["percentage", "fixed", "bogo"],
      dispensary_status: ["pending", "active", "suspended"],
      order_status: ["pending", "confirmed", "ready", "completed", "cancelled"],
      order_type: ["pickup", "delivery"],
      payment_status: ["unpaid", "paid", "refunded"],
      strain_type: ["indica", "sativa", "hybrid", "cbd"],
      user_role: ["consumer", "dispensary_owner", "admin"],
    },
  },
} as const

