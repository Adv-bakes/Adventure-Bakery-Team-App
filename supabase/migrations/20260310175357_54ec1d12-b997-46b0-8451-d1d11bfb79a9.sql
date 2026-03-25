
CREATE TABLE public.production_intake (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baked_good_id bigint NOT NULL,
  number_of_cases integer NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.production_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own production intake"
  ON public.production_intake FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own production intake"
  ON public.production_intake FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own production intake"
  ON public.production_intake FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own production intake"
  ON public.production_intake FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_production_intake_updated_at
  BEFORE UPDATE ON public.production_intake
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
