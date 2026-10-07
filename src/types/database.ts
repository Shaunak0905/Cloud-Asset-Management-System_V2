// Supabase database types for the `public` schema.
//
// Maintained by hand in the Supabase CLI's generated format (the project
// applies migrations through the dashboard). Keep in sync with
// supabase/migrations/. If you link the CLI, `npm run db:types` regenerates
// this file; note that columns filled by triggers (assets.asset_id/public_id,
// maintenance_requests.request_number, reported_by, performed_by, uploaded_by,
// and asset_id on history/documents) are optional in Insert here because the
// database sets them.

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
      asset_assignments: {
        Row: {
          asset_id: string;
          assigned_at: string;
          created_at: string;
          created_by: string | null;
          expected_return_at: string | null;
          id: string;
          notes: string | null;
          returned_at: string | null;
          status: Database["public"]["Enums"]["assignment_status"];
          updated_at: string;
          usage_building_id: string;
          usage_room_id: string;
          user_id: string;
        };
        Insert: {
          asset_id: string;
          assigned_at?: string;
          created_at?: string;
          created_by?: string | null;
          expected_return_at?: string | null;
          id?: string;
          notes?: string | null;
          returned_at?: string | null;
          status?: Database["public"]["Enums"]["assignment_status"];
          updated_at?: string;
          usage_building_id: string;
          usage_room_id: string;
          user_id: string;
        };
        Update: {
          asset_id?: string;
          assigned_at?: string;
          created_at?: string;
          created_by?: string | null;
          expected_return_at?: string | null;
          id?: string;
          notes?: string | null;
          returned_at?: string | null;
          status?: Database["public"]["Enums"]["assignment_status"];
          updated_at?: string;
          usage_building_id?: string;
          usage_room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_assignments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_assignments_usage_building_id_fkey";
            columns: ["usage_building_id"];
            isOneToOne: false;
            referencedRelation: "buildings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_assignments_usage_room_fkey";
            columns: ["usage_room_id", "usage_building_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id", "building_id"];
          },
          {
            foreignKeyName: "asset_assignments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_documents: {
        Row: {
          asset_id: string;
          bucket_name: string;
          created_at: string;
          document_type: Database["public"]["Enums"]["document_type"];
          file_size_bytes: number;
          id: string;
          maintenance_request_id: string | null;
          mime_type: string;
          original_filename: string;
          storage_path: string;
          uploaded_by: string;
        };
        Insert: {
          asset_id?: string;
          bucket_name: string;
          created_at?: string;
          document_type: Database["public"]["Enums"]["document_type"];
          file_size_bytes: number;
          id?: string;
          maintenance_request_id?: string | null;
          mime_type: string;
          original_filename: string;
          storage_path: string;
          uploaded_by?: string;
        };
        Update: {
          asset_id?: string;
          bucket_name?: string;
          created_at?: string;
          document_type?: Database["public"]["Enums"]["document_type"];
          file_size_bytes?: number;
          id?: string;
          maintenance_request_id?: string | null;
          mime_type?: string;
          original_filename?: string;
          storage_path?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_documents_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_documents_maintenance_request_fkey";
            columns: ["maintenance_request_id", "asset_id"];
            isOneToOne: false;
            referencedRelation: "maintenance_requests";
            referencedColumns: ["id", "asset_id"];
          },
          {
            foreignKeyName: "asset_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          archived_at: string | null;
          asset_id: string;
          category: string;
          created_at: string;
          created_by: string | null;
          department: string | null;
          description: string | null;
          id: string;
          name: string;
          public_id: string;
          purchase_date: string | null;
          registered_building_id: string;
          registered_room_id: string;
          serial_number: string | null;
          status: Database["public"]["Enums"]["asset_status"];
          updated_at: string;
          warranty_until: string | null;
        };
        Insert: {
          archived_at?: string | null;
          asset_id?: string;
          category: string;
          created_at?: string;
          created_by?: string | null;
          department?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          public_id?: string;
          purchase_date?: string | null;
          registered_building_id: string;
          registered_room_id: string;
          serial_number?: string | null;
          status?: Database["public"]["Enums"]["asset_status"];
          updated_at?: string;
          warranty_until?: string | null;
        };
        Update: {
          archived_at?: string | null;
          asset_id?: string;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          department?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          public_id?: string;
          purchase_date?: string | null;
          registered_building_id?: string;
          registered_room_id?: string;
          serial_number?: string | null;
          status?: Database["public"]["Enums"]["asset_status"];
          updated_at?: string;
          warranty_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_registered_building_id_fkey";
            columns: ["registered_building_id"];
            isOneToOne: false;
            referencedRelation: "buildings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_registered_room_fkey";
            columns: ["registered_room_id", "registered_building_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id", "building_id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json | null;
          new_values: Json | null;
          old_values: Json | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json | null;
          new_values?: Json | null;
          old_values?: Json | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json | null;
          new_values?: Json | null;
          old_values?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      buildings: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      maintenance_history: {
        Row: {
          action: Database["public"]["Enums"]["maintenance_action"];
          asset_id: string;
          created_at: string;
          id: string;
          maintenance_request_id: string;
          notes: string | null;
          performed_at: string;
          performed_by: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["maintenance_action"];
          asset_id?: string;
          created_at?: string;
          id?: string;
          maintenance_request_id: string;
          notes?: string | null;
          performed_at?: string;
          performed_by?: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["maintenance_action"];
          asset_id?: string;
          created_at?: string;
          id?: string;
          maintenance_request_id?: string;
          notes?: string | null;
          performed_at?: string;
          performed_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_history_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_history_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_history_request_fkey";
            columns: ["maintenance_request_id", "asset_id"];
            isOneToOne: false;
            referencedRelation: "maintenance_requests";
            referencedColumns: ["id", "asset_id"];
          },
        ];
      };
      maintenance_requests: {
        Row: {
          asset_id: string;
          assigned_at: string | null;
          assigned_to: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          description: string;
          id: string;
          priority: Database["public"]["Enums"]["maintenance_priority"];
          reported_by: string;
          request_number: string;
          resolution_notes: string | null;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["maintenance_status"];
          updated_at: string;
        };
        Insert: {
          asset_id: string;
          assigned_at?: string | null;
          assigned_to?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          priority?: Database["public"]["Enums"]["maintenance_priority"];
          reported_by?: string;
          request_number?: string;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["maintenance_status"];
          updated_at?: string;
        };
        Update: {
          asset_id?: string;
          assigned_at?: string | null;
          assigned_to?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          priority?: Database["public"]["Enums"]["maintenance_priority"];
          reported_by?: string;
          request_number?: string;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["maintenance_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_requests_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_requests_reported_by_fkey";
            columns: ["reported_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          dedupe_key: string;
          id: string;
          is_read: boolean;
          link: string | null;
          message: string;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          dedupe_key: string;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          message: string;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          dedupe_key?: string;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          message?: string;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          department: string | null;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          department?: string | null;
          email?: string | null;
          full_name: string;
          id: string;
          is_active?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          department?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          building_id: string;
          created_at: string;
          display_name: string | null;
          id: string;
          is_active: boolean;
          room_number: string;
          updated_at: string;
        };
        Insert: {
          building_id: string;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_active?: boolean;
          room_number: string;
          updated_at?: string;
        };
        Update: {
          building_id?: string;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_active?: boolean;
          room_number?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_building_id_fkey";
            columns: ["building_id"];
            isOneToOne: false;
            referencedRelation: "buildings";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_dashboard: {
        Args: { p_month_start: string };
        Returns: Json;
      };
      assign_asset: {
        Args: {
          p_asset_id: string;
          p_user_id: string;
          p_usage_building_id: string;
          p_usage_room_id: string;
          p_expected_return_at?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      assign_technician: {
        Args: { p_request_id: string; p_technician_id: string };
        Returns: undefined;
      };
      cancel_maintenance: {
        Args: { p_reason: string; p_request_id: string };
        Returns: Database["public"]["Enums"]["asset_status"];
      };
      change_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["user_role"];
          target_user_id: string;
        };
        Returns: undefined;
      };
      my_dashboard: {
        Args: never;
        Returns: Json;
      };
      list_asset_departments: {
        Args: never;
        Returns: string[];
      };
      list_open_maintenance: {
        Args: { p_asset_id: string };
        Returns: {
          created_at: string;
          request_number: string;
          status: Database["public"]["Enums"]["maintenance_status"];
        }[];
      };
      report_problem: {
        Args: {
          p_asset_id: string;
          p_description: string;
          p_priority: Database["public"]["Enums"]["maintenance_priority"];
        };
        Returns: string;
      };
      request_asset: {
        Args: {
          p_asset_id: string;
          p_usage_building_id: string;
          p_usage_room_id: string;
          p_expected_return_at?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      get_public_asset: {
        Args: { p_public_id: string };
        Returns: {
          asset_id: string;
          building_code: string;
          building_name: string;
          category: string;
          department: string | null;
          name: string;
          public_id: string;
          room_name: string | null;
          room_number: string;
          status: Database["public"]["Enums"]["asset_status"];
        }[];
      };
      resolve_maintenance: {
        Args: {
          p_asset_status?: Database["public"]["Enums"]["asset_status"] | null;
          p_request_id: string;
          p_resolution_notes: string;
        };
        Returns: Database["public"]["Enums"]["asset_status"];
      };
      return_asset: {
        Args: { p_assignment_id: string };
        Returns: undefined;
      };
      set_user_active: {
        Args: { active: boolean; target_user_id: string };
        Returns: undefined;
      };
      start_maintenance: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      technician_dashboard: {
        Args: { p_month_start: string };
        Returns: Json;
      };
      transfer_asset: {
        Args: {
          p_assignment_id: string;
          p_to_user_id: string;
          p_usage_building_id: string;
          p_usage_room_id: string;
          p_expected_return_at?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      asset_status:
        | "AVAILABLE"
        | "ASSIGNED"
        | "IN_MAINTENANCE"
        | "LOST"
        | "DAMAGED"
        | "RETIRED";
      assignment_status: "ACTIVE" | "RETURNED" | "TRANSFERRED" | "CANCELLED";
      document_type:
        | "ASSET_IMAGE"
        | "MAINTENANCE_IMAGE"
        | "SERVICE_REPORT"
        | "RECEIPT"
        | "OTHER";
      maintenance_action:
        | "REPORTED"
        | "ASSIGNED"
        | "STARTED"
        | "INSPECTION"
        | "DIAGNOSIS"
        | "REPAIR"
        | "PART_REPLACEMENT"
        | "TESTING"
        | "NOTE"
        | "RESOLVED"
        | "CANCELLED";
      maintenance_priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      maintenance_status:
        "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";
      user_role: "ADMIN" | "TECHNICIAN" | "STAFF" | "STUDENT";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      asset_status: [
        "AVAILABLE",
        "ASSIGNED",
        "IN_MAINTENANCE",
        "LOST",
        "DAMAGED",
        "RETIRED",
      ],
      assignment_status: ["ACTIVE", "RETURNED", "TRANSFERRED", "CANCELLED"],
      document_type: [
        "ASSET_IMAGE",
        "MAINTENANCE_IMAGE",
        "SERVICE_REPORT",
        "RECEIPT",
        "OTHER",
      ],
      maintenance_action: [
        "REPORTED",
        "ASSIGNED",
        "STARTED",
        "INSPECTION",
        "DIAGNOSIS",
        "REPAIR",
        "PART_REPLACEMENT",
        "TESTING",
        "NOTE",
        "RESOLVED",
        "CANCELLED",
      ],
      maintenance_priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      maintenance_status: [
        "OPEN",
        "ASSIGNED",
        "IN_PROGRESS",
        "RESOLVED",
        "CANCELLED",
      ],
      user_role: ["ADMIN", "TECHNICIAN", "STAFF", "STUDENT"],
    },
  },
} as const;
