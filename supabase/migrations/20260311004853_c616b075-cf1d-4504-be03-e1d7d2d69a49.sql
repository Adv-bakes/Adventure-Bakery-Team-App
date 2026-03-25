
-- Restore the trigger for auto-creating profiles on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Assign admin role to the "Adv Bakery" account that's missing a role
INSERT INTO public.user_roles (user_id, role)
VALUES ('9a3404a4-c358-4c82-b67f-8386dc818f45', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
