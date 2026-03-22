export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          nickname: string;
          email: string;
          phone: string | null;
          account_status: "pending" | "active" | "suspended";
          role: "user" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string;
          last_name?: string;
          nickname?: string;
          email: string;
          phone?: string | null;
          account_status?: "pending" | "active" | "suspended";
          role?: "user" | "admin";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          first_name?: string;
          last_name?: string;
          nickname?: string;
          phone?: string | null;
          account_status?: "pending" | "active" | "suspended";
          role?: "user" | "admin";
          updated_at?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          balance: number;
          locked_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          balance?: number;
          locked_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          balance?: number;
          locked_balance?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          id: string;
          wallet_id: string;
          user_id: string;
          movement_type: "topup" | "prize" | "board_purchase" | "withdrawal" | "admin_adjustment";
          direction: "credit" | "debit";
          amount: number;
          balance_before: number;
          balance_after: number;
          operation_ref: string | null;
          operation_source: string;
          metadata: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          user_id: string;
          movement_type: "topup" | "prize" | "board_purchase" | "withdrawal" | "admin_adjustment";
          direction: "credit" | "debit";
          amount: number;
          balance_before: number;
          balance_after: number;
          operation_ref?: string | null;
          operation_source?: string;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          operation_ref?: string | null;
          operation_source?: string;
          metadata?: Json;
          created_by?: string | null;
        };
        Relationships: [];
      };
      topups: {
        Row: {
          id: string;
          user_id: string;
          provider: "payphone" | "bank_transfer";
          status: "pending" | "approved" | "rejected";
          amount: number;
          currency: string;
          provider_reference: string | null;
          client_reference: string | null;
          receipt_path: string | null;
          rejection_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          wallet_transaction_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "payphone" | "bank_transfer";
          status?: "pending" | "approved" | "rejected";
          amount: number;
          currency?: string;
          provider_reference?: string | null;
          client_reference?: string | null;
          receipt_path?: string | null;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          wallet_transaction_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "approved" | "rejected";
          provider_reference?: string | null;
          client_reference?: string | null;
          receipt_path?: string | null;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          wallet_transaction_id?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      topup_events: {
        Row: {
          id: string;
          topup_id: string;
          actor_user_id: string | null;
          event_type: "created" | "provider_update" | "approved" | "rejected";
          previous_status: "pending" | "approved" | "rejected" | null;
          current_status: "pending" | "approved" | "rejected";
          notes: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          topup_id: string;
          actor_user_id?: string | null;
          event_type: "created" | "provider_update" | "approved" | "rejected";
          previous_status?: "pending" | "approved" | "rejected" | null;
          current_status: "pending" | "approved" | "rejected";
          notes?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          notes?: string | null;
          payload?: Json;
        };
        Relationships: [];
      };
      withdrawal_fee_rules: {
        Row: {
          id: string;
          bank_normalized: string;
          fee: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bank_normalized: string;
          fee: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          bank_normalized?: string;
          fee?: number;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      withdrawals: {
        Row: {
          id: string;
          user_id: string;
          bank_name: string;
          bank_normalized: string;
          account_type: "savings" | "checking";
          account_number: string;
          account_holder_name: string;
          account_holder_id: string;
          amount_requested: number;
          fee_applied: number;
          amount_net: number;
          locked_amount: number;
          status: "pending" | "approved" | "paid" | "rejected";
          admin_observation: string | null;
          rejection_reason: string | null;
          reviewed_by: string | null;
          approved_at: string | null;
          paid_at: string | null;
          rejected_at: string | null;
          wallet_transaction_id: string | null;
          external_reference: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bank_name: string;
          bank_normalized: string;
          account_type: "savings" | "checking";
          account_number: string;
          account_holder_name: string;
          account_holder_id: string;
          amount_requested: number;
          fee_applied: number;
          amount_net: number;
          locked_amount: number;
          status?: "pending" | "approved" | "paid" | "rejected";
          admin_observation?: string | null;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          approved_at?: string | null;
          paid_at?: string | null;
          rejected_at?: string | null;
          wallet_transaction_id?: string | null;
          external_reference?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "approved" | "paid" | "rejected";
          admin_observation?: string | null;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          approved_at?: string | null;
          paid_at?: string | null;
          rejected_at?: string | null;
          wallet_transaction_id?: string | null;
          external_reference?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      withdrawal_events: {
        Row: {
          id: string;
          withdrawal_id: string;
          actor_user_id: string | null;
          event_type: "created" | "approved" | "paid" | "rejected";
          previous_status: "pending" | "approved" | "paid" | "rejected" | null;
          current_status: "pending" | "approved" | "paid" | "rejected";
          notes: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          withdrawal_id: string;
          actor_user_id?: string | null;
          event_type: "created" | "approved" | "paid" | "rejected";
          previous_status?: "pending" | "approved" | "paid" | "rejected" | null;
          current_status: "pending" | "approved" | "paid" | "rejected";
          notes?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          notes?: string | null;
          payload?: Json;
        };
        Relationships: [];
      };
      board_purchases: {
        Row: {
          id: string;
          user_id: string;
          game_id: string | null;
          quantity: number;
          unit_price: number;
          total_amount: number;
          status: "pending" | "completed" | "failed";
          wallet_transaction_id: string;
          operation_ref: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id?: string | null;
          quantity: number;
          unit_price?: number;
          total_amount: number;
          status?: "pending" | "completed" | "failed";
          wallet_transaction_id: string;
          operation_ref: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "completed" | "failed";
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      bingo_boards: {
        Row: {
          id: string;
          purchase_id: string;
          user_id: string;
          game_id: string | null;
          board_index: number;
          board_fingerprint: string;
          grid: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          user_id: string;
          game_id?: string | null;
          board_index: number;
          board_fingerprint: string;
          grid: Json;
          created_at?: string;
        };
        Update: {
          grid?: Json;
        };
        Relationships: [];
      };
      bingo_board_cells: {
        Row: {
          board_id: string;
          row_index: number;
          col_index: number;
          number_value: number;
        };
        Insert: {
          board_id: string;
          row_index: number;
          col_index: number;
          number_value: number;
        };
        Update: {
          number_value?: number;
        };
        Relationships: [];
      };
      game_rounds: {
        Row: {
          id: string;
          status: "scheduled" | "active" | "finished";
          scheduled_at: string;
          activated_at: string | null;
          finished_at: string | null;
          base_draw_count: number;
          extra_draw_count: number;
          total_draw_count: number;
          lucky_ball_probability: number;
          lucky_ball_triggered: boolean;
          lucky_ball_trigger_order: number | null;
          lucky_ball_extra_spins: number;
          metadata: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          status?: "scheduled" | "active" | "finished";
          scheduled_at?: string;
          activated_at?: string | null;
          finished_at?: string | null;
          base_draw_count?: number;
          extra_draw_count?: number;
          total_draw_count?: number;
          lucky_ball_probability?: number;
          lucky_ball_triggered?: boolean;
          lucky_ball_trigger_order?: number | null;
          lucky_ball_extra_spins?: number;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "scheduled" | "active" | "finished";
          activated_at?: string | null;
          finished_at?: string | null;
          extra_draw_count?: number;
          total_draw_count?: number;
          lucky_ball_probability?: number;
          lucky_ball_triggered?: boolean;
          lucky_ball_trigger_order?: number | null;
          lucky_ball_extra_spins?: number;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      game_round_multipliers: {
        Row: {
          id: string;
          game_round_id: string;
          number_value: number;
          multiplier: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_round_id: string;
          number_value: number;
          multiplier: number;
          created_at?: string;
        };
        Update: {
          multiplier?: number;
        };
        Relationships: [];
      };
      game_round_draws: {
        Row: {
          id: string;
          game_round_id: string;
          draw_order: number;
          number_value: number;
          is_extra_spin: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_round_id: string;
          draw_order: number;
          number_value: number;
          is_extra_spin?: boolean;
          created_at?: string;
        };
        Update: {
          is_extra_spin?: boolean;
        };
        Relationships: [];
      };
      game_round_lucky_ball_events: {
        Row: {
          id: string;
          game_round_id: string;
          trigger_order: number;
          extra_spins: number;
          random_value: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_round_id: string;
          trigger_order: number;
          extra_spins: number;
          random_value: number;
          created_at?: string;
        };
        Update: {
          trigger_order?: number;
          extra_spins?: number;
          random_value?: number;
        };
        Relationships: [];
      };
      game_round_line_wins: {
        Row: {
          id: string;
          game_round_id: string;
          board_id: string;
          purchase_id: string;
          user_id: string;
          line_type: "row_1" | "row_2" | "row_3" | "col_1" | "col_2" | "col_3";
          line_numbers: number[];
          applied_multiplier: number;
          base_prize: number;
          prize_amount: number;
          wallet_transaction_id: string | null;
          operation_ref: string;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_round_id: string;
          board_id: string;
          purchase_id: string;
          user_id: string;
          line_type: "row_1" | "row_2" | "row_3" | "col_1" | "col_2" | "col_3";
          line_numbers: number[];
          applied_multiplier: number;
          base_prize: number;
          prize_amount: number;
          wallet_transaction_id?: string | null;
          operation_ref: string;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          wallet_transaction_id?: string | null;
          paid_at?: string | null;
        };
        Relationships: [];
      };
      game_round_prize_runs: {
        Row: {
          id: string;
          game_round_id: string;
          executed_by: string | null;
          base_prize: number;
          lines_paid: number;
          total_paid: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_round_id: string;
          executed_by?: string | null;
          base_prize: number;
          lines_paid?: number;
          total_paid?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          metadata?: Json;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          payload?: Json;
        };
        Relationships: [];
      };
      game_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          value?: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ensure_wallet_for_user: {
        Args: {
          p_user_id: string;
        };
        Returns: Database["public"]["Tables"]["wallets"]["Row"][];
      };
      apply_wallet_transaction: {
        Args: {
          p_user_id: string;
          p_movement_type:
            | "topup"
            | "prize"
            | "board_purchase"
            | "withdrawal"
            | "admin_adjustment";
          p_direction: "credit" | "debit";
          p_amount: number;
          p_operation_ref?: string | null;
          p_operation_source?: string;
          p_metadata?: Json;
          p_created_by?: string | null;
        };
        Returns: {
          transaction_id: string;
          wallet_id: string;
          user_id: string;
          movement_type: "topup" | "prize" | "board_purchase" | "withdrawal" | "admin_adjustment";
          direction: "credit" | "debit";
          amount: number;
          balance_before: number;
          balance_after: number;
          operation_ref: string | null;
          created_at: string;
          was_already_processed: boolean;
        }[];
      };
      create_topup_payphone_intent: {
        Args: {
          p_amount: number;
          p_client_reference?: string | null;
          p_payload?: Json;
        };
        Returns: Database["public"]["Tables"]["topups"]["Row"][];
      };
      create_topup_bank_transfer: {
        Args: {
          p_amount: number;
          p_client_reference?: string | null;
          p_receipt_path?: string | null;
          p_payload?: Json;
        };
        Returns: Database["public"]["Tables"]["topups"]["Row"][];
      };
      review_topup_bank_transfer: {
        Args: {
          p_topup_id: string;
          p_decision: "pending" | "approved" | "rejected";
          p_rejection_reason?: string | null;
          p_payload?: Json;
        };
        Returns: Database["public"]["Tables"]["topups"]["Row"][];
      };
      apply_topup_payphone_result: {
        Args: {
          p_topup_id: string;
          p_provider_reference?: string | null;
          p_approved?: boolean;
          p_rejection_reason?: string | null;
          p_payload?: Json;
        };
        Returns: Database["public"]["Tables"]["topups"]["Row"][];
      };
      resolve_withdrawal_fee: {
        Args: {
          p_bank_name: string;
        };
        Returns: number;
      };
      get_withdrawal_fee_quote: {
        Args: {
          p_bank_name: string;
          p_amount_requested: number;
        };
        Returns: {
          bank_normalized: string;
          fee_applied: number;
          amount_net: number;
        }[];
      };
      create_withdrawal_request: {
        Args: {
          p_bank_name: string;
          p_account_type: "savings" | "checking";
          p_account_number: string;
          p_account_holder_name: string;
          p_account_holder_id: string;
          p_amount_requested: number;
          p_metadata?: Json;
        };
        Returns: Database["public"]["Tables"]["withdrawals"]["Row"][];
      };
      review_withdrawal_request: {
        Args: {
          p_withdrawal_id: string;
          p_decision: "pending" | "approved" | "paid" | "rejected";
          p_observation?: string | null;
          p_rejection_reason?: string | null;
          p_payload?: Json;
        };
        Returns: Database["public"]["Tables"]["withdrawals"]["Row"][];
      };
      mark_withdrawal_paid: {
        Args: {
          p_withdrawal_id: string;
          p_observation?: string | null;
          p_external_reference?: string | null;
          p_payload?: Json;
        };
        Returns: Database["public"]["Tables"]["withdrawals"]["Row"][];
      };
      is_admin_actor: {
        Args: {
          p_actor_user_id?: string | null;
        };
        Returns: boolean;
      };
      record_audit_log: {
        Args: {
          p_action: string;
          p_entity_type: string;
          p_entity_id?: string | null;
          p_payload?: Json;
          p_actor_user_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["audit_logs"]["Row"][];
      };
      admin_set_user_account_status: {
        Args: {
          p_user_id: string;
          p_status: "pending" | "active" | "suspended";
          p_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["profiles"]["Row"][];
      };
      admin_list_users_with_wallets: {
        Args: {
          p_search?: string | null;
          p_role?: "user" | "admin" | null;
          p_status?: "pending" | "active" | "suspended" | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          first_name: string;
          last_name: string;
          nickname: string;
          email: string;
          phone: string | null;
          role: "user" | "admin";
          account_status: "pending" | "active" | "suspended";
          created_at: string;
          wallet_balance: number;
          wallet_locked_balance: number;
          wallet_updated_at: string | null;
          wallet_tx_count: number;
          last_wallet_tx_at: string | null;
        }[];
      };
      admin_list_wallet_transactions: {
        Args: {
          p_user_id: string;
          p_limit?: number;
        };
        Returns: {
          id: string;
          wallet_id: string;
          user_id: string;
          movement_type:
            | "topup"
            | "prize"
            | "board_purchase"
            | "withdrawal"
            | "admin_adjustment";
          direction: "credit" | "debit";
          amount: number;
          balance_before: number;
          balance_after: number;
          operation_ref: string | null;
          operation_source: string;
          metadata: Json;
          created_by: string | null;
          created_at: string;
        }[];
      };
      admin_get_dashboard_metrics: {
        Args: Record<string, never>;
        Returns: {
          users_total: number;
          users_active: number;
          users_suspended: number;
          topups_pending: number;
          withdrawals_pending: number;
          active_round_id: string | null;
          boards_sold_total: number;
          prizes_paid_total: number;
        }[];
      };
      admin_upsert_game_setting: {
        Args: {
          p_key: string;
          p_value: Json;
          p_description?: string | null;
        };
        Returns: Database["public"]["Tables"]["game_settings"]["Row"][];
      };
      admin_list_audit_logs: {
        Args: {
          p_action?: string | null;
          p_entity_type?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          actor_user_id: string | null;
          actor_nickname: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          payload: Json;
          created_at: string;
        }[];
      };
      create_game_round: {
        Args: {
          p_scheduled_at?: string | null;
          p_metadata?: Json;
        };
        Returns: Database["public"]["Tables"]["game_rounds"]["Row"][];
      };
      activate_game_round: {
        Args: {
          p_game_round_id: string;
          p_lucky_ball_probability?: number;
          p_extra_spins_p1?: number;
          p_extra_spins_p2?: number;
          p_extra_spins_p3?: number;
          p_metadata?: Json;
        };
        Returns: Database["public"]["Tables"]["game_rounds"]["Row"][];
      };
      finalize_game_round: {
        Args: {
          p_game_round_id: string;
          p_metadata?: Json;
        };
        Returns: Database["public"]["Tables"]["game_rounds"]["Row"][];
      };
      settle_game_round_line_prizes: {
        Args: {
          p_game_round_id: string;
          p_base_prize?: number;
          p_metadata?: Json;
        };
        Returns: {
          line_win_id: string;
          user_id: string;
          board_id: string;
          line_type: "row_1" | "row_2" | "row_3" | "col_1" | "col_2" | "col_3";
          line_numbers: number[];
          applied_multiplier: number;
          base_prize: number;
          prize_amount: number;
          wallet_transaction_id: string;
        }[];
      };
      get_active_game_round_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      run_game_round_automation: {
        Args: {
          p_draw_interval_seconds?: number;
          p_prestart_animation_seconds?: number;
          p_round_cooldown_seconds?: number;
          p_base_prize?: number;
          p_lucky_ball_probability?: number;
          p_extra_spins_p1?: number;
          p_extra_spins_p2?: number;
          p_extra_spins_p3?: number;
          p_metadata?: Json;
        };
        Returns: Json;
      };
      purchase_bingo_boards: {
        Args: {
          p_quantity: number;
          p_game_id?: string | null;
          p_request_ref?: string | null;
          p_metadata?: Json;
        };
        Returns: {
          purchase_id: string;
          board_id: string;
          board_index: number;
          board_fingerprint: string;
          grid: Json;
          wallet_transaction_id: string;
          quantity: number;
          unit_price: number;
          total_amount: number;
        }[];
      };
    };
    Enums: {
      app_role: "user" | "admin";
      account_status: "pending" | "active" | "suspended";
      topup_status: "pending" | "approved" | "rejected";
      topup_provider: "payphone" | "bank_transfer";
      topup_event_type: "created" | "provider_update" | "approved" | "rejected";
      withdrawal_status: "pending" | "approved" | "paid" | "rejected";
      bank_account_type: "savings" | "checking";
      withdrawal_event_type: "created" | "approved" | "paid" | "rejected";
      board_purchase_status: "pending" | "completed" | "failed";
      game_round_status: "scheduled" | "active" | "finished";
      bingo_line_type: "row_1" | "row_2" | "row_3" | "col_1" | "col_2" | "col_3";
      wallet_movement_type:
        | "topup"
        | "prize"
        | "board_purchase"
        | "withdrawal"
        | "admin_adjustment";
      wallet_direction: "credit" | "debit";
    };
    CompositeTypes: Record<string, never>;
  };
};
