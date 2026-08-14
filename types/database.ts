export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
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
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string | null
          id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          new_state: string | null
          old_state: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          new_state?: string | null
          old_state?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          new_state?: string | null
          old_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["customer_kind"]
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["customer_kind"]
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["customer_kind"]
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivered_by: string | null
          id: string
          notes: string | null
          order_id: string
          proof_path: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          proof_path?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          proof_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          delivery_id: string
          id: string
          order_item_id: string
          quantity: number
        }
        Insert: {
          delivery_id: string
          id?: string
          order_item_id: string
          quantity: number
        }
        Update: {
          delivery_id?: string
          id?: string
          order_item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          converted_at: string | null
          created_at: string
          customer_id: string
          id: string
          source: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          converted_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          converted_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          category_id: string | null
          created_at: string
          default_cost: number
          default_sell_price: number
          id: string
          is_active: boolean
          name: string
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          default_cost?: number
          default_sell_price?: number
          id?: string
          is_active?: boolean
          name: string
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          default_cost?: number
          default_sell_price?: number
          id?: string
          is_active?: boolean
          name?: string
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
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
      order_items: {
        Row: {
          description: string
          id: string
          material_id: string | null
          order_id: string
          quantity: number
          quantity_pending: number | null
          quantity_received: number
          quote_item_id: string | null
        }
        Insert: {
          description: string
          id?: string
          material_id?: string | null
          order_id: string
          quantity: number
          quantity_pending?: number | null
          quantity_received?: number
          quote_item_id?: string | null
        }
        Update: {
          description?: string
          id?: string
          material_id?: string | null
          order_id?: string
          quantity?: number
          quantity_pending?: number | null
          quantity_received?: number
          quote_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          activated_at: string | null
          assigned_sales_id: string | null
          created_at: string
          customer_id: string
          id: string
          on_hold_reason: string | null
          quote_id: string
          status: Database["public"]["Enums"]["workflow_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          assigned_sales_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          on_hold_reason?: string | null
          quote_id: string
          status?: Database["public"]["Enums"]["workflow_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          assigned_sales_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          on_hold_reason?: string | null
          quote_id?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_sales_id_fkey"
            columns: ["assigned_sales_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_verifications: {
        Row: {
          created_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["payment_status"]
          id: string
          notes: string | null
          payment_id: string
        }
        Insert: {
          created_at?: string
          decided_by: string
          decision: Database["public"]["Enums"]["payment_status"]
          id?: string
          notes?: string | null
          payment_id: string
        }
        Update: {
          created_at?: string
          decided_by?: string
          decision?: Database["public"]["Enums"]["payment_status"]
          id?: string
          notes?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_verifications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_verifications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"] | null
          notes: string | null
          order_id: string | null
          paid_at: string
          quote_id: string
          recorded_by: string
          reference_number: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method?: Database["public"]["Enums"]["payment_method"] | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string
          quote_id: string
          recorded_by: string
          reference_number?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          method?: Database["public"]["Enums"]["payment_method"] | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string
          quote_id?: string
          recorded_by?: string
          reference_number?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string
          slug: string
        }
        Insert: {
          description: string
          slug: string
        }
        Update: {
          description?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      quote_approvals: {
        Row: {
          created_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          quote_id: string
          reason: string | null
          version_id: string
        }
        Insert: {
          created_at?: string
          decided_by: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id?: string
          quote_id: string
          reason?: string | null
          version_id: string
        }
        Update: {
          created_at?: string
          decided_by?: string
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          quote_id?: string
          reason?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_approvals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_approvals_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          description: string
          discount: number
          id: string
          line_total: number
          material_id: string | null
          quantity: number
          sort_order: number
          tax: number
          unit_cost: number
          unit_price: number
          version_id: string
        }
        Insert: {
          description: string
          discount?: number
          id?: string
          line_total: number
          material_id?: string | null
          quantity: number
          sort_order?: number
          tax?: number
          unit_cost?: number
          unit_price: number
          version_id: string
        }
        Update: {
          description?: string
          discount?: number
          id?: string
          line_total?: number
          material_id?: string | null
          quantity?: number
          sort_order?: number
          tax?: number
          unit_cost?: number
          unit_price?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          created_at: string
          created_by: string
          discount: number
          id: string
          margin_amount: number | null
          margin_percent: number | null
          notes: string | null
          quote_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["workflow_status"]
          subtotal: number
          tax: number
          total: number
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          discount?: number
          id?: string
          margin_amount?: number | null
          margin_percent?: number | null
          notes?: string | null
          quote_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          subtotal?: number
          tax?: number
          total?: number
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          discount?: number
          id?: string
          margin_amount?: number | null
          margin_percent?: number | null
          notes?: string | null
          quote_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          subtotal?: number
          tax?: number
          total?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string
          current_version_id: string | null
          customer_id: string
          id: string
          public_access_token: string | null
          quote_number: string
          sent_at: string | null
          status: Database["public"]["Enums"]["workflow_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_version_id?: string | null
          customer_id: string
          id?: string
          public_access_token?: string | null
          quote_number: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_version_id?: string | null
          customer_id?: string
          id?: string
          public_access_token?: string | null
          quote_number?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_fkey"
            columns: ["permission"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "role_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["slug"]
          },
        ]
      }
      roles: {
        Row: {
          description: string | null
          name: string
          slug: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          description?: string | null
          name: string
          slug: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          description?: string | null
          name?: string
          slug?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      vendor_order_items: {
        Row: {
          id: string
          order_item_id: string | null
          quantity: number
          quantity_pending: number | null
          quantity_received: number
          vendor_order_id: string
        }
        Insert: {
          id?: string
          order_item_id?: string | null
          quantity: number
          quantity_pending?: number | null
          quantity_received?: number
          vendor_order_id: string
        }
        Update: {
          id?: string
          order_item_id?: string | null
          quantity?: number
          quantity_pending?: number | null
          quantity_received?: number
          vendor_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_order_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_order_items_vendor_order_id_fkey"
            columns: ["vendor_order_id"]
            isOneToOne: false
            referencedRelation: "vendor_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_orders: {
        Row: {
          created_at: string
          created_by: string | null
          dispatched_at: string | null
          expected_delivery_at: string | null
          id: string
          notes: string | null
          order_id: string
          received_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dispatched_at?: string | null
          expected_delivery_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          received_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dispatched_at?: string | null
          expected_delivery_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          received_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workflow_transitions: {
        Row: {
          from_status: Database["public"]["Enums"]["workflow_status"]
          to_status: Database["public"]["Enums"]["workflow_status"]
        }
        Insert: {
          from_status: Database["public"]["Enums"]["workflow_status"]
          to_status: Database["public"]["Enums"]["workflow_status"]
        }
        Update: {
          from_status?: Database["public"]["Enums"]["workflow_status"]
          to_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      allow_status: { Args: never; Returns: undefined }
      approve_quote: { Args: { p_quote_id: string }; Returns: undefined }
      assert_transition: {
        Args: {
          p_from: Database["public"]["Enums"]["workflow_status"]
          p_to: Database["public"]["Enums"]["workflow_status"]
        }
        Returns: undefined
      }
      complete_delivery: {
        Args: { p_notes?: string; p_order_id: string }
        Returns: undefined
      }
      create_quote: {
        Args: { p_customer_id: string; p_items: Json; p_notes?: string }
        Returns: string
      }
      current_profile: {
        Args: never
        Returns: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: { Args: { required: string }; Returns: boolean }
      insert_quote_items: {
        Args: { p_items: Json; p_version_id: string }
        Returns: undefined
      }
      is_accounts: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      mark_vendor_dispatched: {
        Args: { p_vendor_order_id: string }
        Returns: undefined
      }
      notify_user: {
        Args: {
          p_body: string
          p_payload?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      order_balance: {
        Args: { p_order_id: string }
        Returns: Database["public"]["CompositeTypes"]["balance_snapshot"]
        SetofOptions: {
          from: "*"
          to: "balance_snapshot"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      order_items_fully_received: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      order_outstanding: { Args: { p_order_id: string }; Returns: number }
      quote_balance: {
        Args: { p_quote_id: string }
        Returns: Database["public"]["CompositeTypes"]["balance_snapshot"]
        SetofOptions: {
          from: "*"
          to: "balance_snapshot"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      quote_outstanding: { Args: { p_quote_id: string }; Returns: number }
      recalc_version_totals: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      record_items_received: {
        Args: { p_received: Json; p_vendor_order_id: string }
        Returns: Database["public"]["Enums"]["workflow_status"]
      }
      record_payment: {
        Args: {
          p_amount: number
          p_kind: Database["public"]["Enums"]["payment_kind"]
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_paid_at?: string
          p_quote_id: string
          p_reference?: string
        }
        Returns: string
      }
      reject_payment: {
        Args: { p_notes: string; p_payment_id: string }
        Returns: undefined
      }
      reject_quote: {
        Args: { p_quote_id: string; p_reason: string }
        Returns: undefined
      }
      require_permission: {
        Args: { required: string }
        Returns: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revise_quote: {
        Args: { p_items: Json; p_notes?: string; p_quote_id: string }
        Returns: string
      }
      send_order_to_vendor: {
        Args: {
          p_expected_delivery?: string
          p_items: Json
          p_order_id: string
          p_vendor_id: string
        }
        Returns: string
      }
      get_public_quote: { Args: { p_token: string }; Returns: Json }
      send_quote_to_customer: { Args: { p_quote_id: string }; Returns: string }
      submit_quote: { Args: { p_quote_id: string }; Returns: undefined }
      verify_payment: {
        Args: { p_notes?: string; p_payment_id: string }
        Returns: Database["public"]["Enums"]["workflow_status"]
      }
      write_audit: {
        Args: {
          p_action: string
          p_actor: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_new_state: string
          p_old_state: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "sales" | "accounts" | "procurement" | "store" | "admin"
      approval_decision: "approved" | "rejected"
      customer_kind: "lead" | "customer"
      payment_kind: "advance" | "full" | "nil"
      payment_method:
        | "cash"
        | "upi"
        | "bank_transfer"
        | "cheque"
        | "card"
        | "other"
      payment_status: "pending" | "verified" | "rejected"
      workflow_status:
        | "quote_draft"
        | "quote_pending_accounts"
        | "quote_rejected"
        | "quote_approved"
        | "quote_sent_to_customer"
        | "payment_pending_verification"
        | "order_active"
        | "sent_to_vendor"
        | "vendor_dispatched"
        | "items_received"
        | "delivery_pending_payment"
        | "order_on_hold"
        | "delivery_unlocked"
        | "delivered"
        | "closed"
    }
    CompositeTypes: {
      balance_snapshot: {
        order_total: number | null
        verified_payments: number | null
        outstanding: number | null
      }
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
      app_role: ["sales", "accounts", "procurement", "store", "admin"],
      approval_decision: ["approved", "rejected"],
      customer_kind: ["lead", "customer"],
      payment_kind: ["advance", "full", "nil"],
      payment_method: [
        "cash",
        "upi",
        "bank_transfer",
        "cheque",
        "card",
        "other",
      ],
      payment_status: ["pending", "verified", "rejected"],
      workflow_status: [
        "quote_draft",
        "quote_pending_accounts",
        "quote_rejected",
        "quote_approved",
        "quote_sent_to_customer",
        "payment_pending_verification",
        "order_active",
        "sent_to_vendor",
        "vendor_dispatched",
        "items_received",
        "delivery_pending_payment",
        "order_on_hold",
        "delivery_unlocked",
        "delivered",
        "closed",
      ],
    },
  },
} as const
