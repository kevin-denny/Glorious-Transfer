import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'administrator' | 'finance' | 'operations';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      drivers: {
        Row: {
          id: string;
          driver_number: string;
          name: string;
          languages: string[];
          vehicle_type: string;
          vehicle_plate: string;
          number_of_rides: number;
          status: 'active' | 'inactive';
          created_at: string;
          created_by: string | null;
        };
      };
      tours: {
        Row: {
          id: string;
          booking_date: string;
          booking_ref: string;
          client_name: string;
          agent: string;
          pax: number;
          contact_details: string;
          arrival_datetime: string;
          departure_datetime: string;
          flight_no: string | null;
          flight_time: string | null;
          remarks: string | null;
          status: 'pending' | 'assigned' | 'completed' | 'cancelled';
          assigned_driver_id: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
      };
      driver_payments: {
        Row: {
          id: string;
          driver_id: string;
          tour_id: string | null;
          amount: number;
          status: 'pending' | 'paid';
          payment_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
      };
      complaints: {
        Row: {
          id: string;
          driver_id: string;
          tour_id: string | null;
          complaint_text: string;
          status: 'open' | 'investigating' | 'resolved';
          created_at: string;
          created_by: string | null;
          resolved_at: string | null;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: 'create' | 'read' | 'update' | 'delete';
          table_name: string;
          record_id: string | null;
          changes: any;
          created_at: string;
        };
      };
    };
  };
};
