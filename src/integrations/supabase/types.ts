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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_history: {
        Row: {
          content: string
          created_at: string
          id: number
          project_id: number
          role: string
          section: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id: number
          project_id: number
          role: string
          section: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: number
          project_id?: number
          role?: string
          section?: string
          user_id?: string
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          document_type: string | null
          file_name: string | null
          file_path: string | null
          id: string | null
          notes: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          user_id: string | null
        }
        Insert: {
          document_type?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string | null
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          user_id?: string | null
        }
        Update: {
          document_type?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string | null
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string | null
          invited_by: string | null
          token: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          token?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          token?: string | null
        }
        Relationships: []
      }
      concepts: {
        Row: {
          allergen_declaration: Json | null
          approved_by: string | null
          baking_temp: string | null
          baking_temp_unit: string | null
          baking_time_minutes: string | null
          certifications_claims: Json | null
          core_problem_solved: string | null
          created_at: string | null
          customer_name: string | null
          date_of_issue: string | null
          desired_claims: string | null
          dietary_category: Json | null
          id: number | null
          intended_use: string | null
          key_qualities: string | null
          last_review_date: string | null
          net_weight: string | null
          net_weight_unit: string | null
          next_review_date: string | null
          notes: string | null
          nutritional_panel: Json | null
          parent_concept_id: string | null
          prepared_by: string | null
          processing_steps: Json | null
          product_appearance: string | null
          product_code: string | null
          product_description: string | null
          product_image_name: string | null
          product_image_path: string | null
          product_image_uploaded_at: string | null
          product_name: string | null
          product_type: string | null
          pss_file_name: string | null
          pss_file_path: string | null
          pss_uploaded_at: string | null
          quality_specs: Json | null
          revision_number: string | null
          shape: string | null
          status: string | null
          target_market: string | null
          target_shelf_life: string | null
          unit_height: string | null
          unit_length: string | null
          unit_width: string | null
          user_id: string | null
          version_number: string | null
        }
        Insert: {
          allergen_declaration?: Json | null
          approved_by?: string | null
          baking_temp?: string | null
          baking_temp_unit?: string | null
          baking_time_minutes?: string | null
          certifications_claims?: Json | null
          core_problem_solved?: string | null
          created_at?: string | null
          customer_name?: string | null
          date_of_issue?: string | null
          desired_claims?: string | null
          dietary_category?: Json | null
          id?: number | null
          intended_use?: string | null
          key_qualities?: string | null
          last_review_date?: string | null
          net_weight?: string | null
          net_weight_unit?: string | null
          next_review_date?: string | null
          notes?: string | null
          nutritional_panel?: Json | null
          parent_concept_id?: string | null
          prepared_by?: string | null
          processing_steps?: Json | null
          product_appearance?: string | null
          product_code?: string | null
          product_description?: string | null
          product_image_name?: string | null
          product_image_path?: string | null
          product_image_uploaded_at?: string | null
          product_name?: string | null
          product_type?: string | null
          pss_file_name?: string | null
          pss_file_path?: string | null
          pss_uploaded_at?: string | null
          quality_specs?: Json | null
          revision_number?: string | null
          shape?: string | null
          status?: string | null
          target_market?: string | null
          target_shelf_life?: string | null
          unit_height?: string | null
          unit_length?: string | null
          unit_width?: string | null
          user_id?: string | null
          version_number?: string | null
        }
        Update: {
          allergen_declaration?: Json | null
          approved_by?: string | null
          baking_temp?: string | null
          baking_temp_unit?: string | null
          baking_time_minutes?: string | null
          certifications_claims?: Json | null
          core_problem_solved?: string | null
          created_at?: string | null
          customer_name?: string | null
          date_of_issue?: string | null
          desired_claims?: string | null
          dietary_category?: Json | null
          id?: number | null
          intended_use?: string | null
          key_qualities?: string | null
          last_review_date?: string | null
          net_weight?: string | null
          net_weight_unit?: string | null
          next_review_date?: string | null
          notes?: string | null
          nutritional_panel?: Json | null
          parent_concept_id?: string | null
          prepared_by?: string | null
          processing_steps?: Json | null
          product_appearance?: string | null
          product_code?: string | null
          product_description?: string | null
          product_image_name?: string | null
          product_image_path?: string | null
          product_image_uploaded_at?: string | null
          product_name?: string | null
          product_type?: string | null
          pss_file_name?: string | null
          pss_file_path?: string | null
          pss_uploaded_at?: string | null
          quality_specs?: Json | null
          revision_number?: string | null
          shape?: string | null
          status?: string | null
          target_market?: string | null
          target_shelf_life?: string | null
          unit_height?: string | null
          unit_length?: string | null
          unit_width?: string | null
          user_id?: string | null
          version_number?: string | null
        }
        Relationships: []
      }
      costing: {
        Row: {
          concept_id: number | null
          created_at: string
          id: number
          ingredient_cost: number | null
          labor_cost: number | null
          margin_percentage: number | null
          notes: string | null
          overhead_cost: number | null
          packaging_cost: number | null
          product_id: number | null
          target_price: number | null
          total_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          concept_id?: number | null
          created_at?: string
          id?: number
          ingredient_cost?: number | null
          labor_cost?: number | null
          margin_percentage?: number | null
          notes?: string | null
          overhead_cost?: number | null
          packaging_cost?: number | null
          product_id?: number | null
          target_price?: number | null
          total_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          concept_id?: number | null
          created_at?: string
          id?: number
          ingredient_cost?: number | null
          labor_cost?: number | null
          margin_percentage?: number | null
          notes?: string | null
          overhead_cost?: number | null
          packaging_cost?: number | null
          product_id?: number | null
          target_price?: number | null
          total_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      formulas: {
        Row: {
          id: string
          ingredient_id: string | null
          percentage: number
          product_id: string | null
        }
        Insert: {
          id?: string
          ingredient_id?: string | null
          percentage: number
          product_id?: string | null
        }
        Update: {
          id?: string
          ingredient_id?: string | null
          percentage?: number
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formulas_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulas_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_specs: {
        Row: {
          concept_id: number | null
          created_at: string
          id: number
          ingredient_cost: number | null
          labor_cost: number | null
          margin_percentage: number | null
          notes: string | null
          overhead_cost: number | null
          packaging_cost: number | null
          product_id: number | null
          target_price: number | null
          total_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          concept_id?: number | null
          created_at?: string
          id?: number
          ingredient_cost?: number | null
          labor_cost?: number | null
          margin_percentage?: number | null
          notes?: string | null
          overhead_cost?: number | null
          packaging_cost?: number | null
          product_id?: number | null
          target_price?: number | null
          total_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          concept_id?: number | null
          created_at?: string
          id?: number
          ingredient_cost?: number | null
          labor_cost?: number | null
          margin_percentage?: number | null
          notes?: string | null
          overhead_cost?: number | null
          packaging_cost?: number | null
          product_id?: number | null
          target_price?: number | null
          total_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          cost_per_lb: number | null
          id: string
          name: string
          unit_of_measure: string | null
        }
        Insert: {
          cost_per_lb?: number | null
          id?: string
          name: string
          unit_of_measure?: string | null
        }
        Update: {
          cost_per_lb?: number | null
          id?: string
          name?: string
          unit_of_measure?: string | null
        }
        Relationships: []
      }
      internal_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string | null
          notification_type: string
          read_at: string | null
          reference_id: string | null
          reference_table: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type: string
          read_at?: string | null
          reference_id?: string | null
          reference_table?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type?: string
          read_at?: string | null
          reference_id?: string | null
          reference_table?: string | null
          title?: string
        }
        Relationships: []
      }
      packaging: {
        Row: {
          compliance_notes: string | null
          concept_id: number | null
          cost_per_unit: number | null
          created_at: string
          dimensions: string | null
          id: number
          labeling_status: string | null
          material: string | null
          notes: string | null
          package_type: string | null
          product_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compliance_notes?: string | null
          concept_id?: number | null
          cost_per_unit?: number | null
          created_at?: string
          dimensions?: string | null
          id: number
          labeling_status?: string | null
          material?: string | null
          notes?: string | null
          package_type?: string | null
          product_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compliance_notes?: string | null
          concept_id?: number | null
          cost_per_unit?: number | null
          created_at?: string
          dimensions?: string | null
          id?: number
          labeling_status?: string | null
          material?: string | null
          notes?: string | null
          package_type?: string | null
          product_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prf_submissions: {
        Row: {
          additional_project_info: string | null
          additional_requirements: Json | null
          annual_volume: string | null
          artwork_readiness: string | null
          company_name: string | null
          company_stage: string
          created_at: string
          development_approach: string | null
          email: string | null
          finished_form: Json | null
          flavor_type: string | null
          founder_name: string | null
          id: string
          intended_application: Json | null
          is_nutraceutical: boolean | null
          label_responsibility: string | null
          master_carton_requirements: string | null
          net_weight_per_primary_pack: string | null
          net_weight_per_primary_pack_unit: string | null
          order_frequency: string | null
          order_quantity: string | null
          packaging_readiness: string | null
          pallets_required: string | null
          phone: string | null
          price_target_per_unit: string | null
          primary_packaging_other: string | null
          primary_packaging_vessel: string | null
          product_name: string | null
          project_type: string | null
          secondary_packaging: string | null
          secondary_packaging_other: string | null
          shipping_tbd: boolean | null
          stage2_submission_id: string | null
          status: string
          target_date: string | null
          unit_dimension_h: string | null
          unit_dimension_l: string | null
          unit_dimension_unit: string | null
          unit_dimension_w: string | null
          units_per_primary_pack: string | null
          units_per_vessel: string | null
          warehousing_needs: Json | null
          weight_per_unit: string | null
          weight_per_unit_unit: string | null
        }
        Insert: {
          additional_project_info?: string | null
          additional_requirements?: Json | null
          annual_volume?: string | null
          artwork_readiness?: string | null
          company_name?: string | null
          company_stage: string
          created_at?: string
          development_approach?: string | null
          email?: string | null
          finished_form?: Json | null
          flavor_type?: string | null
          founder_name?: string | null
          id?: string
          intended_application?: Json | null
          is_nutraceutical?: boolean | null
          label_responsibility?: string | null
          master_carton_requirements?: string | null
          net_weight_per_primary_pack?: string | null
          net_weight_per_primary_pack_unit?: string | null
          order_frequency?: string | null
          order_quantity?: string | null
          packaging_readiness?: string | null
          pallets_required?: string | null
          phone?: string | null
          price_target_per_unit?: string | null
          primary_packaging_other?: string | null
          primary_packaging_vessel?: string | null
          product_name?: string | null
          project_type?: string | null
          secondary_packaging?: string | null
          secondary_packaging_other?: string | null
          shipping_tbd?: boolean | null
          stage2_submission_id?: string | null
          status?: string
          target_date?: string | null
          unit_dimension_h?: string | null
          unit_dimension_l?: string | null
          unit_dimension_unit?: string | null
          unit_dimension_w?: string | null
          units_per_primary_pack?: string | null
          units_per_vessel?: string | null
          warehousing_needs?: Json | null
          weight_per_unit?: string | null
          weight_per_unit_unit?: string | null
        }
        Update: {
          additional_project_info?: string | null
          additional_requirements?: Json | null
          annual_volume?: string | null
          artwork_readiness?: string | null
          company_name?: string | null
          company_stage?: string
          created_at?: string
          development_approach?: string | null
          email?: string | null
          finished_form?: Json | null
          flavor_type?: string | null
          founder_name?: string | null
          id?: string
          intended_application?: Json | null
          is_nutraceutical?: boolean | null
          label_responsibility?: string | null
          master_carton_requirements?: string | null
          net_weight_per_primary_pack?: string | null
          net_weight_per_primary_pack_unit?: string | null
          order_frequency?: string | null
          order_quantity?: string | null
          packaging_readiness?: string | null
          pallets_required?: string | null
          phone?: string | null
          price_target_per_unit?: string | null
          primary_packaging_other?: string | null
          primary_packaging_vessel?: string | null
          product_name?: string | null
          project_type?: string | null
          secondary_packaging?: string | null
          secondary_packaging_other?: string | null
          shipping_tbd?: boolean | null
          stage2_submission_id?: string | null
          status?: string
          target_date?: string | null
          unit_dimension_h?: string | null
          unit_dimension_l?: string | null
          unit_dimension_unit?: string | null
          unit_dimension_w?: string | null
          units_per_primary_pack?: string | null
          units_per_vessel?: string | null
          warehousing_needs?: Json | null
          weight_per_unit?: string | null
          weight_per_unit_unit?: string | null
        }
        Relationships: []
      }
      private_label_requests: {
        Row: {
          additional_comments: string | null
          baked_good_type: string | null
          client_name: string
          company_name: string
          created_at: string
          dietary_claims: Json | null
          dietary_claims_other: string | null
          email: string
          id: string
          moq_acknowledged: boolean | null
          packaging_plans: string | null
          packaging_types: string | null
          packs_per_case: string | null
          phone: string
          product_specifications: string | null
          sample_policy_acknowledged: boolean | null
          shelf_life_requirements: string | null
          status: string | null
          units_per_pack: string | null
        }
        Insert: {
          additional_comments?: string | null
          baked_good_type?: string | null
          client_name: string
          company_name: string
          created_at?: string
          dietary_claims?: Json | null
          dietary_claims_other?: string | null
          email: string
          id?: string
          moq_acknowledged?: boolean | null
          packaging_plans?: string | null
          packaging_types?: string | null
          packs_per_case?: string | null
          phone: string
          product_specifications?: string | null
          sample_policy_acknowledged?: boolean | null
          shelf_life_requirements?: string | null
          status?: string | null
          units_per_pack?: string | null
        }
        Update: {
          additional_comments?: string | null
          baked_good_type?: string | null
          client_name?: string
          company_name?: string
          created_at?: string
          dietary_claims?: Json | null
          dietary_claims_other?: string | null
          email?: string
          id?: string
          moq_acknowledged?: boolean | null
          packaging_plans?: string | null
          packaging_types?: string | null
          packs_per_case?: string | null
          phone?: string
          product_specifications?: string | null
          sample_policy_acknowledged?: boolean | null
          shelf_life_requirements?: string | null
          status?: string | null
          units_per_pack?: string | null
        }
        Relationships: []
      }
      production_intake: {
        Row: {
          additional_comments: string | null
          baked_good_type: string | null
          client_name: string
          company_name: string
          created_at: string
          dietary_claims: Json | null
          dietary_claims_other: string | null
          email: string
          id: string
          moq_acknowledged: boolean | null
          packaging_plans: string | null
          packaging_types: string | null
          packs_per_case: string | null
          phone: string
          product_specifications: string | null
          sample_policy_acknowledged: boolean | null
          shelf_life_requirements: string | null
          status: string | null
          units_per_pack: string | null
        }
        Insert: {
          additional_comments?: string | null
          baked_good_type?: string | null
          client_name: string
          company_name: string
          created_at?: string
          dietary_claims?: Json | null
          dietary_claims_other?: string | null
          email: string
          id?: string
          moq_acknowledged?: boolean | null
          packaging_plans?: string | null
          packaging_types?: string | null
          packs_per_case?: string | null
          phone: string
          product_specifications?: string | null
          sample_policy_acknowledged?: boolean | null
          shelf_life_requirements?: string | null
          status?: string | null
          units_per_pack?: string | null
        }
        Update: {
          additional_comments?: string | null
          baked_good_type?: string | null
          client_name?: string
          company_name?: string
          created_at?: string
          dietary_claims?: Json | null
          dietary_claims_other?: string | null
          email?: string
          id?: string
          moq_acknowledged?: boolean | null
          packaging_plans?: string | null
          packaging_types?: string | null
          packs_per_case?: string | null
          phone?: string
          product_specifications?: string | null
          sample_policy_acknowledged?: boolean | null
          shelf_life_requirements?: string | null
          status?: string | null
          units_per_pack?: string | null
        }
        Relationships: []
      }
      production_orders: {
        Row: {
          case_count: number
          created_at: string | null
          created_by: string | null
          id: string
          product_id: string | null
          status: string | null
        }
        Insert: {
          case_count: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          product_id?: string | null
          status?: string | null
        }
        Update: {
          case_count?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          product_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          product_name: string
          sku: string | null
          target_unit_weight_oz: number | null
          units_per_case: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          product_name: string
          sku?: string | null
          target_unit_weight_oz?: number | null
          units_per_case?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          product_name?: string
          sku?: string | null
          target_unit_weight_oz?: number | null
          units_per_case?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          business_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
      readiness: {
        Row: {
          concept_complete: boolean | null
          concept_id: number | null
          costing_complete: boolean | null
          created_at: string
          formula_complete: boolean | null
          id: number
          ingredients_complete: boolean | null
          notes: string | null
          overall_readiness_percent: number | null
          packaging_complete: boolean | null
          product_id: number | null
          shelf_life_complete: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          concept_complete?: boolean | null
          concept_id?: number | null
          costing_complete?: boolean | null
          created_at?: string
          formula_complete?: boolean | null
          id: number
          ingredients_complete?: boolean | null
          notes?: string | null
          overall_readiness_percent?: number | null
          packaging_complete?: boolean | null
          product_id?: number | null
          shelf_life_complete?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          concept_complete?: boolean | null
          concept_id?: number | null
          costing_complete?: boolean | null
          created_at?: string
          formula_complete?: boolean | null
          id?: number
          ingredients_complete?: boolean | null
          notes?: string | null
          overall_readiness_percent?: number | null
          packaging_complete?: boolean | null
          product_id?: number | null
          shelf_life_complete?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shelf_life: {
        Row: {
          aw_test_result: number | null
          barrier_type: Json | null
          concept_id: number | null
          created_at: string
          functional_ingredients: Json | null
          id: number
          moisture_pct: number | null
          notes: string | null
          packaging_material: string | null
          ph_level: number | null
          preservation_strategy: string | null
          product_id: number | null
          shelf_life_days: number | null
          storage_condition: string
          test_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aw_test_result?: number | null
          barrier_type?: Json | null
          concept_id?: number | null
          created_at?: string
          functional_ingredients?: Json | null
          id: number
          moisture_pct?: number | null
          notes?: string | null
          packaging_material?: string | null
          ph_level?: number | null
          preservation_strategy?: string | null
          product_id?: number | null
          shelf_life_days?: number | null
          storage_condition: string
          test_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aw_test_result?: number | null
          barrier_type?: Json | null
          concept_id?: number | null
          created_at?: string
          functional_ingredients?: Json | null
          id?: number
          moisture_pct?: number | null
          notes?: string | null
          packaging_material?: string | null
          ph_level?: number | null
          preservation_strategy?: string | null
          product_id?: number | null
          shelf_life_days?: number | null
          storage_condition?: string
          test_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stage2_prf_submissions: {
        Row: {
          company_stage: string | null
          created_at: string | null
          data_json: Json | null
          id: string | null
          lead_id: string | null
          status: string | null
          submitted_at: string | null
        }
        Insert: {
          company_stage?: string | null
          created_at?: string | null
          data_json?: Json | null
          id?: string | null
          lead_id?: string | null
          status?: string | null
          submitted_at?: string | null
        }
        Update: {
          company_stage?: string | null
          created_at?: string | null
          data_json?: Json | null
          id?: string | null
          lead_id?: string | null
          status?: string | null
          submitted_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      weight_conversions: {
        Row: {
          grams_per_unit: number | null
          id: number | null
          ingredient_name: string | null
          unit: string | null
        }
        Insert: {
          grams_per_unit?: number | null
          id?: number | null
          ingredient_name?: string | null
          unit?: string | null
        }
        Update: {
          grams_per_unit?: number | null
          id?: number | null
          ingredient_name?: string | null
          unit?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_staff_or_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff" | "user"
      user_role: "SuperAdmin" | "Manager" | "Staff" | "Client"
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
      app_role: ["admin", "staff", "user"],
      user_role: ["SuperAdmin", "Manager", "Staff", "Client"],
    },
  },
} as const
