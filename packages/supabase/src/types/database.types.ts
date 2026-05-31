export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      deals: {
        Row: {
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          dispensary_id: string
          end_date: string
          id: string
          is_active: boolean
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          dispensary_id: string
          end_date: string
          id?: string
          is_active?: boolean
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          dispensary_id?: string
          end_date?: string
          id?: string
          is_active?: boolean
          start_date?: string
          title?: string
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
          dispensary_id: string
          id: string
          items: Json
          notes: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dispensary_id: string
          id?: string
          items: Json
          notes?: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dispensary_id?: string
          id?: string
          items?: Json
          notes?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
      product_reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
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
          body: string | null
          created_at: string
          dispensary_id: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dispensary_id: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dispensary_id?: string
          id?: string
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
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      create_order: {
        Args: {
          p_dispensary_id: string
          p_items: Json
          p_notes?: string
          p_order_type: Database["public"]["Enums"]["order_type"]
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
      discount_type: "percentage" | "fixed" | "bogo"
      dispensary_status: "pending" | "active" | "suspended"
      order_status:
        | "pending"
        | "confirmed"
        | "ready"
        | "completed"
        | "cancelled"
      order_type: "pickup" | "delivery"
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
  public: {
    Enums: {
      discount_type: ["percentage", "fixed", "bogo"],
      dispensary_status: ["pending", "active", "suspended"],
      order_status: ["pending", "confirmed", "ready", "completed", "cancelled"],
      order_type: ["pickup", "delivery"],
      strain_type: ["indica", "sativa", "hybrid", "cbd"],
      user_role: ["consumer", "dispensary_owner", "admin"],
    },
  },
} as const

