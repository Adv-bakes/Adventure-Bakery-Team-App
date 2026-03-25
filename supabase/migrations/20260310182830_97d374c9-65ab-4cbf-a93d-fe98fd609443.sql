INSERT INTO public.user_roles (user_id, role)
VALUES ('f4a1bb67-5733-445d-b0ae-5551a6fddb2d', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;