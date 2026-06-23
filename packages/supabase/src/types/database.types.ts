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
      ad_bids: {
        Row: {
          bid_cents: number
          contract_end: string
          contract_start: string
          created_at: string
          dispensary_id: string
          id: string
          paid_at: string | null
          region_id: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          bid_cents: number
          contract_end: string
          contract_start?: string
          created_at?: string
          dispensary_id: string
          id?: string
          paid_at?: string | null
          region_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          bid_cents?: number
          contract_end?: string
          contract_start?: string
          created_at?: string
          dispensary_id?: string
          id?: string
          paid_at?: string | null
          region_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_bids_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "ad_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_bids_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_regions: {
        Row: {
          city: string | null
          created_at: string
          featured_rate_cents: number
          id: string
          is_active: boolean
          name: string
          slots: number
          slug: string
          state: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          featured_rate_cents?: number
          id?: string
          is_active?: boolean
          name: string
          slots?: number
          slug: string
          state: string
        }
        Update: {
          city?: string | null
          created_at?: string
          featured_rate_cents?: number
          id?: string
          is_active?: boolean
          name?: string
          slots?: number
          slug?: string
          state?: string
        }
        Relationships: []
      }
      brand_ad_regions: {
        Row: {
          created_at: string
          featured_rate_cents: number
          id: string
          is_active: boolean
          name: string
          slots: number
          slug: string
          state: string
        }
        Insert: {
          created_at?: string
          featured_rate_cents?: number
          id?: string
          is_active?: boolean
          name: string
          slots?: number
          slug: string
          state: string
        }
        Update: {
          created_at?: string
          featured_rate_cents?: number
          id?: string
          is_active?: boolean
          name?: string
          slots?: number
          slug?: string
          state?: string
        }
        Relationships: []
      }
      brand_ad_bids: {
        Row: {
          bid_cents: number
          brand_id: string
          contract_end: string
          contract_start: string
          created_at: string
          id: string
          paid_at: string | null
          region_id: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          bid_cents: number
          brand_id: string
          contract_end: string
          contract_start?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          region_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          bid_cents?: number
          brand_id?: string
          contract_end?: string
          contract_start?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          region_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_ad_bids_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "brand_ad_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_ad_bids_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      brand_claims: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          message: string | null
          status: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          message?: string | null
          status?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          message?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_claims_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          target_price_cents: number | null
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
          target_price_cents?: number | null
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
          target_price_cents?: number | null
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
          address: string | null
          amenities: string[]
          announcement: string | null
          city: string | null
          county: string | null
          cover_image_url: string | null
          created_at: string
          dcc_email: string | null
          dcc_phone: string | null
          description: string | null
          email: string | null
          featured: boolean
          featured_manual: boolean
          google_photo_name: string | null
          google_place_id: string | null
          legal_name: string | null
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
          pos_addon: boolean
          rating_atmosphere: number
          rating_avg: number
          rating_count: number
          rating_quality: number
          rating_service: number
          search_vector: unknown
          slug: string
          state: string
          status: Database["public"]["Enums"]["dispensary_status"]
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[]
          announcement?: string | null
          city?: string | null
          county?: string | null
          cover_image_url?: string | null
          dcc_email?: string | null
          dcc_phone?: string | null
          legal_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          featured?: boolean
          featured_manual?: boolean
          google_photo_name?: string | null
          google_place_id?: string | null
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
          name: string
          owner_id?: string | null
          phone?: string | null
          pos_addon?: boolean
          rating_atmosphere?: number
          rating_avg?: number
          rating_count?: number
          rating_quality?: number
          rating_service?: number
          search_vector?: unknown
          slug: string
          state: string
          status?: Database["public"]["Enums"]["dispensary_status"]
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[]
          announcement?: string | null
          city?: string | null
          county?: string | null
          cover_image_url?: string | null
          dcc_email?: string | null
          dcc_phone?: string | null
          legal_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          featured?: boolean
          featured_manual?: boolean
          google_photo_name?: string | null
          google_place_id?: string | null
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
          pos_addon?: boolean
          rating_atmosphere?: number
          rating_avg?: number
          rating_count?: number
          rating_quality?: number
          rating_service?: number
          search_vector?: unknown
          slug?: string
          state?: string
          status?: Database["public"]["Enums"]["dispensary_status"]
          updated_at?: string
          website?: string | null
          zip?: string | null
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
      dispensary_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          dispensary_id: string
          id: string
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          dispensary_id: string
          id?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          dispensary_id?: string
          id?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispensary_subscriptions_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: true
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensary_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
      brand_followers: {
        Row: {
          brand_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_followers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_products: {
        Row: {
          brand_id: string
          category_id: string | null
          cbd_percentage: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          sort_order: number
          strain_type: Database["public"]["Enums"]["strain_type"] | null
          thc_percentage: number | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          category_id?: string | null
          cbd_percentage?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          sort_order?: number
          strain_type?: Database["public"]["Enums"]["strain_type"] | null
          thc_percentage?: number | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          category_id?: string | null
          cbd_percentage?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          sort_order?: number
          strain_type?: Database["public"]["Enums"]["strain_type"] | null
          thc_percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_updates: {
        Row: {
          body: string | null
          brand_id: string
          created_at: string
          expires_at: string
          id: string
          title: string
        }
        Insert: {
          body?: string | null
          brand_id: string
          created_at?: string
          expires_at?: string
          id?: string
          title: string
        }
        Update: {
          body?: string | null
          brand_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_updates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      dispensary_updates: {
        Row: {
          body: string | null
          created_at: string
          dispensary_id: string
          expires_at: string
          id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dispensary_id: string
          expires_at?: string
          id?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dispensary_id?: string
          expires_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispensary_updates_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
        ]
      }
      dispensary_promos: {
        Row: {
          created_at: string
          description: string | null
          dispensary_id: string
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          dispensary_id: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          dispensary_id?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispensary_promos_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
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
          device: string | null
          discount_cents: number
          dispensary_id: string
          id: string
          items: Json
          notes: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          platform_fee_bps: number
          platform_fee_cents: number
          sold_by_staff: string | null
          source: string
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
          device?: string | null
          discount_cents?: number
          dispensary_id: string
          id?: string
          items: Json
          notes?: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee_bps?: number
          platform_fee_cents?: number
          sold_by_staff?: string | null
          source?: string
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
          device?: string | null
          discount_cents?: number
          dispensary_id?: string
          id?: string
          items?: Json
          notes?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee_bps?: number
          platform_fee_cents?: number
          sold_by_staff?: string | null
          source?: string
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
      placement_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          placement_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          placement_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          placement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_events_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      placements: {
        Row: {
          brand_id: string | null
          created_at: string
          dispensary_id: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          notes: string | null
          price_cents: number
          priority: number
          scope_city: string | null
          scope_state: string | null
          starts_at: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          target_id: string | null
          type: Database["public"]["Enums"]["placement_type"]
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          dispensary_id?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          price_cents?: number
          priority?: number
          scope_city?: string | null
          scope_state?: string | null
          starts_at?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          target_id?: string | null
          type: Database["public"]["Enums"]["placement_type"]
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          dispensary_id?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          price_cents?: number
          priority?: number
          scope_city?: string | null
          scope_state?: string | null
          starts_at?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          target_id?: string | null
          type?: Database["public"]["Enums"]["placement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "placements_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          commission_bps: number
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
        }
        Insert: {
          commission_bps?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          slug: string
          sort_order?: number
        }
        Update: {
          commission_bps?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
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
      pos_shifts: {
        Row: {
          card_sales_cents: number
          cash_sales_cents: number
          closed_at: string | null
          closed_by: string | null
          closing_count_cents: number | null
          created_at: string
          debit_sales_cents: number
          dispensary_id: string
          expected_cash_cents: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_float_cents: number
          over_short_cents: number | null
          sales_count: number
        }
        Insert: {
          card_sales_cents?: number
          cash_sales_cents?: number
          closed_at?: string | null
          closed_by?: string | null
          closing_count_cents?: number | null
          created_at?: string
          debit_sales_cents?: number
          dispensary_id: string
          expected_cash_cents?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_float_cents?: number
          over_short_cents?: number | null
          sales_count?: number
        }
        Update: {
          card_sales_cents?: number
          cash_sales_cents?: number
          closed_at?: string | null
          closed_by?: string | null
          closing_count_cents?: number | null
          created_at?: string
          debit_sales_cents?: number
          dispensary_id?: string
          expected_cash_cents?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_float_cents?: number
          over_short_cents?: number | null
          sales_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_shifts_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_staff: {
        Row: {
          active: boolean
          created_at: string
          dispensary_id: string
          id: string
          name: string
          pin_hash: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dispensary_id: string
          id?: string
          name: string
          pin_hash: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dispensary_id?: string
          id?: string
          name?: string
          pin_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_staff_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          brand_id: string | null
          catalog_id: string | null
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
          stock_qty: number | null
          strain_id: string | null
          strain_type: Database["public"]["Enums"]["strain_type"] | null
          thc_percentage: number | null
          unit: string | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          brand_id?: string | null
          catalog_id?: string | null
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
          stock_qty?: number | null
          strain_id?: string | null
          strain_type?: Database["public"]["Enums"]["strain_type"] | null
          thc_percentage?: number | null
          unit?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          brand_id?: string | null
          catalog_id?: string | null
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
          stock_qty?: number | null
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
            foreignKeyName: "products_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "brand_products"
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
          atmosphere: number | null
          author_name: string | null
          body: string | null
          created_at: string
          dispensary_id: string
          dispute_reason: string | null
          disputed_at: string | null
          id: string
          owner_reply: string | null
          owner_reply_at: string | null
          quality: number | null
          rating: number
          service: number | null
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          atmosphere?: number | null
          author_name?: string | null
          body?: string | null
          created_at?: string
          dispensary_id: string
          dispute_reason?: string | null
          disputed_at?: string | null
          id?: string
          owner_reply?: string | null
          owner_reply_at?: string | null
          quality?: number | null
          rating: number
          service?: number | null
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          atmosphere?: number | null
          author_name?: string | null
          body?: string | null
          created_at?: string
          dispensary_id?: string
          dispute_reason?: string | null
          disputed_at?: string | null
          id?: string
          owner_reply?: string | null
          owner_reply_at?: string | null
          quality?: number | null
          rating?: number
          service?: number | null
          updated_at?: string
          user_id?: string
          verified?: boolean
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
          cbd_high: number | null
          cbd_low: number | null
          created_at: string
          description: string | null
          effects: string[]
          flavors: string[]
          flowering_days_max: number | null
          flowering_days_min: number | null
          grow_difficulty: string | null
          grow_notes: string | null
          id: string
          image_url: string | null
          medical_uses: string[]
          name: string
          negative_effects: string[]
          parents: string[]
          saves_count: number
          slug: string
          terpenes: string[]
          thc_high: number | null
          thc_low: number | null
          type: Database["public"]["Enums"]["strain_type"]
          updated_at: string
          yield_note: string | null
        }
        Insert: {
          cbd_high?: number | null
          cbd_low?: number | null
          created_at?: string
          description?: string | null
          effects?: string[]
          flavors?: string[]
          flowering_days_max?: number | null
          flowering_days_min?: number | null
          grow_difficulty?: string | null
          grow_notes?: string | null
          id?: string
          image_url?: string | null
          medical_uses?: string[]
          name: string
          negative_effects?: string[]
          parents?: string[]
          saves_count?: number
          slug: string
          terpenes?: string[]
          thc_high?: number | null
          thc_low?: number | null
          type?: Database["public"]["Enums"]["strain_type"]
          updated_at?: string
          yield_note?: string | null
        }
        Update: {
          cbd_high?: number | null
          cbd_low?: number | null
          created_at?: string
          description?: string | null
          effects?: string[]
          flavors?: string[]
          flowering_days_max?: number | null
          flowering_days_min?: number | null
          grow_difficulty?: string | null
          grow_notes?: string | null
          id?: string
          image_url?: string | null
          medical_uses?: string[]
          name?: string
          negative_effects?: string[]
          parents?: string[]
          saves_count?: number
          slug?: string
          terpenes?: string[]
          thc_high?: number | null
          thc_low?: number | null
          type?: Database["public"]["Enums"]["strain_type"]
          updated_at?: string
          yield_note?: string | null
        }
        Relationships: []
      }
      strain_favorites: {
        Row: {
          created_at: string
          strain_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          strain_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          strain_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strain_favorites_strain_id_fkey"
            columns: ["strain_id"]
            isOneToOne: false
            referencedRelation: "strains"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_placements: {
        Row: {
          brand_id: string | null
          created_at: string | null
          dispensary_id: string | null
          ends_at: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          price_cents: number | null
          priority: number | null
          scope_city: string | null
          scope_state: string | null
          starts_at: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          target_id: string | null
          type: Database["public"]["Enums"]["placement_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "placements_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "dispensaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_stats: {
        Row: {
          clicks: number | null
          impressions: number | null
          placement_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placement_events_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_ownership_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      approve_brand_claim: {
        Args: { p_claim_id: string }
        Returns: undefined
      }
      reject_brand_claim: {
        Args: { p_claim_id: string }
        Returns: undefined
      }
      update_owned_brand: {
        Args: {
          p_brand_id: string
          p_description: string
          p_logo_url: string
          p_website: string
        }
        Returns: undefined
      }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      compute_auto_order_discount: {
        Args: { p_dispensary_id: string; p_subtotal_cents: number }
        Returns: {
          deal_id: string
          discount_cents: number
          title: string
        }[]
      }
      compute_bogo_discount: {
        Args: { p_dispensary_id: string; p_items: Json }
        Returns: {
          deal_id: string
          discount_cents: number
          title: string
        }[]
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
          p_source?: string
          p_device?: string
        }
        Returns: string
      }
      create_pos_order: {
        Args: {
          p_dispensary_id: string
          p_items: Json
          p_payment_method?: string
        }
        Returns: string
      }
      grant_pos_addon: {
        Args: { p_dispensary_id: string; p_enabled: boolean }
        Returns: undefined
      }
      add_pos_staff: {
        Args: { p_dispensary_id: string; p_name: string; p_pin: string }
        Returns: string
      }
      place_ad_bid: {
        Args: { p_region_id: string; p_dispensary_id: string; p_bid_cents: number }
        Returns: undefined
      }
      brand_follower_count: {
        Args: { p_brand_id: string }
        Returns: number
      }
      post_brand_update: {
        Args: { p_brand_id: string; p_title: string; p_body: string }
        Returns: string
      }
      region_featured_dispensaries: {
        Args: { p_state: string; p_city?: string }
        Returns: { dispensary_id: string }[]
      }
      cancel_ad_bid: {
        Args: { p_bid_id: string }
        Returns: undefined
      }
      ad_bids_for_owner: {
        Args: { p_dispensary_id: string }
        Returns: {
          region_id: string
          region_name: string
          state: string
          city: string | null
          slots: number
          floor_cents: number
          min_winning_cents: number
          your_bid_cents: number | null
          your_bid_id: string | null
          contract_end: string | null
          is_winning: boolean
        }[]
      }
      place_brand_bid: {
        Args: { p_region_id: string; p_brand_id: string; p_bid_cents: number }
        Returns: undefined
      }
      activate_brand_bid: {
        Args: { p_bid_id: string; p_payment_intent?: string }
        Returns: undefined
      }
      activate_ad_bid: {
        Args: { p_bid_id: string; p_payment_intent?: string }
        Returns: undefined
      }
      cancel_brand_bid: {
        Args: { p_bid_id: string }
        Returns: undefined
      }
      region_featured_brands: {
        Args: { p_state: string }
        Returns: { brand_id: string }[]
      }
      brand_bids_for_owner: {
        Args: { p_brand_id: string }
        Returns: {
          region_id: string
          region_name: string
          state: string
          slots: number
          floor_cents: number
          min_winning_cents: number
          your_bid_cents: number | null
          your_bid_id: string | null
          contract_end: string | null
          is_winning: boolean
        }[]
      }
      verify_pos_staff: {
        Args: { p_dispensary_id: string; p_pin: string }
        Returns: { id: string; name: string }[]
      }
      dispensary_sale_prices: {
        Args: { p_dispensary_id: string }
        Returns: {
          product_id: string
          sale_cents: number
          deal_id: string
          deal_title: string
        }[]
      }
      effective_unit_price: {
        Args: { p_product_id: string }
        Returns: {
          unit_cents: number
          deal_id: string
          deal_title: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_dispensary_open: {
        Args: { at_ts?: string; hours: Json }
        Returns: boolean
      }
      owns_brand: {
        Args: { p_brand_id: string }
        Returns: boolean
      }
      owns_dispensary: {
        Args: { target_dispensary_id: string }
        Returns: boolean
      }
      dispute_review: {
        Args: { p_review_id: string; p_reason: string }
        Returns: undefined
      }
      dispensary_follower_count: {
        Args: { p_dispensary_id: string }
        Returns: number
      }
      post_dispensary_update: {
        Args: { p_dispensary_id: string; p_title: string; p_body: string }
        Returns: string
      }
      recalc_dispensary_rating: {
        Args: { target_id: string }
        Returns: undefined
      }
      recalc_product_rating: { Args: { target_id: string }; Returns: undefined }
      record_placement_event: {
        Args: { p_placement_id: string; p_type: string }
        Returns: undefined
      }
      reply_to_review: {
        Args: { p_reply: string; p_review_id: string }
        Returns: undefined
      }
      sale_prices_for: {
        Args: { p_product_ids: string[] }
        Returns: {
          product_id: string
          sale_cents: number
          deal_id: string
          deal_title: string
        }[]
      }
      reject_ownership_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      search_global: {
        Args: { search_query: string; per_kind_limit?: number }
        Returns: {
          kind: string
          id: string
          slug: string
          name: string
          subtitle: string | null
          image_url: string | null
          rank: number
        }[]
      }
      search_dispensaries: {
        Args: {
          filter_amenities?: string[]
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
      sync_featured_flags: {
        Args: { p_dispensary_id?: string }
        Returns: undefined
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
      placement_type: "featured" | "hero" | "promoted_deal" | "promoted_product" | "promoted_brand"
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
      placement_type: ["featured", "hero", "promoted_deal", "promoted_product", "promoted_brand"],
      strain_type: ["indica", "sativa", "hybrid", "cbd"],
      user_role: ["consumer", "dispensary_owner", "admin"],
    },
  },
} as const

