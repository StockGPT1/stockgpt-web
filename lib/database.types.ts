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
        Relationships: []
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
          cash_balance: number
          cash_deposited_total: number
          created_at: string
          currency: string
          id: string
          investment_amount: number | null
          name: string
          objective: string | null
          risk_tolerance: string | null
          time_horizon: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          cash_balance?: number
          cash_deposited_total?: number
          created_at?: string
          currency?: string
          id?: string
          investment_amount?: number | null
          name?: string
          objective?: string | null
          risk_tolerance?: string | null
          time_horizon?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          cash_balance?: number
          cash_deposited_total?: number
          created_at?: string
          currency?: string
          id?: string
          investment_amount?: number | null
          name?: string
          objective?: string | null
          risk_tolerance?: string | null
          time_horizon?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      delete_owned_portfolio: {
        Args: { p_portfolio_id: string }
        Returns: {
          portfolio_id: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
