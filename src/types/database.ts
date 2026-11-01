export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          company_id: string
          created_at: string
          entity_ref: string
          entity_type: string
          id: string
          is_sample: boolean
          kind: string
          message: string
          meta: Json
        }
        Insert: {
          company_id?: string
          created_at?: string
          entity_ref?: string
          entity_type?: string
          id?: string
          is_sample?: boolean
          kind: string
          message: string
          meta?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          entity_ref?: string
          entity_type?: string
          id?: string
          is_sample?: boolean
          kind?: string
          message?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'activity_log_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      ai_scans: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          input_paths: string[]
          kind: string
          model: string
          parsed_items: Json
          raw_response: Json
          status: string
          transcript: string
          trip_id: string | null
          via_loader: boolean
          warnings: Json
        }
        Insert: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          input_paths?: string[]
          kind: string
          model?: string
          parsed_items?: Json
          raw_response?: Json
          status?: string
          transcript?: string
          trip_id?: string | null
          via_loader?: boolean
          warnings?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          input_paths?: string[]
          kind?: string
          model?: string
          parsed_items?: Json
          raw_response?: Json
          status?: string
          transcript?: string
          trip_id?: string | null
          via_loader?: boolean
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'ai_scans_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_scans_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_financials'
            referencedColumns: ['trip_id']
          },
          {
            foreignKeyName: 'ai_scans_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_scans_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      alerts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_sample: boolean
          kind: string
          message: string
          meta: Json
          resolved: boolean
          resolved_at: string | null
          severity: string
          title: string
          trip_id: string | null
          truck_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          kind: string
          message?: string
          meta?: Json
          resolved?: boolean
          resolved_at?: string | null
          severity: string
          title: string
          trip_id?: string | null
          truck_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          kind?: string
          message?: string
          meta?: Json
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title?: string
          trip_id?: string | null
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'alerts_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alerts_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_financials'
            referencedColumns: ['trip_id']
          },
          {
            foreignKeyName: 'alerts_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alerts_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alerts_truck_id_fkey'
            columns: ['truck_id']
            isOneToOne: false
            referencedRelation: 'trucks'
            referencedColumns: ['id']
          },
        ]
      }
      cargo_items: {
        Row: {
          added_by_loader: boolean
          client_name: string
          company_id: string
          confidence: number | null
          created_at: string
          drop_stop_id: string
          extra_load_id: string | null
          fragile: boolean
          height_cm: number
          id: string
          image_path: string | null
          label: string
          length_cm: number
          max_top_load_kg: number | null
          pickup_stop_id: string | null
          priority: string
          quantity: number
          sku: string
          source: string
          stackable: boolean
          trip_id: string
          upright_only: boolean
          weight_kg: number
          width_cm: number
        }
        Insert: {
          added_by_loader?: boolean
          client_name?: string
          company_id?: string
          confidence?: number | null
          created_at?: string
          drop_stop_id: string
          extra_load_id?: string | null
          fragile?: boolean
          height_cm: number
          id?: string
          image_path?: string | null
          label: string
          length_cm: number
          max_top_load_kg?: number | null
          pickup_stop_id?: string | null
          priority?: string
          quantity?: number
          sku?: string
          source?: string
          stackable?: boolean
          trip_id: string
          upright_only?: boolean
          weight_kg: number
          width_cm: number
        }
        Update: {
          added_by_loader?: boolean
          client_name?: string
          company_id?: string
          confidence?: number | null
          created_at?: string
          drop_stop_id?: string
          extra_load_id?: string | null
          fragile?: boolean
          height_cm?: number
          id?: string
          image_path?: string | null
          label?: string
          length_cm?: number
          max_top_load_kg?: number | null
          pickup_stop_id?: string | null
          priority?: string
          quantity?: number
          sku?: string
          source?: string
          stackable?: boolean
          trip_id?: string
          upright_only?: boolean
          weight_kg?: number
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: 'cargo_items_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cargo_items_drop_stop_id_fkey'
            columns: ['drop_stop_id']
            isOneToOne: false
            referencedRelation: 'trip_stops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cargo_items_extra_load_id_fkey'
            columns: ['extra_load_id']
            isOneToOne: false
            referencedRelation: 'trip_extra_loads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cargo_items_pickup_stop_id_fkey'
            columns: ['pickup_stop_id']
            isOneToOne: false
            referencedRelation: 'trip_stops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cargo_items_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_financials'
            referencedColumns: ['trip_id']
          },
          {
            foreignKeyName: 'cargo_items_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cargo_items_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      companies: {
        Row: {
          city: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          phone: string
          sample_seeded_at: string | null
        }
        Insert: {
          city?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          phone?: string
          sample_seeded_at?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          phone?: string
          sample_seeded_at?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          avg_speed_kmph: number
          break_after_drive_h: number
          break_min: number
          cargo_unit: string
          checkpoint_delay_min: number
          company_id: string
          corridor_km: number
          delay_penalty_inr_per_min: number
          diesel_price_inr_per_l: number
          driver_cost_inr_per_h: number
          handling_inr_per_kg: number
          max_drive_h_per_day: number
          min_margin_inr: number
          overnight_rest_h: number
          road_factor: number
          support_ratio: number
          updated_at: string
          value_of_time_inr_per_h: number
          waiting_cost_inr_per_h: number
        }
        Insert: {
          avg_speed_kmph?: number
          break_after_drive_h?: number
          break_min?: number
          cargo_unit?: string
          checkpoint_delay_min?: number
          company_id: string
          corridor_km?: number
          delay_penalty_inr_per_min?: number
          diesel_price_inr_per_l?: number
          driver_cost_inr_per_h?: number
          handling_inr_per_kg?: number
          max_drive_h_per_day?: number
          min_margin_inr?: number
          overnight_rest_h?: number
          road_factor?: number
          support_ratio?: number
          updated_at?: string
          value_of_time_inr_per_h?: number
          waiting_cost_inr_per_h?: number
        }
        Update: {
          avg_speed_kmph?: number
          break_after_drive_h?: number
          break_min?: number
          cargo_unit?: string
          checkpoint_delay_min?: number
          company_id?: string
          corridor_km?: number
          delay_penalty_inr_per_min?: number
          diesel_price_inr_per_l?: number
          driver_cost_inr_per_h?: number
          handling_inr_per_kg?: number
          max_drive_h_per_day?: number
          min_margin_inr?: number
          overnight_rest_h?: number
          road_factor?: number
          support_ratio?: number
          updated_at?: string
          value_of_time_inr_per_h?: number
          waiting_cost_inr_per_h?: number
        }
        Relationships: [
          {
            foreignKeyName: 'company_settings_company_id_fkey'
            columns: ['company_id']
            isOneToOne: true
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      fleet_daily_stats: {
        Row: {
          company_id: string
          cost_inr: number
          day: string
          delayed_pct: number
          distance_km: number
          extra_load_revenue_inr: number
          is_sample: boolean
          on_time_pct: number
          revenue_inr: number
          utilisation_pct: number
        }
        Insert: {
          company_id?: string
          cost_inr?: number
          day: string
          delayed_pct: number
          distance_km: number
          extra_load_revenue_inr?: number
          is_sample?: boolean
          on_time_pct: number
          revenue_inr?: number
          utilisation_pct: number
        }
        Update: {
          company_id?: string
          cost_inr?: number
          day?: string
          delayed_pct?: number
          distance_km?: number
          extra_load_revenue_inr?: number
          is_sample?: boolean
          on_time_pct?: number
          revenue_inr?: number
          utilisation_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: 'fleet_daily_stats_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      freight_listings: {
        Row: {
          accepted_by_company: string | null
          code: string
          company_id: string
          created_at: string
          deliver_by: string | null
          description: string
          drop_lat: number
          drop_lng: number
          drop_name: string
          fragile: boolean
          goods_type: string
          height_cm: number
          id: string
          is_sample: boolean
          length_cm: number
          offered_rate_inr: number
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          posted_by: string | null
          provider_id: string | null
          provider_link_id: string | null
          quantity: number
          ready_from: string | null
          share_token: string | null
          shipper_name: string
          shipper_phone: string
          stackable: boolean
          status: string
          upright_only: boolean
          visibility: string
          weight_kg: number
          width_cm: number
        }
        Insert: {
          accepted_by_company?: string | null
          code: string
          company_id?: string
          created_at?: string
          deliver_by?: string | null
          description?: string
          drop_lat: number
          drop_lng: number
          drop_name: string
          fragile?: boolean
          goods_type: string
          height_cm: number
          id?: string
          is_sample?: boolean
          length_cm: number
          offered_rate_inr: number
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          posted_by?: string | null
          provider_id?: string | null
          provider_link_id?: string | null
          quantity?: number
          ready_from?: string | null
          share_token?: string | null
          shipper_name: string
          shipper_phone?: string
          stackable?: boolean
          status?: string
          upright_only?: boolean
          visibility?: string
          weight_kg: number
          width_cm: number
        }
        Update: {
          accepted_by_company?: string | null
          code?: string
          company_id?: string
          created_at?: string
          deliver_by?: string | null
          description?: string
          drop_lat?: number
          drop_lng?: number
          drop_name?: string
          fragile?: boolean
          goods_type?: string
          height_cm?: number
          id?: string
          is_sample?: boolean
          length_cm?: number
          offered_rate_inr?: number
          pickup_lat?: number
          pickup_lng?: number
          pickup_name?: string
          posted_by?: string | null
          provider_id?: string | null
          provider_link_id?: string | null
          quantity?: number
          ready_from?: string | null
          share_token?: string | null
          shipper_name?: string
          shipper_phone?: string
          stackable?: boolean
          status?: string
          upright_only?: boolean
          visibility?: string
          weight_kg?: number
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: 'freight_listings_accepted_by_company_fkey'
            columns: ['accepted_by_company']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'freight_listings_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'freight_listings_provider_id_fkey'
            columns: ['provider_id']
            isOneToOne: false
            referencedRelation: 'providers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'freight_listings_provider_link_id_fkey'
            columns: ['provider_link_id']
            isOneToOne: false
            referencedRelation: 'provider_links'
            referencedColumns: ['id']
          },
        ]
      }
      listing_offers: {
        Row: {
          amount_inr: number
          answered_at: string | null
          company_id: string
          created_at: string
          id: string
          listing_id: string
          note: string
          status: string
        }
        Insert: {
          amount_inr: number
          answered_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          listing_id: string
          note?: string
          status?: string
        }
        Update: {
          amount_inr?: number
          answered_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          note?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'listing_offers_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'listing_offers_listing_id_fkey'
            columns: ['listing_id']
            isOneToOne: false
            referencedRelation: 'freight_listings'
            referencedColumns: ['id']
          },
        ]
      }
      load_plans: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          engine_version: string
          id: string
          input_hash: string
          metrics: Json
          placements: Json
          status: string
          trip_id: string
          unplaced: Json
          version: number
        }
        Insert: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          engine_version: string
          id?: string
          input_hash: string
          metrics?: Json
          placements?: Json
          status?: string
          trip_id: string
          unplaced?: Json
          version: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          engine_version?: string
          id?: string
          input_hash?: string
          metrics?: Json
          placements?: Json
          status?: string
          trip_id?: string
          unplaced?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'load_plans_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'load_plans_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_financials'
            referencedColumns: ['trip_id']
          },
          {
            foreignKeyName: 'load_plans_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'load_plans_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      loading_progress: {
        Row: {
          company_id: string
          id: string
          load_plan_id: string
          note: string
          placement_key: string
          status: string
          step_index: number
          updated_at: string
        }
        Insert: {
          company_id?: string
          id?: string
          load_plan_id: string
          note?: string
          placement_key: string
          status?: string
          step_index: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          id?: string
          load_plan_id?: string
          note?: string
          placement_key?: string
          status?: string
          step_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'loading_progress_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'loading_progress_load_plan_id_fkey'
            columns: ['load_plan_id']
            isOneToOne: false
            referencedRelation: 'load_plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'loading_progress_load_plan_id_fkey'
            columns: ['load_plan_id']
            isOneToOne: false
            referencedRelation: 'trip_overview'
            referencedColumns: ['active_plan_id']
          },
        ]
      }
      pois: {
        Row: {
          city: string
          created_at: string
          data: Json
          highway: string
          id: string
          is_sample: boolean
          kind: string
          lat: number
          lng: number
          name: string
          source: string
          state: string
        }
        Insert: {
          city?: string
          created_at?: string
          data?: Json
          highway?: string
          id?: string
          is_sample?: boolean
          kind: string
          lat: number
          lng: number
          name: string
          source?: string
          state?: string
        }
        Update: {
          city?: string
          created_at?: string
          data?: Json
          highway?: string
          id?: string
          is_sample?: boolean
          kind?: string
          lat?: number
          lng?: number
          name?: string
          source?: string
          state?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          preferred_lang: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string
          full_name?: string
          id: string
          preferred_lang?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          preferred_lang?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      provider_links: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          token: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          token: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: 'provider_links_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      providers: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_sample: boolean
          kind: string
          link_id: string | null
          name: string
          phone: string
          portal_token: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_sample?: boolean
          kind: string
          link_id?: string | null
          name: string
          phone: string
          portal_token: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          kind?: string
          link_id?: string | null
          name?: string
          phone?: string
          portal_token?: string
        }
        Relationships: [
          {
            foreignKeyName: 'providers_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'providers_link_id_fkey'
            columns: ['link_id']
            isOneToOne: false
            referencedRelation: 'provider_links'
            referencedColumns: ['id']
          },
        ]
      }
      route_cache: {
        Row: {
          created_at: string
          key: string
          response: Json
        }
        Insert: {
          created_at?: string
          key: string
          response: Json
        }
        Update: {
          created_at?: string
          key?: string
          response?: Json
        }
        Relationships: []
      }
      route_options: {
        Row: {
          checkpoint_count: number
          company_id: string
          created_at: string
          distance_km: number
          driver_cost_inr: number
          duration_min: number
          fuel_cost_inr: number
          geometry: Json
          halts: Json
          id: string
          is_selected: boolean
          profile: string
          provider: string
          score: number
          toll_cost_inr: number
          toll_count: number
          total_cost_inr: number
          trip_id: string
          variant: string
          waiting_cost_inr: number
          warnings: Json
        }
        Insert: {
          checkpoint_count?: number
          company_id?: string
          created_at?: string
          distance_km: number
          driver_cost_inr?: number
          duration_min: number
          fuel_cost_inr?: number
          geometry: Json
          halts?: Json
          id?: string
          is_selected?: boolean
          profile?: string
          provider?: string
          score?: number
          toll_cost_inr?: number
          toll_count?: number
          total_cost_inr?: number
          trip_id: string
          variant: string
          waiting_cost_inr?: number
          warnings?: Json
        }
        Update: {
          checkpoint_count?: number
          company_id?: string
          created_at?: string
          distance_km?: number
          driver_cost_inr?: number
          duration_min?: number
          fuel_cost_inr?: number
          geometry?: Json
          halts?: Json
          id?: string
          is_selected?: boolean
          profile?: string
          provider?: string
          score?: number
          toll_cost_inr?: number
          toll_count?: number
          total_cost_inr?: number
          trip_id?: string
          variant?: string
          waiting_cost_inr?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'route_options_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'route_options_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_financials'
            referencedColumns: ['trip_id']
          },
          {
            foreignKeyName: 'route_options_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'route_options_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      trip_expenses: {
        Row: {
          added_by: string
          amount_inr: number
          company_id: string
          created_at: string
          id: string
          kind: string
          note: string
          trip_id: string
        }
        Insert: {
          added_by?: string
          amount_inr: number
          company_id?: string
          created_at?: string
          id?: string
          kind: string
          note?: string
          trip_id: string
        }
        Update: {
          added_by?: string
          amount_inr?: number
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          note?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trip_expenses_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_expenses_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_financials'
            referencedColumns: ['trip_id']
          },
          {
            foreignKeyName: 'trip_expenses_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_expenses_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      trip_extra_loads: {
        Row: {
          company_id: string
          cost_breakdown: Json
          created_at: string
          detour_km: number | null
          detour_min: number | null
          drop_stop_id: string | null
          feasibility: Json
          id: string
          incremental_cost_inr: number | null
          listing_id: string
          min_viable_rate_inr: number | null
          net_benefit_inr: number | null
          pickup_stop_id: string | null
          status: string
          trip_id: string
        }
        Insert: {
          company_id?: string
          cost_breakdown?: Json
          created_at?: string
          detour_km?: number | null
          detour_min?: number | null
          drop_stop_id?: string | null
          feasibility?: Json
          id?: string
          incremental_cost_inr?: number | null
          listing_id: string
          min_viable_rate_inr?: number | null
          net_benefit_inr?: number | null
          pickup_stop_id?: string | null
          status?: string
          trip_id: string
        }
        Update: {
          company_id?: string
          cost_breakdown?: Json
          created_at?: string
          detour_km?: number | null
          detour_min?: number | null
          drop_stop_id?: string | null
          feasibility?: Json
          id?: string
          incremental_cost_inr?: number | null
          listing_id?: string
          min_viable_rate_inr?: number | null
          net_benefit_inr?: number | null
          pickup_stop_id?: string | null
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trip_extra_loads_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_extra_loads_drop_stop_id_fkey'
            columns: ['drop_stop_id']
            isOneToOne: false
            referencedRelation: 'trip_stops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_extra_loads_listing_id_fkey'
            columns: ['listing_id']
            isOneToOne: false
            referencedRelation: 'freight_listings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_extra_loads_pickup_stop_id_fkey'
            columns: ['pickup_stop_id']
            isOneToOne: false
            referencedRelation: 'trip_stops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_extra_loads_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_financials'
            referencedColumns: ['trip_id']
          },
          {
            foreignKeyName: 'trip_extra_loads_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_extra_loads_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      trip_stops: {
        Row: {
          city: string
          company_id: string
          created_at: string
          eta: string | null
          id: string
          lat: number
          lng: number
          name: string
          seq: number
          status: string
          stop_type: string
          trip_id: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          city?: string
          company_id?: string
          created_at?: string
          eta?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          seq: number
          status?: string
          stop_type: string
          trip_id: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          city?: string
          company_id?: string
          created_at?: string
          eta?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          seq?: number
          status?: string
          stop_type?: string
          trip_id?: string
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'trip_stops_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_stops_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_financials'
            referencedColumns: ['trip_id']
          },
          {
            foreignKeyName: 'trip_stops_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trip_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_stops_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      trips: {
        Row: {
          actual_departure: string | null
          base_freight_inr: number
          code: string
          company_id: string
          completed_at: string | null
          created_at: string
          driver_link_enabled: boolean
          driver_name: string
          driver_phone: string
          driver_token: string | null
          id: string
          is_sample: boolean
          loader_link_enabled: boolean
          loader_token: string | null
          loader_token_expires_at: string | null
          notes: string
          planned_departure: string | null
          selected_route_id: string | null
          status: string
          truck_id: string
          updated_at: string
        }
        Insert: {
          actual_departure?: string | null
          base_freight_inr?: number
          code: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          driver_link_enabled?: boolean
          driver_name?: string
          driver_phone?: string
          driver_token?: string | null
          id?: string
          is_sample?: boolean
          loader_link_enabled?: boolean
          loader_token?: string | null
          loader_token_expires_at?: string | null
          notes?: string
          planned_departure?: string | null
          selected_route_id?: string | null
          status?: string
          truck_id: string
          updated_at?: string
        }
        Update: {
          actual_departure?: string | null
          base_freight_inr?: number
          code?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          driver_link_enabled?: boolean
          driver_name?: string
          driver_phone?: string
          driver_token?: string | null
          id?: string
          is_sample?: boolean
          loader_link_enabled?: boolean
          loader_token?: string | null
          loader_token_expires_at?: string | null
          notes?: string
          planned_departure?: string | null
          selected_route_id?: string | null
          status?: string
          truck_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trips_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trips_selected_route_fk'
            columns: ['selected_route_id']
            isOneToOne: false
            referencedRelation: 'route_options'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trips_truck_id_fkey'
            columns: ['truck_id']
            isOneToOne: false
            referencedRelation: 'trucks'
            referencedColumns: ['id']
          },
        ]
      }
      trucks: {
        Row: {
          axles: number
          body_type: string
          company_id: string
          cost_per_km_inr: number
          created_at: string
          door_position: string
          driver_name: string
          driver_phone: string
          fuel_type: string
          gross_weight_kg: number | null
          home_city: string
          id: string
          internal_height_cm: number
          internal_length_cm: number
          internal_width_cm: number
          is_sample: boolean
          last_lat: number | null
          last_lng: number | null
          mileage_kmpl: number
          model: string
          payload_kg: number
          reg_no: string
          status: string
          updated_at: string
        }
        Insert: {
          axles?: number
          body_type?: string
          company_id?: string
          cost_per_km_inr?: number
          created_at?: string
          door_position?: string
          driver_name?: string
          driver_phone?: string
          fuel_type?: string
          gross_weight_kg?: number | null
          home_city?: string
          id?: string
          internal_height_cm: number
          internal_length_cm: number
          internal_width_cm: number
          is_sample?: boolean
          last_lat?: number | null
          last_lng?: number | null
          mileage_kmpl?: number
          model?: string
          payload_kg: number
          reg_no: string
          status?: string
          updated_at?: string
        }
        Update: {
          axles?: number
          body_type?: string
          company_id?: string
          cost_per_km_inr?: number
          created_at?: string
          door_position?: string
          driver_name?: string
          driver_phone?: string
          fuel_type?: string
          gross_weight_kg?: number | null
          home_city?: string
          id?: string
          internal_height_cm?: number
          internal_length_cm?: number
          internal_width_cm?: number
          is_sample?: boolean
          last_lat?: number | null
          last_lng?: number | null
          mileage_kmpl?: number
          model?: string
          payload_kg?: number
          reg_no?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trucks_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          active_trucks: number | null
          avg_utilisation_pct: number | null
          drivers_on_duty: number | null
          live_trips: number | null
          on_time_pct: number | null
          total_drivers: number | null
          total_trucks: number | null
        }
        Relationships: []
      }
      trip_financials: {
        Row: {
          base_freight_inr: number | null
          challan_cost_inr: number | null
          code: string | null
          company_id: string | null
          completed_at: string | null
          distance_km: number | null
          driver_name: string | null
          extra_cost_inr: number | null
          extra_revenue_inr: number | null
          misc_cost_inr: number | null
          net_earnings_inr: number | null
          planned_departure: string | null
          route_cost_inr: number | null
          status: string | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'trips_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      trip_overview: {
        Row: {
          active_plan_id: string | null
          actual_departure: string | null
          base_freight_inr: number | null
          cargo_units: number | null
          cargo_volume_m3: number | null
          cargo_weight_kg: number | null
          code: string | null
          company_id: string | null
          final_stop_name: string | null
          id: string | null
          model: string | null
          origin_name: string | null
          payload_kg: number | null
          plan_volume_used_pct: number | null
          plan_weight_used_pct: number | null
          planned_departure: string | null
          reg_no: string | null
          route_distance_km: number | null
          route_duration_min: number | null
          route_total_cost_inr: number | null
          status: string | null
          stop_count: number | null
          truck_id: string | null
          truck_volume_m3: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'trips_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trips_truck_id_fkey'
            columns: ['truck_id']
            isOneToOne: false
            referencedRelation: 'trucks'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      _phone_key: { Args: { p: string }; Returns: string }
      _provider_load_fields: { Args: { p: Json }; Returns: Json }
      _seed_company: { Args: { p_company: string }; Returns: undefined }
      _seed_company_missing_trucks_guard: {
        Args: { p_company: string }
        Returns: undefined
      }
      _seed_more_loads: { Args: { p_company: string }; Returns: undefined }
      accept_extra_load: {
        Args: {
          p_drop_after_seq: number
          p_extra_load_id: string
          p_pickup_after_seq: number
        }
        Returns: Json
      }
      activate_load_plan: { Args: { p_plan_id: string }; Returns: undefined }
      check_report_token: { Args: { p_token: string }; Returns: boolean }
      create_driver_link: { Args: { p_trip_id: string }; Returns: Json }
      create_loader_link: { Args: { p_trip_id: string }; Returns: Json }
      create_trip_with_stops: {
        Args: {
          p_base_freight_inr: number
          p_driver_name?: string
          p_driver_phone?: string
          p_planned_departure: string
          p_stops: Json
          p_truck_id: string
        }
        Returns: Json
      }
      current_company_id: { Args: never; Returns: string }
      disable_driver_link: { Args: { p_trip_id: string }; Returns: undefined }
      disable_loader_link: { Args: { p_trip_id: string }; Returns: undefined }
      driver_add_expense: {
        Args: {
          p_amount: number
          p_kind: string
          p_note?: string
          p_token: string
        }
        Returns: Json
      }
      driver_get_trip: { Args: { p_token: string }; Returns: Json }
      driver_mark_stop: {
        Args: { p_status: string; p_stop_id: string; p_token: string }
        Returns: Json
      }
      get_provider_link: { Args: { p_new?: boolean }; Returns: Json }
      km_between: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      loader_add_cargo: {
        Args: { p_items: Json; p_source: string; p_token: string }
        Returns: Json
      }
      loader_delete_cargo: {
        Args: { p_id: string; p_token: string }
        Returns: Json
      }
      loader_get_job: { Args: { p_token: string }; Returns: Json }
      loader_my_cargo: { Args: { p_token: string }; Returns: Json }
      loader_trip_for_token: {
        Args: { p_token: string }
        Returns: {
          company_id: string
          trip_id: string
        }[]
      }
      loader_update_cargo: {
        Args: { p_id: string; p_item: Json; p_token: string }
        Returns: Json
      }
      loader_update_step: {
        Args: {
          p_note?: string
          p_plan_id: string
          p_status: string
          p_step: number
          p_token: string
        }
        Returns: Json
      }
      next_listing_code: { Args: never; Returns: string }
      next_trip_code: { Args: never; Returns: string }
      provider_answer_offer: {
        Args: { p_accept: boolean; p_offer_id: string; p_share: string }
        Returns: Json
      }
      provider_cancel_load: { Args: { p_share: string }; Returns: Json }
      provider_get_load: { Args: { p_share: string }; Returns: Json }
      provider_join: {
        Args: {
          p_kind: string
          p_name: string
          p_phone: string
          p_token: string
        }
        Returns: Json
      }
      provider_link_info: { Args: { p_token: string }; Returns: Json }
      provider_portal: { Args: { p_portal: string }; Returns: Json }
      provider_portal_post: {
        Args: { p_loads: Json; p_portal: string }
        Returns: Json
      }
      provider_post_loads: {
        Args: { p_loads: Json; p_shipper: Json; p_token: string }
        Returns: Json
      }
      provider_update_load: {
        Args: { p_load: Json; p_share: string }
        Returns: Json
      }
      report_email_config: { Args: never; Returns: Json }
      reset_sample_data: { Args: never; Returns: Json }
      sample_data_allowed: { Args: never; Returns: boolean }
      seed_sample_data: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
