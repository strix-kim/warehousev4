-- Seed-скрипт для Supabase/Postgres: тестовые данные для MVP
-- Вставьте этот скрипт после создания схемы и политик

-- Пользователи (разные роли)
insert into users (id, name, email, role, shifts_count) values
  ('00000000-0000-0000-0000-000000000001', 'Admin User', 'admin@example.com', 'admin', 0),
  ('00000000-0000-0000-0000-000000000002', 'Manager User', 'manager@example.com', 'manager', 0),
  ('00000000-0000-0000-0000-000000000003', 'Technician User', 'tech@example.com', 'technician', 0),
  ('00000000-0000-0000-0000-000000000004', 'Video Engineer', 'engineer@example.com', 'video_engineer', 0);

-- Оборудование
insert into equipments (id, model, brand, serial_number, quantity, status, location, category, subcategory, tech_description, description) values
  ('10000000-0000-0000-0000-000000000001', 'V-Mixer 700', 'Roland', 'SN-VM700-001', 2, 'operational', 'Main Storage', 'Audio', 'Mixer', 'Digital audio mixer', 'Основной микшер для FOH'),
  ('10000000-0000-0000-0000-000000000002', 'LED Panel 4K', 'Samsung', 'SN-LED4K-002', 10, 'operational', 'Warehouse A', 'Video', 'Display', '4K LED panel', 'Панели для видеостены'),
  ('10000000-0000-0000-0000-000000000003', 'Shure SM58', 'Shure', 'SN-SM58-003', 5, 'in_repair', 'Repair Room', 'Audio', 'Microphone', 'Dynamic vocal mic', 'Микрофоны для вокала');

-- Мероприятие (event)
insert into events (id, name, organizer, location, description, technical_task, photos, setup_date, start_date, end_date, teardown_date, mount_points_count, responsible_engineers) values
  ('20000000-0000-0000-0000-000000000001', 'Tech Expo 2024', 'TechOrg', 'Expo Center', 'Технологическая выставка', 'Полная техническая поддержка', ARRAY['photo1.jpg','photo2.jpg'], '2024-06-01', '2024-06-02', '2024-06-05', '2024-06-06', 2, ARRAY['00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003']::uuid[]);

-- Точки монтажа (mount_points)
insert into mount_points (id, event_id, name, responsible_engineers, equipment_plan, equipment_final, equipment_fact) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Main Stage', ARRAY['00000000-0000-0000-0000-000000000004']::uuid[], ARRAY['10000000-0000-0000-0000-000000000001']::uuid[], ARRAY['10000000-0000-0000-0000-000000000001']::uuid[], ARRAY['10000000-0000-0000-0000-000000000001']::uuid[]),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Video Wall', ARRAY['00000000-0000-0000-0000-000000000003']::uuid[], ARRAY['10000000-0000-0000-0000-000000000002']::uuid[], ARRAY['10000000-0000-0000-0000-000000000002']::uuid[], ARRAY['10000000-0000-0000-0000-000000000002']::uuid[]);

-- Отчёт (report)
insert into reports (id, event_id, generated_at, content) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', now(), '{"summary": "Все прошло успешно", "issues": []}'); 