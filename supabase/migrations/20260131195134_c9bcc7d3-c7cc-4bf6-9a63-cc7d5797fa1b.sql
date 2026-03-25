-- Create stage2_prf_submissions table for Stage 2 wizard data
CREATE TABLE public.stage2_prf_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  lead_id UUID NULL,
  company_stage TEXT NOT NULL CHECK (company_stage IN ('startup', 'new', 'emerging', 'established')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Enable Row Level Security
ALTER TABLE public.stage2_prf_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form)
CREATE POLICY "Anyone can submit stage2 PRF" 
ON public.stage2_prf_submissions 
FOR INSERT 
WITH CHECK (true);

-- Allow read access to own submissions (by id stored in localStorage)
CREATE POLICY "Anyone can read stage2 submissions" 
ON public.stage2_prf_submissions 
FOR SELECT 
USING (true);

-- Allow updates to draft submissions
CREATE POLICY "Anyone can update draft stage2 submissions" 
ON public.stage2_prf_submissions 
FOR UPDATE 
USING (status = 'draft');

-- Create index for faster lookups
CREATE INDEX idx_stage2_prf_submissions_status ON public.stage2_prf_submissions(status);
CREATE INDEX idx_stage2_prf_submissions_company_stage ON public.stage2_prf_submissions(company_stage);