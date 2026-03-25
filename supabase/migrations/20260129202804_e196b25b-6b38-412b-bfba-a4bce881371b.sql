-- Create table for private label requests
CREATE TABLE public.private_label_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Client info (from gateway lead capture)
  client_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  
  -- Form fields
  baked_good_type TEXT,
  product_specifications TEXT,
  
  -- Dietary claims (stored as JSON array)
  dietary_claims JSON DEFAULT '[]'::json,
  dietary_claims_other TEXT,
  
  -- Packaging preferences
  packaging_plans TEXT, -- 'have_plans' or 'need_assistance'
  packaging_types TEXT,
  units_per_pack TEXT,
  packs_per_case TEXT,
  
  -- Shelf life
  shelf_life_requirements TEXT,
  
  -- Acknowledgements
  sample_policy_acknowledged BOOLEAN DEFAULT false,
  moq_acknowledged BOOLEAN DEFAULT false,
  
  -- Additional
  additional_comments TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'pending'
);

-- Create internal notifications table
CREATE TABLE public.internal_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notification_type TEXT NOT NULL,
  reference_id UUID,
  reference_table TEXT,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on both tables
ALTER TABLE public.private_label_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notifications ENABLE ROW LEVEL SECURITY;

-- For private_label_requests: anyone can insert (public form), but only authenticated admins can read
CREATE POLICY "Anyone can submit private label requests"
ON public.private_label_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can view private label requests"
ON public.private_label_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- For internal_notifications: only authenticated users can access
CREATE POLICY "Authenticated users can view notifications"
ON public.internal_notifications
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can create notifications"
ON public.internal_notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update notifications"
ON public.internal_notifications
FOR UPDATE
USING (auth.uid() IS NOT NULL);