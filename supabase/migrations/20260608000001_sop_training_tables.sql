-- SOP / Training system: documents, versions, form templates, submissions, training assignments

CREATE TABLE public.sop_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_number text,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('sop', 'form', 'policy')),
  category text,
  revision text,
  effective_date date,
  approved_by uuid REFERENCES auth.users(id),
  content jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  sqf_reference text,
  file_url text,
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sop_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sop_documents(id) ON DELETE CASCADE,
  revision text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_notes text
);

CREATE TABLE public.form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid REFERENCES public.sop_documents(id) ON DELETE CASCADE,
  form_number text,
  form_title text NOT NULL,
  fields jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id uuid NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  data jsonb,
  signed boolean NOT NULL DEFAULT false,
  signed_at timestamptz
);

CREATE TABLE public.training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id),
  sop_id uuid NOT NULL REFERENCES public.sop_documents(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  signed boolean NOT NULL DEFAULT false,
  signed_at timestamptz
);

ALTER TABLE public.sop_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;

-- sop_documents: employees (staff/admin/owner) can read; only admins can insert/update
CREATE POLICY "Employees read sop_documents"
  ON public.sop_documents FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Admins insert sop_documents"
  ON public.sop_documents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update sop_documents"
  ON public.sop_documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- sop_versions: employees can read; only admins can insert/update
CREATE POLICY "Employees read sop_versions"
  ON public.sop_versions FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Admins insert sop_versions"
  ON public.sop_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update sop_versions"
  ON public.sop_versions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- form_templates: employees can read; only admins can insert/update
CREATE POLICY "Employees read form_templates"
  ON public.form_templates FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Admins insert form_templates"
  ON public.form_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update form_templates"
  ON public.form_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- form_submissions: employees can read their own and insert; no update/delete
CREATE POLICY "Employees read own form_submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) AND submitted_by = auth.uid());

CREATE POLICY "Employees insert form_submissions"
  ON public.form_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()) AND submitted_by = auth.uid());

-- training_assignments: employees can read their own and insert; no update/delete
CREATE POLICY "Employees read own training_assignments"
  ON public.training_assignments FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) AND employee_id = auth.uid());

CREATE POLICY "Employees insert training_assignments"
  ON public.training_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()) AND employee_id = auth.uid());
