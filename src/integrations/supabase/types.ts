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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adapter_inspections: {
        Row: {
          adapter: string | null
          ats_type: string | null
          auto_apply_eligible: boolean | null
          captcha_detected: boolean | null
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          locked_at: string | null
          login_required: boolean | null
          mapped_fields: Json
          mode: string
          reason: string | null
          requested_by: string
          required_fields: Json
          status: string
          unknown_fields: Json
          url: string
          worker_id: string | null
        }
        Insert: {
          adapter?: string | null
          ats_type?: string | null
          auto_apply_eligible?: boolean | null
          captcha_detected?: boolean | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          locked_at?: string | null
          login_required?: boolean | null
          mapped_fields?: Json
          mode?: string
          reason?: string | null
          requested_by: string
          required_fields?: Json
          status?: string
          unknown_fields?: Json
          url: string
          worker_id?: string | null
        }
        Update: {
          adapter?: string | null
          ats_type?: string | null
          auto_apply_eligible?: boolean | null
          captcha_detected?: boolean | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          locked_at?: string | null
          login_required?: boolean | null
          mapped_fields?: Json
          mode?: string
          reason?: string | null
          requested_by?: string
          required_fields?: Json
          status?: string
          unknown_fields?: Json
          url?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      adapter_registry: {
        Row: {
          adapter: string
          authorized_submission_supported: boolean
          connection_status: string
          discovery: boolean
          health: string
          label: string
          last_checked_at: string | null
          last_error: string | null
          public_discovery_supported: boolean
          public_form_submission_supported: boolean
          schema_discovery: boolean
          submission: boolean
          updated_at: string
          verification: boolean
        }
        Insert: {
          adapter: string
          authorized_submission_supported?: boolean
          connection_status?: string
          discovery?: boolean
          health?: string
          label: string
          last_checked_at?: string | null
          last_error?: string | null
          public_discovery_supported?: boolean
          public_form_submission_supported?: boolean
          schema_discovery?: boolean
          submission?: boolean
          updated_at?: string
          verification?: boolean
        }
        Update: {
          adapter?: string
          authorized_submission_supported?: boolean
          connection_status?: string
          discovery?: boolean
          health?: string
          label?: string
          last_checked_at?: string | null
          last_error?: string | null
          public_discovery_supported?: boolean
          public_form_submission_supported?: boolean
          schema_discovery?: boolean
          submission?: boolean
          updated_at?: string
          verification?: boolean
        }
        Relationships: []
      }
      application_answers: {
        Row: {
          answer_type: string
          boolean_value: boolean | null
          canonical_key: string
          id: string
          numeric_value: number | null
          text_value: string | null
          updated_at: string
          user_confirmed: boolean
          user_id: string
        }
        Insert: {
          answer_type: string
          boolean_value?: boolean | null
          canonical_key: string
          id?: string
          numeric_value?: number | null
          text_value?: string | null
          updated_at?: string
          user_confirmed?: boolean
          user_id: string
        }
        Update: {
          answer_type?: string
          boolean_value?: boolean | null
          canonical_key?: string
          id?: string
          numeric_value?: number | null
          text_value?: string | null
          updated_at?: string
          user_confirmed?: boolean
          user_id?: string
        }
        Relationships: []
      }
      application_attempts: {
        Row: {
          test_mode: boolean
          adapter: string | null
          adapter_version: string | null
          attempt_number: number
          batch_id: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          evidence_path: string | null
          id: string
          job_id: string
          queued_at: string
          resume_variant_id: string | null
          started_at: string | null
          status: string
          submission_reference: string | null
          submitted_at: string | null
          user_id: string
          verification_type: string | null
          verification_value: string | null
          verified_at: string | null
        }
        Insert: {
          test_mode?: boolean
          adapter?: string | null
          adapter_version?: string | null
          attempt_number?: number
          batch_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          evidence_path?: string | null
          id?: string
          job_id: string
          queued_at?: string
          resume_variant_id?: string | null
          started_at?: string | null
          status?: string
          submission_reference?: string | null
          submitted_at?: string | null
          user_id: string
          verification_type?: string | null
          verification_value?: string | null
          verified_at?: string | null
        }
        Update: {
          test_mode?: boolean
          adapter?: string | null
          adapter_version?: string | null
          attempt_number?: number
          batch_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          evidence_path?: string | null
          id?: string
          job_id?: string
          queued_at?: string
          resume_variant_id?: string | null
          started_at?: string | null
          status?: string
          submission_reference?: string | null
          submitted_at?: string | null
          user_id?: string
          verification_type?: string | null
          verification_value?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_attempts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "application_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_attempts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_attempts_resume_variant_id_fkey"
            columns: ["resume_variant_id"]
            isOneToOne: false
            referencedRelation: "resume_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      application_audit_log: {
        Row: {
          application_attempt_id: string | null
          created_at: string
          event_type: string
          id: string
          job_id: string | null
          metadata: Json
          user_id: string | null
        }
        Insert: {
          application_attempt_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          job_id?: string | null
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          application_attempt_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          job_id?: string | null
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      application_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          failed_count: number
          id: string
          processing_count: number
          queued_count: number
          status: string
          total_selected: number
          user_id: string
          verified_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          processing_count?: number
          queued_count?: number
          status?: string
          total_selected?: number
          user_id: string
          verified_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          processing_count?: number
          queued_count?: number
          status?: string
          total_selected?: number
          user_id?: string
          verified_count?: number
        }
        Relationships: []
      }
      application_credits: {
        Row: {
          consumed: number
          granted: number
          id: string
          period_end: string
          period_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consumed?: number
          granted?: number
          id?: string
          period_end: string
          period_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consumed?: number
          granted?: number
          id?: string
          period_end?: string
          period_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      application_queue: {
        Row: {
          test_mode: boolean
          attempt_id: string | null
          attempts: number
          batch_id: string | null
          created_at: string
          id: string
          job_id: string
          locked_at: string | null
          next_attempt_at: string
          priority: number
          status: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          test_mode?: boolean
          attempt_id?: string | null
          attempts?: number
          batch_id?: string | null
          created_at?: string
          id?: string
          job_id: string
          locked_at?: string | null
          next_attempt_at?: string
          priority?: number
          status?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          test_mode?: boolean
          attempt_id?: string | null
          attempts?: number
          batch_id?: string | null
          created_at?: string
          id?: string
          job_id?: string
          locked_at?: string | null
          next_attempt_at?: string
          priority?: number
          status?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_queue_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "application_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_queue_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "application_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      application_schemas: {
        Row: {
          adapter: string
          captcha_detected: boolean
          fields: Json
          id: string
          job_id: string | null
          last_verified_at: string | null
          login_required: boolean
          required_fields: Json
          schema_version: string
          supports_auto_submit: boolean
          supports_file_upload: boolean
          unknown_required_fields: Json
          valid: boolean
        }
        Insert: {
          adapter: string
          captcha_detected?: boolean
          fields?: Json
          id?: string
          job_id?: string | null
          last_verified_at?: string | null
          login_required?: boolean
          required_fields?: Json
          schema_version?: string
          supports_auto_submit?: boolean
          supports_file_upload?: boolean
          unknown_required_fields?: Json
          valid?: boolean
        }
        Update: {
          adapter?: string
          captcha_detected?: boolean
          fields?: Json
          id?: string
          job_id?: string | null
          last_verified_at?: string | null
          login_required?: boolean
          required_fields?: Json
          schema_version?: string
          supports_auto_submit?: boolean
          supports_file_upload?: boolean
          unknown_required_fields?: Json
          valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "application_schemas_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      application_snapshots: {
        Row: {
          answers: Json
          application_attempt_id: string
          id: string
          job_snapshot: Json
          profile_snapshot: Json
          resume_variant_id: string | null
          submitted_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          application_attempt_id: string
          id?: string
          job_snapshot?: Json
          profile_snapshot?: Json
          resume_variant_id?: string | null
          submitted_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          application_attempt_id?: string
          id?: string
          job_snapshot?: Json
          profile_snapshot?: Json
          resume_variant_id?: string | null
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_snapshots_application_attempt_id_fkey"
            columns: ["application_attempt_id"]
            isOneToOne: false
            referencedRelation: "application_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_snapshots_resume_variant_id_fkey"
            columns: ["resume_variant_id"]
            isOneToOne: false
            referencedRelation: "resume_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_apply_consents: {
        Row: {
          authorized: boolean
          authorized_at: string | null
          revoked_at: string | null
          terms_version: string
          user_id: string
        }
        Insert: {
          authorized?: boolean
          authorized_at?: string | null
          revoked_at?: string | null
          terms_version?: string
          user_id: string
        }
        Update: {
          authorized?: boolean
          authorized_at?: string | null
          revoked_at?: string | null
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean
          ats_identifier: string | null
          ats_type: string | null
          auto_apply_supported: boolean
          careers_url: string | null
          created_at: string
          id: string
          last_scanned_at: string | null
          logo_url: string | null
          name: string
          website: string | null
        }
        Insert: {
          active?: boolean
          ats_identifier?: string | null
          ats_type?: string | null
          auto_apply_supported?: boolean
          careers_url?: string | null
          created_at?: string
          id?: string
          last_scanned_at?: string | null
          logo_url?: string | null
          name: string
          website?: string | null
        }
        Update: {
          active?: boolean
          ats_identifier?: string | null
          ats_type?: string | null
          auto_apply_supported?: boolean
          careers_url?: string | null
          created_at?: string
          id?: string
          last_scanned_at?: string | null
          logo_url?: string | null
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      educations: {
        Row: {
          created_at: string
          degree: string | null
          end_date: string | null
          field: string | null
          id: string
          institution: string
          is_current: boolean
          start_date: string | null
          updated_at: string
          user_id: string
          verified_by_user: boolean
        }
        Insert: {
          created_at?: string
          degree?: string | null
          end_date?: string | null
          field?: string | null
          id?: string
          institution: string
          is_current?: boolean
          start_date?: string | null
          updated_at?: string
          user_id: string
          verified_by_user?: boolean
        }
        Update: {
          created_at?: string
          degree?: string | null
          end_date?: string | null
          field?: string | null
          id?: string
          institution?: string
          is_current?: boolean
          start_date?: string | null
          updated_at?: string
          user_id?: string
          verified_by_user?: boolean
        }
        Relationships: []
      }
      experiences: {
        Row: {
          achievements: Json
          company: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_current: boolean
          sort_order: number
          source: string
          start_date: string | null
          title: string
          updated_at: string
          user_id: string
          verified_by_user: boolean
        }
        Insert: {
          achievements?: Json
          company: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          sort_order?: number
          source?: string
          start_date?: string | null
          title: string
          updated_at?: string
          user_id: string
          verified_by_user?: boolean
        }
        Update: {
          achievements?: Json
          company?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          sort_order?: number
          source?: string
          start_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          verified_by_user?: boolean
        }
        Relationships: []
      }
      job_matches: {
        Row: {
          created_at: string
          experience_score: number | null
          explanation: Json
          hard_requirements_met: boolean
          id: string
          job_id: string
          location_score: number | null
          match_score: number
          preferences_score: number | null
          role_score: number | null
          seniority_score: number | null
          skills_score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          experience_score?: number | null
          explanation?: Json
          hard_requirements_met?: boolean
          id?: string
          job_id: string
          location_score?: number | null
          match_score: number
          preferences_score?: number | null
          role_score?: number | null
          seniority_score?: number | null
          skills_score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          experience_score?: number | null
          explanation?: Json
          hard_requirements_met?: boolean
          id?: string
          job_id?: string
          location_score?: number | null
          match_score?: number
          preferences_score?: number | null
          role_score?: number | null
          seniority_score?: number | null
          skills_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      career_contexts: {
        Row: {
          availability: string | null
          avoid_tasks: string[]
          career_goal: string | null
          challenge_story: string | null
          differentiators: string[]
          preferred_tasks: string[]
          proud_project: string | null
          responsibilities: string[]
          results: string[]
          strengths: string[]
          target_environment: string | null
          tools: string[]
          travel_preference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: string | null
          avoid_tasks?: string[]
          career_goal?: string | null
          challenge_story?: string | null
          differentiators?: string[]
          preferred_tasks?: string[]
          proud_project?: string | null
          responsibilities?: string[]
          results?: string[]
          strengths?: string[]
          target_environment?: string | null
          tools?: string[]
          travel_preference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: string | null
          avoid_tasks?: string[]
          career_goal?: string | null
          challenge_story?: string | null
          differentiators?: string[]
          preferred_tasks?: string[]
          proud_project?: string | null
          responsibilities?: string[]
          results?: string[]
          strengths?: string[]
          target_environment?: string | null
          tools?: string[]
          travel_preference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fact_ledger: {
        Row: {
          allowed_for_resume: boolean
          claim: string
          confidence: number
          created_at: string
          fact_type: string
          id: string
          metadata: Json
          source_ref: string | null
          source_type: string
          updated_at: string
          user_confirmed: boolean
          user_id: string
        }
        Insert: {
          allowed_for_resume?: boolean
          claim: string
          confidence?: number
          created_at?: string
          fact_type: string
          id?: string
          metadata?: Json
          source_ref?: string | null
          source_type: string
          updated_at?: string
          user_confirmed?: boolean
          user_id: string
        }
        Update: {
          allowed_for_resume?: boolean
          claim?: string
          confidence?: number
          created_at?: string
          fact_type?: string
          id?: string
          metadata?: Json
          source_ref?: string | null
          source_type?: string
          updated_at?: string
          user_confirmed?: boolean
          user_id?: string
        }
        Relationships: []
      }
      onboarding_drafts: {
        Row: {
          last_step: number
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          last_step?: number
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          last_step?: number
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      writing_preferences: {
        Row: {
          de_emphasis: string[]
          emphasis: string[]
          summary_style: string
          updated_at: string
          user_id: string
          voice: string
        }
        Insert: {
          de_emphasis?: string[]
          emphasis?: string[]
          summary_style?: string
          updated_at?: string
          user_id: string
          voice?: string
        }
        Update: {
          de_emphasis?: string[]
          emphasis?: string[]
          summary_style?: string
          updated_at?: string
          user_id?: string
          voice?: string
        }
        Relationships: []
      }
      job_preferences: {
        Row: {
          employment_types: string[]
          excluded_companies: string[]
          excluded_industries: string[]
          hybrid_allowed: boolean
          international_remote: boolean
          maximum_applications_per_week: number | null
          minimum_match_score: number
          minimum_salary: number | null
          onsite_allowed: boolean
          preferred_industries: string[]
          remote_allowed: boolean
          salary_currency: string | null
          salary_period: string | null
          seniority_levels: string[]
          target_locations: string[]
          target_roles: string[]
          updated_at: string
          user_id: string
          willing_to_relocate: boolean
        }
        Insert: {
          employment_types?: string[]
          excluded_companies?: string[]
          excluded_industries?: string[]
          hybrid_allowed?: boolean
          international_remote?: boolean
          maximum_applications_per_week?: number | null
          minimum_match_score?: number
          minimum_salary?: number | null
          onsite_allowed?: boolean
          preferred_industries?: string[]
          remote_allowed?: boolean
          salary_currency?: string | null
          salary_period?: string | null
          seniority_levels?: string[]
          target_locations?: string[]
          target_roles?: string[]
          updated_at?: string
          user_id: string
          willing_to_relocate?: boolean
        }
        Update: {
          employment_types?: string[]
          excluded_companies?: string[]
          excluded_industries?: string[]
          hybrid_allowed?: boolean
          international_remote?: boolean
          maximum_applications_per_week?: number | null
          minimum_match_score?: number
          minimum_salary?: number | null
          onsite_allowed?: boolean
          preferred_industries?: string[]
          remote_allowed?: boolean
          salary_currency?: string | null
          salary_period?: string | null
          seniority_levels?: string[]
          target_locations?: string[]
          target_roles?: string[]
          updated_at?: string
          user_id?: string
          willing_to_relocate?: boolean
        }
        Relationships: []
      }
      job_sources: {
        Row: {
          active: boolean
          adapter_name: string
          base_url: string | null
          connection_status: string
          created_at: string
          discovery_enabled: boolean
          id: string
          name: string
          requires_credentials: boolean
          submission_enabled: boolean
          type: string
        }
        Insert: {
          active?: boolean
          adapter_name: string
          base_url?: string | null
          connection_status?: string
          created_at?: string
          discovery_enabled?: boolean
          id?: string
          name: string
          requires_credentials?: boolean
          submission_enabled?: boolean
          type: string
        }
        Update: {
          active?: boolean
          adapter_name?: string
          base_url?: string | null
          connection_status?: string
          created_at?: string
          discovery_enabled?: boolean
          id?: string
          name?: string
          requires_credentials?: boolean
          submission_enabled?: boolean
          type?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          application_schema_id: string | null
          application_url: string | null
          ats_type: string | null
          auto_apply_adapter: string | null
          auto_apply_eligible: boolean
          company_id: string | null
          country: string | null
          description: string | null
          discovered_at: string
          employment_type: string | null
          external_job_id: string
          id: string
          ineligibility_reason: string | null
          is_active: boolean
          last_verified_at: string | null
          location: string | null
          published_at: string | null
          raw_data: Json
          remote_type: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          seniority: string | null
          source_id: string | null
          submission_mechanism: string
          title: string
        }
        Insert: {
          application_schema_id?: string | null
          application_url?: string | null
          ats_type?: string | null
          auto_apply_adapter?: string | null
          auto_apply_eligible?: boolean
          company_id?: string | null
          country?: string | null
          description?: string | null
          discovered_at?: string
          employment_type?: string | null
          external_job_id: string
          id?: string
          ineligibility_reason?: string | null
          is_active?: boolean
          last_verified_at?: string | null
          location?: string | null
          published_at?: string | null
          raw_data?: Json
          remote_type?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          seniority?: string | null
          source_id?: string | null
          submission_mechanism?: string
          title: string
        }
        Update: {
          application_schema_id?: string | null
          application_url?: string | null
          ats_type?: string | null
          auto_apply_adapter?: string | null
          auto_apply_eligible?: boolean
          company_id?: string | null
          country?: string | null
          description?: string | null
          discovered_at?: string
          employment_type?: string | null
          external_job_id?: string
          id?: string
          ineligibility_reason?: string | null
          is_active?: boolean
          last_verified_at?: string | null
          location?: string | null
          published_at?: string | null
          raw_data?: Json
          remote_type?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          seniority?: string | null
          source_id?: string | null
          submission_mechanism?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_application_schema_fk"
            columns: ["application_schema_id"]
            isOneToOne: false
            referencedRelation: "application_schemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          created_at: string
          id: string
          language: string
          level: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language: string
          level: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          level?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          billing_period: string
          code: string
          name: string
          price_amount: number
          price_currency: string
          sort_order: number
          weekly_application_limit: number
        }
        Insert: {
          active?: boolean
          billing_period?: string
          code: string
          name: string
          price_amount: number
          price_currency?: string
          sort_order?: number
          weekly_application_limit: number
        }
        Update: {
          active?: boolean
          billing_period?: string
          code?: string
          name?: string
          price_amount?: number
          price_currency?: string
          sort_order?: number
          weekly_application_limit?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_resume_path: string | null
          city: string | null
          country: string | null
          created_at: string
          current_title: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          linkedin_url: string | null
          master_profile_version: number
          phone: string | null
          portfolio_url: string | null
          professional_summary: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          base_resume_path?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          current_title?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          master_profile_version?: number
          phone?: string | null
          portfolio_url?: string | null
          professional_summary?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          base_resume_path?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          current_title?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          master_profile_version?: number
          phone?: string | null
          portfolio_url?: string | null
          professional_summary?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      resume_variants: {
        Row: {
          base_resume_path: string | null
          created_at: string
          generated_bullets: Json
          generation_model: string | null
          html: string | null
          id: string
          job_id: string | null
          master_profile_version: number
          pdf_path: string | null
          professional_summary: string | null
          selected_experience_ids: string[]
          selected_skill_ids: string[]
          structured_resume: Json
          user_id: string
          validation_issues: Json
          validation_status: string
        }
        Insert: {
          base_resume_path?: string | null
          created_at?: string
          generated_bullets?: Json
          generation_model?: string | null
          html?: string | null
          id?: string
          job_id?: string | null
          master_profile_version?: number
          pdf_path?: string | null
          professional_summary?: string | null
          selected_experience_ids?: string[]
          selected_skill_ids?: string[]
          structured_resume?: Json
          user_id: string
          validation_issues?: Json
          validation_status?: string
        }
        Update: {
          base_resume_path?: string | null
          created_at?: string
          generated_bullets?: Json
          generation_model?: string | null
          html?: string | null
          id?: string
          job_id?: string | null
          master_profile_version?: number
          pdf_path?: string | null
          professional_summary?: string | null
          selected_experience_ids?: string[]
          selected_skill_ids?: string[]
          structured_resume?: Json
          user_id?: string
          validation_issues?: Json
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_variants_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
          verified_by_user: boolean
          years_experience: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
          verified_by_user?: boolean
          years_experience?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
          verified_by_user?: boolean
          years_experience?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_code: string | null
          provider: string | null
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_code?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_code?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_application: {
        Args: { _limit?: number; _worker_id: string }
        Returns: {
          test_mode: boolean
          attempt_id: string | null
          attempts: number
          batch_id: string | null
          created_at: string
          id: string
          job_id: string
          locked_at: string | null
          next_attempt_at: string
          priority: number
          status: string
          user_id: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "application_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_inspection: {
        Args: { _limit?: number; _worker_id: string }
        Returns: {
          adapter: string | null
          ats_type: string | null
          auto_apply_eligible: boolean | null
          captcha_detected: boolean | null
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          locked_at: string | null
          login_required: boolean | null
          mapped_fields: Json
          mode: string
          reason: string | null
          requested_by: string
          required_fields: Json
          status: string
          unknown_fields: Json
          url: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "adapter_inspections"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_application: {
        Args: {
          _evidence_path?: string
          _queue_id: string
          _submission_reference: string
        }
        Returns: string
      }
      enqueue_application: {
        Args: {
          _batch_id?: string
          _job_id: string
          _priority?: number
          _user_id: string
        }
        Returns: string
      }
      fail_application: {
        Args: {
          _error_code: string
          _error_message: string
          _queue_id: string
          _status?: string
        }
        Returns: string
      }
      enqueue_admin_dry_run: {
        Args: { _job_id: string; _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      retry_application: {
        Args: {
          _delay_seconds?: number
          _error_code?: string
          _error_message?: string
          _queue_id: string
        }
        Returns: string
      }
      update_attempt_status: {
        Args: { _queue_id: string; _status: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
