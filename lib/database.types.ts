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
      affiliate_applications: {
        Row: {
          audience: string | null
          audience_size: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          platform: string
          source: string
          status: string
        }
        Insert: {
          audience?: string | null
          audience_size?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          platform: string
          source?: string
          status?: string
        }
        Update: {
          audience?: string | null
          audience_size?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          platform?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      alpha_waitlist: {
        Row: {
          created_at: string
          email: string
          id: number
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: number
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: number
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ask_stockgpt_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_accounts: {
        Row: {
          account_type: string | null
          base_currency: string | null
          connection_id: string
          created_at: string
          external_account_id: string
          id: string
          institution_id: string
          last_successful_sync_at: string | null
          name: string
          status: Database["public"]["Enums"]["broker_account_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          base_currency?: string | null
          connection_id: string
          created_at?: string
          external_account_id: string
          id?: string
          institution_id: string
          last_successful_sync_at?: string | null
          name: string
          status?: Database["public"]["Enums"]["broker_account_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          base_currency?: string | null
          connection_id?: string
          created_at?: string
          external_account_id?: string
          id?: string
          institution_id?: string
          last_successful_sync_at?: string | null
          name?: string
          status?: Database["public"]["Enums"]["broker_account_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_accounts_connection_owner_fkey"
            columns: ["connection_id", "user_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id", "user_id", "institution_id"]
          },
          {
            foreignKeyName: "broker_accounts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "brokerage_institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_activities: {
        Row: {
          account_id: string
          activity_type: string
          currency: string | null
          description: string | null
          external_activity_id: string | null
          fingerprint: string
          fingerprint_version: string
          gross_amount: number | null
          id: string
          instrument_id: string | null
          net_amount: number | null
          occurred_at: string | null
          price: number | null
          quantity: number | null
          recorded_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          activity_type: string
          currency?: string | null
          description?: string | null
          external_activity_id?: string | null
          fingerprint: string
          fingerprint_version?: string
          gross_amount?: number | null
          id?: string
          instrument_id?: string | null
          net_amount?: number | null
          occurred_at?: string | null
          price?: number | null
          quantity?: number | null
          recorded_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          activity_type?: string
          currency?: string | null
          description?: string | null
          external_activity_id?: string | null
          fingerprint?: string
          fingerprint_version?: string
          gross_amount?: number | null
          id?: string
          instrument_id?: string | null
          net_amount?: number | null
          occurred_at?: string | null
          price?: number | null
          quantity?: number | null
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_activities_account_owner_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "broker_activities_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_cash_balances: {
        Row: {
          account_id: string
          amount: number
          as_of: string
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          as_of: string
          created_at?: string
          currency: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          as_of?: string
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_cash_balances_account_owner_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      broker_connections: {
        Row: {
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          external_connection_id: string
          id: string
          institution_id: string
          last_attempted_sync_at: string | null
          last_successful_sync_at: string | null
          provider_id: string
          status: Database["public"]["Enums"]["broker_connection_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          external_connection_id: string
          id?: string
          institution_id: string
          last_attempted_sync_at?: string | null
          last_successful_sync_at?: string | null
          provider_id: string
          status?: Database["public"]["Enums"]["broker_connection_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          external_connection_id?: string
          id?: string
          institution_id?: string
          last_attempted_sync_at?: string | null
          last_successful_sync_at?: string | null
          provider_id?: string
          status?: Database["public"]["Enums"]["broker_connection_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_connections_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "brokerage_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_connections_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "broker_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_positions: {
        Row: {
          account_id: string
          as_of: string
          asset_type: string | null
          created_at: string
          description: string | null
          external_instrument_id: string | null
          external_position_id: string | null
          id: string
          instrument_id: string | null
          market_value: number | null
          market_value_currency: string | null
          position_key: string
          price: number | null
          price_currency: string | null
          quantity: number
          symbol: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          as_of: string
          asset_type?: string | null
          created_at?: string
          description?: string | null
          external_instrument_id?: string | null
          external_position_id?: string | null
          id?: string
          instrument_id?: string | null
          market_value?: number | null
          market_value_currency?: string | null
          position_key: string
          price?: number | null
          price_currency?: string | null
          quantity: number
          symbol?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          as_of?: string
          asset_type?: string | null
          created_at?: string
          description?: string | null
          external_instrument_id?: string | null
          external_position_id?: string | null
          id?: string
          instrument_id?: string | null
          market_value?: number | null
          market_value_currency?: string | null
          position_key?: string
          price?: number | null
          price_currency?: string | null
          quantity?: number
          symbol?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_positions_account_owner_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "broker_positions_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_providers: {
        Row: {
          created_at: string
          display_name: string
          id: string
          provider_key: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          provider_key: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          provider_key?: string
        }
        Relationships: []
      }
      broker_sync_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          completed_at: string | null
          connection_id: string
          created_at: string
          error_code: string | null
          id: string
          lease_expires_at: string | null
          leased_by: string | null
          provider_freshness_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["broker_sync_job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          connection_id: string
          created_at?: string
          error_code?: string | null
          id?: string
          lease_expires_at?: string | null
          leased_by?: string | null
          provider_freshness_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["broker_sync_job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          error_code?: string | null
          id?: string
          lease_expires_at?: string | null
          leased_by?: string | null
          provider_freshness_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["broker_sync_job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_sync_jobs_connection_owner_fkey"
            columns: ["connection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      brokerage_institution_aliases: {
        Row: {
          created_at: string
          external_institution_id: string
          id: string
          institution_id: string
          provider_id: string
        }
        Insert: {
          created_at?: string
          external_institution_id: string
          id?: string
          institution_id: string
          provider_id: string
        }
        Update: {
          created_at?: string
          external_institution_id?: string
          id?: string
          institution_id?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brokerage_institution_aliases_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "brokerage_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brokerage_institution_aliases_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "broker_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      brokerage_institutions: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      executive_waitlist: {
        Row: {
          created_at: string
          email: string | null
          id: string
          joined_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          joined_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          joined_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      instrument_aliases: {
        Row: {
          created_at: string
          id: string
          instrument_id: string
          is_primary: boolean
          namespace: string
          scope: string
          valid_from: string | null
          valid_to: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrument_id: string
          is_primary?: boolean
          namespace: string
          scope?: string
          valid_from?: string | null
          valid_to?: string | null
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          instrument_id?: string
          is_primary?: boolean
          namespace?: string
          scope?: string
          valid_from?: string | null
          valid_to?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrument_aliases_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      instrument_market_data: {
        Row: {
          coverage: Database["public"]["Enums"]["instrument_coverage_status"]
          current_price: number | null
          instrument_id: string
          limitation_code: string | null
          price_as_of: string | null
          price_currency: string | null
          source_namespace: string | null
          updated_at: string
        }
        Insert: {
          coverage: Database["public"]["Enums"]["instrument_coverage_status"]
          current_price?: number | null
          instrument_id: string
          limitation_code?: string | null
          price_as_of?: string | null
          price_currency?: string | null
          source_namespace?: string | null
          updated_at?: string
        }
        Update: {
          coverage?: Database["public"]["Enums"]["instrument_coverage_status"]
          current_price?: number | null
          instrument_id?: string
          limitation_code?: string | null
          price_as_of?: string | null
          price_currency?: string | null
          source_namespace?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrument_market_data_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: true
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          created_at: string
          display_name: string
          exchange_mic: string | null
          id: string
          instrument_type: string
          is_active: boolean
          trading_currency: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          exchange_mic?: string | null
          id?: string
          instrument_type?: string
          is_active?: boolean
          trading_currency?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          exchange_mic?: string | null
          id?: string
          instrument_type?: string
          is_active?: boolean
          trading_currency?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      market_snapshots: {
        Row: {
          change_pct_1d: number | null
          current_price: number | null
          source: string
          ticker: string
          updated_at: string
        }
        Insert: {
          change_pct_1d?: number | null
          current_price?: number | null
          source?: string
          ticker: string
          updated_at?: string
        }
        Update: {
          change_pct_1d?: number | null
          current_price?: number | null
          source?: string
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          affected_tickers: string[] | null
          created_at: string | null
          id: number
          image_url: string | null
          impact: string | null
          impact_reason: string | null
          published_at: string | null
          source: string | null
          summary: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          affected_tickers?: string[] | null
          created_at?: string | null
          id?: never
          image_url?: string | null
          impact?: string | null
          impact_reason?: string | null
          published_at?: string | null
          source?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          affected_tickers?: string[] | null
          created_at?: string | null
          id?: never
          image_url?: string | null
          impact?: string | null
          impact_reason?: string | null
          published_at?: string | null
          source?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      notification_dismissals: {
        Row: {
          alert_key: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          alert_key: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          alert_key?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_holdings: {
        Row: {
          added_at: string
          allocation_pct: number | null
          entry_price: number | null
          id: string
          last_reviewed_at: string
          notes: string | null
          portfolio_id: string
          purchase_date: string | null
          rank_at_entry: number | null
          risk_level_at_entry: number | null
          score_at_entry: number | null
          shares: number | null
          source: string
          target_level_at_entry: number | null
          ticker: string
        }
        Insert: {
          added_at?: string
          allocation_pct?: number | null
          entry_price?: number | null
          id?: string
          last_reviewed_at?: string
          notes?: string | null
          portfolio_id: string
          purchase_date?: string | null
          rank_at_entry?: number | null
          risk_level_at_entry?: number | null
          score_at_entry?: number | null
          shares?: number | null
          source?: string
          target_level_at_entry?: number | null
          ticker: string
        }
        Update: {
          added_at?: string
          allocation_pct?: number | null
          entry_price?: number | null
          id?: string
          last_reviewed_at?: string
          notes?: string | null
          portfolio_id?: string
          purchase_date?: string | null
          rank_at_entry?: number | null
          risk_level_at_entry?: number | null
          score_at_entry?: number | null
          shares?: number | null
          source?: string
          target_level_at_entry?: number | null
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "user_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_page_snapshots: {
        Row: {
          input_hash: string
          owner_id: string
          portfolio_id: string
          snapshot: Json
          updated_at: string
        }
        Insert: {
          input_hash: string
          owner_id: string
          portfolio_id: string
          snapshot: Json
          updated_at?: string
        }
        Update: {
          input_hash?: string
          owner_id?: string
          portfolio_id?: string
          snapshot?: Json
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          basis: number
          cash: number
          created_at: string
          id: string
          pnl: number
          pnl_pct: number
          portfolio_id: string
          snapshot_at: string
          source: string
          user_id: string
          value: number
        }
        Insert: {
          basis?: number
          cash?: number
          created_at?: string
          id?: string
          pnl?: number
          pnl_pct?: number
          portfolio_id: string
          snapshot_at?: string
          source?: string
          user_id: string
          value: number
        }
        Update: {
          basis?: number
          cash?: number
          created_at?: string
          id?: string
          pnl?: number
          pnl_pct?: number
          portfolio_id?: string
          snapshot_at?: string
          source?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "user_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_snapshots_portfolio_owner_fkey"
            columns: ["portfolio_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_portfolios"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      portfolio_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          occurred_at: string | null
          portfolio_id: string
          price: number | null
          realised_pnl: number | null
          shares: number | null
          ticker: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          occurred_at?: string | null
          portfolio_id: string
          price?: number | null
          realised_pnl?: number | null
          shares?: number | null
          ticker?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          occurred_at?: string | null
          portfolio_id?: string
          price?: number | null
          realised_pnl?: number | null
          shares?: number | null
          ticker?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_transactions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "user_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_transactions_portfolio_owner_fkey"
            columns: ["portfolio_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_portfolios"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      premium_waitlist: {
        Row: {
          created_at: string
          email: string
          id: number
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: number
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: number
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pro_waitlist: {
        Row: {
          created_at: string | null
          email: string
          id: number
          name: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: never
          name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: never
          name?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          consent_captured_at: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          email_consent: boolean
          email_digest_last_sent_at: string | null
          email_digest_last_sent_on: string | null
          email_news_digests: boolean
          email_portfolio_alerts: boolean
          email_watchlist_alerts: boolean
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          marketing_consent: boolean
          newsletter_digest_consent: boolean
          phone: string | null
          preferred_currency: string
          stripe_customer_id: string | null
          subscription_status: string | null
          terms_accepted: boolean
        }
        Insert: {
          consent_captured_at?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          email_consent?: boolean
          email_digest_last_sent_at?: string | null
          email_digest_last_sent_on?: string | null
          email_news_digests?: boolean
          email_portfolio_alerts?: boolean
          email_watchlist_alerts?: boolean
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          marketing_consent?: boolean
          newsletter_digest_consent?: boolean
          phone?: string | null
          preferred_currency?: string
          stripe_customer_id?: string | null
          subscription_status?: string | null
          terms_accepted?: boolean
        }
        Update: {
          consent_captured_at?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          email_consent?: boolean
          email_digest_last_sent_at?: string | null
          email_digest_last_sent_on?: string | null
          email_news_digests?: boolean
          email_portfolio_alerts?: boolean
          email_watchlist_alerts?: boolean
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          marketing_consent?: boolean
          newsletter_digest_consent?: boolean
          phone?: string | null
          preferred_currency?: string
          stripe_customer_id?: string | null
          subscription_status?: string | null
          terms_accepted?: boolean
        }
        Relationships: []
      }
      security_audit_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json
          user_agent_hash: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          key: string
          success: boolean
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          key: string
          success?: boolean
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          key?: string
          success?: boolean
        }
        Relationships: []
      }
      stock_chart_cache: {
        Row: {
          fetched_at: string
          points: Json
          range: string
          source: string
          ticker: string
        }
        Insert: {
          fetched_at?: string
          points: Json
          range: string
          source?: string
          ticker: string
        }
        Update: {
          fetched_at?: string
          points?: Json
          range?: string
          source?: string
          ticker?: string
        }
        Relationships: []
      }
      stock_factor_diagnostics: {
        Row: {
          current_score: number | null
          diagnosis: string | null
          factor_contributions: Json | null
          factor_coverage: number | null
          factor_coverage_change: number | null
          growth_change: number | null
          growth_score: number | null
          income_change: number | null
          income_score: number | null
          missing_factors: Json | null
          momentum_change: number | null
          momentum_score: number | null
          previous_factor_coverage: number | null
          previous_score: number | null
          quality_change: number | null
          quality_score: number | null
          raw_score: number | null
          risk_change: number | null
          risk_score: number | null
          run_id: string | null
          smoothed_score: number | null
          ticker: string
          top_negative_factors: Json | null
          top_positive_factors: Json | null
          updated_at: string | null
          value_change: number | null
          value_score: number | null
        }
        Insert: {
          current_score?: number | null
          diagnosis?: string | null
          factor_contributions?: Json | null
          factor_coverage?: number | null
          factor_coverage_change?: number | null
          growth_change?: number | null
          growth_score?: number | null
          income_change?: number | null
          income_score?: number | null
          missing_factors?: Json | null
          momentum_change?: number | null
          momentum_score?: number | null
          previous_factor_coverage?: number | null
          previous_score?: number | null
          quality_change?: number | null
          quality_score?: number | null
          raw_score?: number | null
          risk_change?: number | null
          risk_score?: number | null
          run_id?: string | null
          smoothed_score?: number | null
          ticker: string
          top_negative_factors?: Json | null
          top_positive_factors?: Json | null
          updated_at?: string | null
          value_change?: number | null
          value_score?: number | null
        }
        Update: {
          current_score?: number | null
          diagnosis?: string | null
          factor_contributions?: Json | null
          factor_coverage?: number | null
          factor_coverage_change?: number | null
          growth_change?: number | null
          growth_score?: number | null
          income_change?: number | null
          income_score?: number | null
          missing_factors?: Json | null
          momentum_change?: number | null
          momentum_score?: number | null
          previous_factor_coverage?: number | null
          previous_score?: number | null
          quality_change?: number | null
          quality_score?: number | null
          raw_score?: number | null
          risk_change?: number | null
          risk_score?: number | null
          run_id?: string | null
          smoothed_score?: number | null
          ticker?: string
          top_negative_factors?: Json | null
          top_positive_factors?: Json | null
          updated_at?: string | null
          value_change?: number | null
          value_score?: number | null
        }
        Relationships: []
      }
      stock_factor_diagnostics_history: {
        Row: {
          current_score: number | null
          diagnosis: string | null
          factor_contributions: Json | null
          factor_coverage: number | null
          factor_coverage_change: number | null
          growth_change: number | null
          growth_score: number | null
          id: number
          income_change: number | null
          income_score: number | null
          missing_factors: Json | null
          momentum_change: number | null
          momentum_score: number | null
          previous_factor_coverage: number | null
          previous_score: number | null
          quality_change: number | null
          quality_score: number | null
          raw_score: number | null
          risk_change: number | null
          risk_score: number | null
          run_id: string | null
          smoothed_score: number | null
          ticker: string
          top_negative_factors: Json | null
          top_positive_factors: Json | null
          updated_at: string | null
          value_change: number | null
          value_score: number | null
        }
        Insert: {
          current_score?: number | null
          diagnosis?: string | null
          factor_contributions?: Json | null
          factor_coverage?: number | null
          factor_coverage_change?: number | null
          growth_change?: number | null
          growth_score?: number | null
          id?: number
          income_change?: number | null
          income_score?: number | null
          missing_factors?: Json | null
          momentum_change?: number | null
          momentum_score?: number | null
          previous_factor_coverage?: number | null
          previous_score?: number | null
          quality_change?: number | null
          quality_score?: number | null
          raw_score?: number | null
          risk_change?: number | null
          risk_score?: number | null
          run_id?: string | null
          smoothed_score?: number | null
          ticker: string
          top_negative_factors?: Json | null
          top_positive_factors?: Json | null
          updated_at?: string | null
          value_change?: number | null
          value_score?: number | null
        }
        Update: {
          current_score?: number | null
          diagnosis?: string | null
          factor_contributions?: Json | null
          factor_coverage?: number | null
          factor_coverage_change?: number | null
          growth_change?: number | null
          growth_score?: number | null
          id?: number
          income_change?: number | null
          income_score?: number | null
          missing_factors?: Json | null
          momentum_change?: number | null
          momentum_score?: number | null
          previous_factor_coverage?: number | null
          previous_score?: number | null
          quality_change?: number | null
          quality_score?: number | null
          raw_score?: number | null
          risk_change?: number | null
          risk_score?: number | null
          run_id?: string | null
          smoothed_score?: number | null
          ticker?: string
          top_negative_factors?: Json | null
          top_positive_factors?: Json | null
          updated_at?: string | null
          value_change?: number | null
          value_score?: number | null
        }
        Relationships: []
      }
      stock_rank_snapshots: {
        Row: {
          company: string | null
          created_at: string
          id: number
          price: number | null
          rank: number | null
          score: number | null
          sector: string | null
          snapshot_at: string
          ticker: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          id?: never
          price?: number | null
          rank?: number | null
          score?: number | null
          sector?: string | null
          snapshot_at: string
          ticker: string
        }
        Update: {
          company?: string | null
          created_at?: string
          id?: never
          price?: number | null
          rank?: number | null
          score?: number | null
          sector?: string | null
          snapshot_at?: string
          ticker?: string
        }
        Relationships: []
      }
      stock_rankings: {
        Row: {
          company: string | null
          id: number
          instrument_id: string | null
          last_fundamentals_update: string | null
          last_price_update: string | null
          last_ranking_update: string | null
          momentum: number | null
          pe: number | null
          previous_rank: number | null
          price: number | null
          rank: number | null
          risk: number | null
          score: number | null
          sector: string | null
          ticker: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          id?: never
          instrument_id?: string | null
          last_fundamentals_update?: string | null
          last_price_update?: string | null
          last_ranking_update?: string | null
          momentum?: number | null
          pe?: number | null
          previous_rank?: number | null
          price?: number | null
          rank?: number | null
          risk?: number | null
          score?: number | null
          sector?: string | null
          ticker?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          id?: never
          instrument_id?: string | null
          last_fundamentals_update?: string | null
          last_price_update?: string | null
          last_ranking_update?: string | null
          momentum?: number | null
          pe?: number | null
          previous_rank?: number | null
          price?: number | null
          rank?: number | null
          risk?: number | null
          score?: number | null
          sector?: string | null
          ticker?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_rankings_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      support_feedback: {
        Row: {
          category: string
          created_at: string
          email: string | null
          id: string
          message: string
          page_path: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          email?: string | null
          id?: string
          message: string
          page_path?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          page_path?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      technical_level_cache: {
        Row: {
          current_price: number | null
          fetched_at: string
          levels: Json
          ticker: string
        }
        Insert: {
          current_price?: number | null
          fetched_at?: string
          levels: Json
          ticker: string
        }
        Update: {
          current_price?: number | null
          fetched_at?: string
          levels?: Json
          ticker?: string
        }
        Relationships: []
      }
      user_notification_summaries: {
        Row: {
          unread_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          unread_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          unread_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_portfolios: {
        Row: {
          archived_at: string | null
          broker_account_id: string | null
          cash_balance: number
          cash_deposited_total: number
          created_at: string
          currency: string
          id: string
          investment_amount: number | null
          management_source: Database["public"]["Enums"]["portfolio_management_source"]
          name: string
          objective: string | null
          risk_tolerance: string | null
          time_horizon: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          broker_account_id?: string | null
          cash_balance?: number
          cash_deposited_total?: number
          created_at?: string
          currency?: string
          id?: string
          investment_amount?: number | null
          management_source?: Database["public"]["Enums"]["portfolio_management_source"]
          name?: string
          objective?: string | null
          risk_tolerance?: string | null
          time_horizon?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          broker_account_id?: string | null
          cash_balance?: number
          cash_deposited_total?: number
          created_at?: string
          currency?: string
          id?: string
          investment_amount?: number | null
          management_source?: Database["public"]["Enums"]["portfolio_management_source"]
          name?: string
          objective?: string | null
          risk_tolerance?: string | null
          time_horizon?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_portfolios_broker_account_owner_fkey"
            columns: ["broker_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          ticker: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ticker: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ticker?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buy_portfolio_holding: {
        Args: {
          p_notes?: string
          p_portfolio_id: string
          p_price: number
          p_purchase_date?: string
          p_shares: number
          p_ticker: string
        }
        Returns: {
          cash_balance: number
          cash_deposited_total: number
          entry_price: number
          holding_id: string
          portfolio_id: string
          shares: number
          ticker: string
          transaction_id: string
          updated_existing: boolean
        }[]
      }
      claim_broker_sync_jobs: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          available_at: string
          completed_at: string | null
          connection_id: string
          created_at: string
          error_code: string | null
          id: string
          lease_expires_at: string | null
          leased_by: string | null
          provider_freshness_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["broker_sync_job_status"]
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "broker_sync_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      correct_portfolio_holding: {
        Args: {
          p_entry_price: number
          p_notes?: string
          p_portfolio_id: string
          p_purchase_date?: string
          p_shares: number
          p_ticker: string
        }
        Returns: {
          entry_price: number
          holding_id: string
          portfolio_id: string
          shares: number
          ticker: string
          transaction_id: string
        }[]
      }
      create_ai_portfolio_draft: {
        Args: {
          p_holdings: Json
          p_name: string
          p_risk_tolerance: string
          p_time_horizon: string
        }
        Returns: {
          cash_balance: number
          cash_deposited_total: number
          holdings_basis: number
          holdings_count: number
          portfolio_id: string
        }[]
      }
      create_connected_portfolio: {
        Args: { p_account_id: string }
        Returns: {
          created: boolean
          portfolio_id: string
        }[]
      }
      create_manual_portfolio: {
        Args: {
          p_holdings: Json
          p_name: string
          p_objective: string
          p_risk_tolerance: string
          p_starting_cash: number
          p_time_horizon: string
        }
        Returns: {
          cash_balance: number
          cash_deposited_total: number
          holdings_basis: number
          holdings_count: number
          portfolio_id: string
        }[]
      }
      create_trading212_portfolio: {
        Args: { p_holdings: Json; p_name: string }
        Returns: {
          cash_balance: number
          cash_deposited_total: number
          holdings_basis: number
          holdings_count: number
          portfolio_id: string
        }[]
      }
      delete_owned_portfolio: {
        Args: { p_portfolio_id: string }
        Returns: {
          portfolio_id: string
        }[]
      }
      enqueue_broker_sync: {
        Args: { p_connection_id: string; p_user_id: string }
        Returns: string
      }
      fail_broker_sync_job: {
        Args: {
          p_error_code: string
          p_job_id: string
          p_retry_after_seconds?: number
          p_retryable: boolean
          p_worker_id: string
        }
        Returns: undefined
      }
      get_broker_user_secret: {
        Args: { p_provider_id: string; p_user_id: string }
        Returns: {
          provider_user_id: string
          user_secret: string
        }[]
      }
      is_active_subscriber: { Args: { user_uuid: string }; Returns: boolean }
      log_existing_portfolio_holding: {
        Args: {
          p_entry_price: number
          p_notes?: string
          p_portfolio_id: string
          p_purchase_date?: string
          p_shares: number
          p_ticker: string
        }
        Returns: {
          cash_balance: number
          cash_deposited_total: number
          entry_price: number
          holding_id: string
          portfolio_id: string
          shares: number
          ticker: string
          transaction_id: string
          updated_existing: boolean
        }[]
      }
      mark_portfolio_holding_reviewed: {
        Args: { p_portfolio_id: string; p_ticker: string }
        Returns: {
          portfolio_id: string
          reviewed_at: string
          ticker: string
        }[]
      }
      mutate_portfolio_cash: {
        Args: { p_amount: number; p_operation: string; p_portfolio_id: string }
        Returns: {
          amount: number
          cash_balance: number
          cash_deposited_total: number
          created_at: string
          occurred_at: string
          operation: string
          portfolio_id: string
          transaction_id: string
        }[]
      }
      promote_broker_sync_candidate: {
        Args: { p_candidate: Json; p_job_id: string; p_worker_id: string }
        Returns: undefined
      }
      remove_portfolio_holding_tracking: {
        Args: { p_portfolio_id: string; p_ticker: string }
        Returns: {
          cash_balance: number
          cash_deposited_total: number
          portfolio_id: string
          removed_shares: number
          ticker: string
          transaction_id: string
        }[]
      }
      rename_owned_portfolio: {
        Args: { p_name: string; p_portfolio_id: string }
        Returns: {
          portfolio_id: string
          portfolio_name: string
        }[]
      }
      replace_portfolio_holdings_from_trading212: {
        Args: { p_holdings: Json; p_portfolio_id: string }
        Returns: {
          cash_balance: number
          cash_deposited_total: number
          holdings_basis: number
          holdings_count: number
          portfolio_id: string
        }[]
      }
      revoke_broker_user_secret: {
        Args: { p_provider_id: string; p_user_id: string }
        Returns: boolean
      }
      sell_portfolio_holding: {
        Args: {
          p_portfolio_id: string
          p_price: number
          p_shares: number
          p_ticker: string
        }
        Returns: {
          cash_balance: number
          cash_deposited_total: number
          closed: boolean
          entry_price: number
          holding_id: string
          portfolio_id: string
          realised_pnl: number
          shares: number
          ticker: string
          transaction_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      store_broker_user_secret: {
        Args: {
          p_provider_id: string
          p_provider_user_id: string
          p_user_id: string
          p_user_secret: string
        }
        Returns: undefined
      }
      update_owned_portfolio_preferences: {
        Args: {
          p_objective: string
          p_portfolio_id: string
          p_risk_tolerance: string
          p_time_horizon: string
        }
        Returns: {
          objective: string
          portfolio_id: string
          risk_tolerance: string
          time_horizon: string
        }[]
      }
    }
    Enums: {
      broker_account_status: "active" | "closed" | "inaccessible"
      broker_connection_status:
        | "pending"
        | "active"
        | "error"
        | "revoked"
        | "disconnected"
      broker_sync_job_status:
        | "queued"
        | "running"
        | "succeeded"
        | "retryable_failure"
        | "terminal_failure"
      instrument_coverage_status: "ranked" | "tracked_only" | "unsupported"
      portfolio_management_source: "manual" | "connected"
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
      broker_account_status: ["active", "closed", "inaccessible"],
      broker_connection_status: [
        "pending",
        "active",
        "error",
        "revoked",
        "disconnected",
      ],
      broker_sync_job_status: [
        "queued",
        "running",
        "succeeded",
        "retryable_failure",
        "terminal_failure",
      ],
      instrument_coverage_status: ["ranked", "tracked_only", "unsupported"],
      portfolio_management_source: ["manual", "connected"],
    },
  },
} as const
