
-- 1. Create app_role enum if not exists
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Security definer: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 3. Security definer: is_staff_or_admin
CREATE OR REPLACE FUNCTION public.is_staff_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'staff')
  );
$$;

-- =============================================
-- ENABLE RLS on all tables that need it
-- =============================================
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelf_life ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prf_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_label_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage2_prf_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CLIENT DATA TABLES (own rows + staff/admin all)
-- =============================================

-- chat_history (has user_id uuid)
CREATE POLICY "Users read own chat_history" ON public.chat_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users insert own chat_history" ON public.chat_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users update own chat_history" ON public.chat_history FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users delete own chat_history" ON public.chat_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));

-- ingredient_specs (has user_id uuid)
CREATE POLICY "Users read own ingredient_specs" ON public.ingredient_specs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users insert own ingredient_specs" ON public.ingredient_specs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users update own ingredient_specs" ON public.ingredient_specs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users delete own ingredient_specs" ON public.ingredient_specs FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));

-- packaging (has user_id uuid)
CREATE POLICY "Users read own packaging" ON public.packaging FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users insert own packaging" ON public.packaging FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users update own packaging" ON public.packaging FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users delete own packaging" ON public.packaging FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));

-- shelf_life (has user_id uuid)
CREATE POLICY "Users read own shelf_life" ON public.shelf_life FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users insert own shelf_life" ON public.shelf_life FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users update own shelf_life" ON public.shelf_life FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users delete own shelf_life" ON public.shelf_life FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));

-- readiness (has user_id uuid)
CREATE POLICY "Users read own readiness" ON public.readiness FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users insert own readiness" ON public.readiness FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users update own readiness" ON public.readiness FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users delete own readiness" ON public.readiness FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));

-- concepts (has user_id text — compare as text)
CREATE POLICY "Users read own concepts" ON public.concepts FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users insert own concepts" ON public.concepts FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users update own concepts" ON public.concepts FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users delete own concepts" ON public.concepts FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id OR public.is_staff_or_admin(auth.uid()));

-- costing (has user_id uuid) — internal table, staff/admin + own rows
CREATE POLICY "Users read own costing" ON public.costing FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users insert own costing" ON public.costing FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users update own costing" ON public.costing FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users delete own costing" ON public.costing FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));

-- ingredients (no user_id — shared reference, authenticated read, staff/admin write)
CREATE POLICY "Authenticated read ingredients" ON public.ingredients FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff/admin write ingredients" ON public.ingredients FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin update ingredients" ON public.ingredients FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin delete ingredients" ON public.ingredients FOR DELETE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- prf_submissions (no user_id — public insert for leads, staff/admin read)
CREATE POLICY "Public insert prf_submissions" ON public.prf_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Staff/admin read prf_submissions" ON public.prf_submissions FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin update prf_submissions" ON public.prf_submissions FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- =============================================
-- INTERNAL TABLES (staff/admin only)
-- =============================================

-- formulas (no user_id — staff/admin only)
CREATE POLICY "Staff/admin read formulas" ON public.formulas FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin insert formulas" ON public.formulas FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin update formulas" ON public.formulas FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin delete formulas" ON public.formulas FOR DELETE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- internal_notifications (staff/admin only)
CREATE POLICY "Staff/admin read notifications" ON public.internal_notifications FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin insert notifications" ON public.internal_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin update notifications" ON public.internal_notifications FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- production_intake (staff/admin only)
CREATE POLICY "Staff/admin read production_intake" ON public.production_intake FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin insert production_intake" ON public.production_intake FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin update production_intake" ON public.production_intake FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- private_label_requests (public insert for leads, staff/admin read/update)
CREATE POLICY "Public insert private_label_requests" ON public.private_label_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Staff/admin read private_label_requests" ON public.private_label_requests FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin update private_label_requests" ON public.private_label_requests FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- client_documents (user_id is text)
CREATE POLICY "Users read own client_documents" ON public.client_documents FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users insert own client_documents" ON public.client_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users update own client_documents" ON public.client_documents FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Users delete own client_documents" ON public.client_documents FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id OR public.is_staff_or_admin(auth.uid()));

-- client_invitations (staff/admin only)
CREATE POLICY "Staff/admin read client_invitations" ON public.client_invitations FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin insert client_invitations" ON public.client_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin update client_invitations" ON public.client_invitations FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- stage2_prf_submissions (public insert/update for draft flow, staff/admin read)
CREATE POLICY "Public insert stage2_prf" ON public.stage2_prf_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Public update stage2_prf" ON public.stage2_prf_submissions FOR UPDATE TO anon, authenticated
  USING (true);
CREATE POLICY "Staff/admin read stage2_prf" ON public.stage2_prf_submissions FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- weight_conversions (shared reference — authenticated read, staff/admin write)
CREATE POLICY "Authenticated read weight_conversions" ON public.weight_conversions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff/admin write weight_conversions" ON public.weight_conversions FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin update weight_conversions" ON public.weight_conversions FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- user_roles (users read own role, staff/admin manage all)
CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff/admin delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
