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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      // Правка руками (с17): employees + employee_files, миграция 20260823130000.
      // Генератор типов не запускался — при перегенерации блок обязан пересобраться сам.
      employee_files: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          kind: string
          original_name: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          kind: string
          original_name?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          kind?: string
          original_name?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_files_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          birth_date: string | null
          birth_place: string | null
          clearance_expires_at: string | null
          created_at: string
          created_by: string | null
          document_photo_id: string | null
          first_name: string
          id: string
          last_name: string
          middle_name: string | null
          passport_expires_at: string | null
          passport_issued_at: string | null
          passport_issued_by: string | null
          passport_number: string | null
          passport_series: string | null
          phone: string | null
          pinfl: string | null
          position: string | null
          residence_address: string | null
          t_shirt_size: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          birth_place?: string | null
          clearance_expires_at?: string | null
          created_at?: string
          created_by?: string | null
          document_photo_id?: string | null
          first_name: string
          id?: string
          last_name: string
          middle_name?: string | null
          passport_expires_at?: string | null
          passport_issued_at?: string | null
          passport_issued_by?: string | null
          passport_number?: string | null
          passport_series?: string | null
          phone?: string | null
          pinfl?: string | null
          position?: string | null
          residence_address?: string | null
          t_shirt_size?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          birth_place?: string | null
          clearance_expires_at?: string | null
          created_at?: string
          created_by?: string | null
          document_photo_id?: string | null
          first_name?: string
          id?: string
          last_name?: string
          middle_name?: string | null
          passport_expires_at?: string | null
          passport_issued_at?: string | null
          passport_issued_by?: string | null
          passport_number?: string | null
          passport_series?: string | null
          phone?: string | null
          pinfl?: string | null
          position?: string | null
          residence_address?: string | null
          t_shirt_size?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_document_photo_fkey"
            columns: ["id", "document_photo_id"]
            isOneToOne: false
            referencedRelation: "employee_files"
            referencedColumns: ["employee_id", "id"]
          },
        ]
      }
      equipment: {
        Row: {
          availability: string | null
          brand: string
          count: number | null
          created_at: string | null
          description: string | null
          id: string
          lengthinmeters: string | null
          location: string
          model: string
          serialnumber: string
          subtype: string
          technicalspecification: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          availability?: string | null
          brand: string
          count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          lengthinmeters?: string | null
          location: string
          model: string
          serialnumber: string
          subtype: string
          technicalspecification?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          availability?: string | null
          brand?: string
          count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          lengthinmeters?: string | null
          location?: string
          model?: string
          serialnumber?: string
          subtype?: string
          technicalspecification?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      equipment_lists: {
        Row: {
          client_name: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          equipment_ids: string[]
          equipment_items: Json | null
          event_id: string | null
          id: string
          is_archived: boolean | null
          list_mode: string | null
          metadata: Json | null
          mount_point_id: string | null
          name: string
          reservation_end: string | null
          reservation_start: string | null
          type: string
          updated_at: string | null
          venue: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          equipment_ids?: string[]
          equipment_items?: Json | null
          event_id?: string | null
          id?: string
          is_archived?: boolean | null
          list_mode?: string | null
          metadata?: Json | null
          mount_point_id?: string | null
          name: string
          reservation_end?: string | null
          reservation_start?: string | null
          type: string
          updated_at?: string | null
          venue?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          equipment_ids?: string[]
          equipment_items?: Json | null
          event_id?: string | null
          id?: string
          is_archived?: boolean | null
          list_mode?: string | null
          metadata?: Json | null
          mount_point_id?: string | null
          name?: string
          reservation_end?: string | null
          reservation_start?: string | null
          type?: string
          updated_at?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_lists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_lists_mount_point_id_fkey"
            columns: ["mount_point_id"]
            isOneToOne: false
            referencedRelation: "mount_points"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_movements: {
        Row: {
          changed_at: string
          changed_by: string | null
          equipment_id: string
          id: string
          list_id: string | null
          metadata: Json
          movement_type: string
          note: string | null
          quantity_after: number | null
          quantity_before: number | null
          quantity_delta: number
          status_after: string | null
          status_before: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          equipment_id: string
          id?: string
          list_id?: string | null
          metadata?: Json
          movement_type: string
          note?: string | null
          quantity_after?: number | null
          quantity_before?: number | null
          quantity_delta?: number
          status_after?: string | null
          status_before?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          equipment_id?: string
          id?: string
          list_id?: string | null
          metadata?: Json
          movement_type?: string
          note?: string | null
          quantity_after?: number | null
          quantity_before?: number | null
          quantity_delta?: number
          status_after?: string | null
          status_before?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_movements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_movements_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "equipment_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          is_archived: boolean
          location: string
          mount_points_count: number
          name: string
          organizer: string
          photos: string[] | null
          responsible_engineers: string[]
          setup_date: string | null
          start_date: string | null
          teardown_date: string | null
          technical_task: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_archived?: boolean
          location: string
          mount_points_count?: number
          name: string
          organizer: string
          photos?: string[] | null
          responsible_engineers: string[]
          setup_date?: string | null
          start_date?: string | null
          teardown_date?: string | null
          technical_task?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_archived?: boolean
          location?: string
          mount_points_count?: number
          name?: string
          organizer?: string
          photos?: string[] | null
          responsible_engineers?: string[]
          setup_date?: string | null
          start_date?: string | null
          teardown_date?: string | null
          technical_task?: string | null
        }
        Relationships: []
      }
      // Правка руками (с20): hall_plans + halls, миграция 20260824090000;
      // hall_assignments + plan_positions вместо hall_positions — миграция
      // 20260824110000. Генератор типов не запускался — при перегенерации блоки
      // обязаны пересобраться сами.
      // employee_id стал NOT NULL, sort_order снят — миграция 20260824140000
      // («одна ячейка — один человек», вакансия теперь пустая клетка).
      hall_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          hall_id: string
          id: string
          plan_id: string
          position_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          hall_id: string
          id?: string
          plan_id: string
          position_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          hall_id?: string
          id?: string
          plan_id?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hall_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hall_assignments_hall_fkey"
            columns: ["hall_id", "plan_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id", "plan_id"]
          },
          {
            foreignKeyName: "hall_assignments_position_fkey"
            columns: ["position_id", "plan_id"]
            isOneToOne: false
            referencedRelation: "plan_positions"
            referencedColumns: ["id", "plan_id"]
          },
        ]
      }
      hall_plans: {
        Row: {
          created_at: string
          created_by: string | null
          event_from: string | null
          event_to: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_from?: string | null
          event_to?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_from?: string | null
          event_to?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      halls: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          plan_id: string
          sort_order: number
        }
        Insert: {
          color: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          plan_id: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          plan_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "halls_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "hall_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mount_points: {
        Row: {
          equipment_fact: string[]
          equipment_final: string[]
          equipment_plan: string[]
          event_id: string
          id: string
          location: string | null
          name: string
          responsible_engineers: string[]
          start_date: string | null
          status: string | null
          technical_duties: Json | null
        }
        Insert: {
          equipment_fact: string[]
          equipment_final: string[]
          equipment_plan: string[]
          event_id: string
          id?: string
          location?: string | null
          name: string
          responsible_engineers: string[]
          start_date?: string | null
          status?: string | null
          technical_duties?: Json | null
        }
        Update: {
          equipment_fact?: string[]
          equipment_final?: string[]
          equipment_plan?: string[]
          event_id?: string
          id?: string
          location?: string | null
          name?: string
          responsible_engineers?: string[]
          start_date?: string | null
          status?: string | null
          technical_duties?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mount_points_event_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mount_points_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      // Правка руками (с20, миграция 20260824110000): строки матрицы залов.
      plan_positions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          plan_id: string
          role: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          plan_id: string
          role?: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          plan_id?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_positions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "hall_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      // Правка руками (с20, миграция 20260824120000): справочник позиций.
      position_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          role?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          content: Json
          created_at: string | null
          event_id: string
          generated_at: string
          id: string
        }
        Insert: {
          content: Json
          created_at?: string | null
          event_id: string
          generated_at?: string
          id?: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          event_id?: string
          generated_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          email: string
          id: string
          name: string
          role: string
          shifts_count: number
        }
        Insert: {
          email: string
          id?: string
          name: string
          role: string
          shifts_count?: number
        }
        Update: {
          email?: string
          id?: string
          name?: string
          role?: string
          shifts_count?: number
        }
        Relationships: []
      }
      // Правка руками (с18): vehicles + vehicle_drivers + vehicle_files, миграция
      // 20260823150000. Генератор типов не запускался — при перегенерации блок
      // обязан пересобраться сам.
      vehicle_drivers: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_drivers_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_drivers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_files: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          original_name: string | null
          storage_path: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          original_name?: string | null
          storage_path: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          original_name?: string | null
          storage_path?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_files_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          plate_number: string
          updated_at: string
        }
        Insert: {
          brand: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          plate_number: string
          updated_at?: string
        }
        Update: {
          brand?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          plate_number?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      // ПРАВКА РУКАМИ: функция заведена миграцией 20260823120000 (с16), типы
      // дописаны вслед за ней. Серийник и количество опциональны — дефолты
      // задаёт сама функция (null и 1).
      add_equipment_unit: {
        Args: {
          p_sample_id: string
          p_serialnumber?: string | null
          p_count?: number
        }
        Returns: Json
      }
      // ПРАВКА РУКАМИ: функция заведена миграцией 20260823080000, типы дописаны
      // вслед за ней — генератор с прода не перезапускался. С 20260823090000
      // возврат jsonb {status, count} — клиент разбирает и старую строку тоже.
      append_equipment_to_list: {
        Args: {
          p_equipment_id: string
          p_list_id: string
          p_tracking_mode: string
        }
        Returns: Json
      }
      count_equipment_model_units: {
        Args: { p_brand: string; p_model: string }
        Returns: number
      }
      // ПРАВКА РУКАМИ: функция заведена миграцией 20260823110000, типы дописаны
      // вслед за ней — генератор с прода не перезапускался.
      fetch_equipment_models: {
        Args: {
          p_availability: string
          p_limit: number
          p_offset: number
          p_search: string
          p_subtype: string
          p_type: string
        }
        Returns: Json
      }
      // ПРАВКА РУКАМИ: функция заведена миграцией 20260823100000, типы дописаны
      // вслед за ней — генератор с прода не перезапускался.
      create_equipment_batch: {
        Args: {
          p_availability: string
          p_brand: string
          p_description: string
          p_lengthinmeters: string
          p_location: string
          p_model: string
          p_serialnumbers: string[]
          p_subtype: string
          p_technicalspecification: string
          p_type: string
        }
        Returns: Json
      }
      create_equipment_list_document: {
        Args: {
          p_client_name: string
          p_description: string
          p_items: Json
          p_list_mode: string
          p_name: string
          // ПРАВКА РУКАМИ: генератор не выражает nullable-аргументы, а в SQL это
          // `date` без default, и функция явно разрешает пустую пару дат
          // (baseline: «Reservation dates must be both empty or …»).
          p_reservation_end: string | null
          p_reservation_start: string | null
          p_venue: string
        }
        Returns: string
      }
      create_equipment_list_with_items: {
        Args: {
          p_description: string
          p_items: Json
          p_list_mode: string
          p_name: string
          // ПРАВКА РУКАМИ: см. комментарий выше — пустая пара дат допустима.
          p_reservation_end: string | null
          p_reservation_start: string | null
        }
        Returns: string
      }
      update_equipment_list_document: {
        Args: {
          p_client_name: string
          p_description: string
          p_items: Json
          p_list_id: string
          p_list_mode: string
          p_name: string
          // ПРАВКА РУКАМИ: см. комментарий у create_equipment_list_document.
          p_reservation_end: string | null
          p_reservation_start: string | null
          p_venue: string
        }
        Returns: string
      }
      update_equipment_model_and_unit: {
        Args: {
          p_availability: string
          p_brand: string
          // ПРАВКА РУКАМИ: p_count стал необязательным (не прислали — count
          // остаётся прежним), p_expected_updated_at — версия карточки для
          // оптимистической блокировки; null означает «не сверять».
          p_count?: number
          p_description: string
          p_equipment_id: string
          p_expected_updated_at?: string | null
          p_lengthinmeters: string
          p_location: string
          p_model: string
          p_subtype: string
          p_technicalspecification: string
          p_type: string
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
    Enums: {},
  },
} as const
