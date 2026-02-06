-- Insert users from all backups
INSERT INTO public.users (id, name_en, name_bg) VALUES
(1, 'Mitko', 'Митко'),
(2, 'Eti', 'Ети'),
(3, 'Tatiana', 'Татяна'),
(4, 'Sasho', 'Сашо'),
(5, 'Zari', 'Зари'),
(6, 'Ben', 'Бен'),
(7, 'Bocheto', 'Бочето'),
(8, 'Lori', 'Лори'),
(9, 'Slavi', 'Слави')
ON CONFLICT (name_bg) DO NOTHING;
