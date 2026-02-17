-- ========================================
-- PASO 1: ELIMINAR TABLAS OBSOLETAS
-- ========================================

-- Borrar tablas que ya no se usan
DROP TABLE IF EXISTS customer_payments CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS supplies CASCADE;

-- Borrar tablas existentes para recrearlas con la nueva estructura
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;

-- ========================================
-- PASO 2: CREAR TABLAS NECESARIAS
-- ========================================

-- Tabla de perfiles/usuarios
CREATE TABLE IF NOT EXISTS profiles (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de transacciones (ventas y gastos)
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('venta', 'compra')),
  sale_type TEXT CHECK (sale_type IN ('productos', 'otros')), -- Solo para ventas
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  items JSONB, -- Array de {product_id, product_name, quantity, price, subtotal} para ventas con productos
  image_url TEXT,
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  items JSONB NOT NULL, -- Array de {product_id, product_name, quantity, price, subtotal}
  total DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'terminado', 'en_entrega', 'completado', 'cancelado')),
  delivery_date DATE,
  notes TEXT,
  transaction_id BIGINT, -- ID de la transacción asociada cuando está terminado/completado
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de documentos
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT,
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- PASO 3: CREAR ÍNDICES PARA MEJORAR RENDIMIENTO
-- ========================================

CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- ========================================
-- PASO 4: HABILITAR ROW LEVEL SECURITY (RLS)
-- ========================================
-- Esto es opcional pero recomendado para Supabase

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Permitir lectura pública" ON profiles;
DROP POLICY IF EXISTS "Permitir inserción pública" ON profiles;
DROP POLICY IF EXISTS "Permitir todo en transactions" ON transactions;
DROP POLICY IF EXISTS "Permitir todo en products" ON products;
DROP POLICY IF EXISTS "Permitir todo en orders" ON orders;
DROP POLICY IF EXISTS "Permitir todo en documents" ON documents;

-- Crear políticas de acceso público (ajusta según tus necesidades de seguridad)
CREATE POLICY "Permitir lectura pública" ON profiles FOR SELECT USING (true);
CREATE POLICY "Permitir inserción pública" ON profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir todo en transactions" ON transactions FOR ALL USING (true);
CREATE POLICY "Permitir todo en products" ON products FOR ALL USING (true);
CREATE POLICY "Permitir todo en orders" ON orders FOR ALL USING (true);
CREATE POLICY "Permitir todo en documents" ON documents FOR ALL USING (true);

-- ========================================
-- PASO 5: CREAR STORAGE BUCKETS
-- ========================================
-- Ejecutar estos comandos en el panel de Storage de Supabase:

-- Para crear el bucket de images (fotos de recibos):
-- 1. Ve a Storage en Supabase Dashboard
-- 2. Crea un bucket llamado "images"
-- 3. Configúralo como público si quieres que las imágenes sean accesibles

-- Para crear el bucket de documents:
-- 1. Ve a Storage en Supabase Dashboard
-- 2. Crea un bucket llamado "documents"
-- 3. Configúralo como público o privado según necesites

-- Políticas para Storage (ejecutar en SQL Editor si es necesario):
/*
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true);

CREATE POLICY "Permitir subir images" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'images');

CREATE POLICY "Permitir leer images" ON storage.objects FOR SELECT 
USING (bucket_id = 'images');

CREATE POLICY "Permitir subir documents" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Permitir leer documents" ON storage.objects FOR SELECT 
USING (bucket_id = 'documents');
*/

-- ========================================
-- PASO 6: DATOS DE EJEMPLO (OPCIONAL)
-- ========================================

-- Insertar algunos productos de ejemplo
INSERT INTO products (name, price, description, added_by) VALUES
  ('Pan Integral', 2.50, 'Pan integral artesanal', 'admin'),
  ('Torta de Chocolate', 25.00, 'Torta de chocolate 1kg', 'admin'),
  ('Croissant', 1.80, 'Croissant de mantequilla', 'admin'),
  ('Pan Baguette', 2.00, 'Baguette francesa tradicional', 'admin')
ON CONFLICT DO NOTHING;

-- Insertar una transacción de ejemplo
INSERT INTO transactions (type, amount, description, added_by) VALUES
  ('venta', 150.00, 'Venta del día', 'admin')
ON CONFLICT DO NOTHING;
