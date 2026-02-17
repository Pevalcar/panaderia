r# 🗄️ Configuración de Base de Datos

## Pasos para configurar Supabase

### 1️⃣ Ejecutar el script SQL

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Abre el **SQL Editor** (menú lateral izquierdo)
3. Crea una nueva query
4. Copia y pega el contenido del archivo `database_setup.sql`
5. Ejecuta el script (botón Run)

El script hará:
- ✅ Eliminar tablas obsoletas
- ✅ Crear las 5 tablas necesarias
- ✅ Crear índices para mejor rendimiento
- ✅ Habilitar seguridad (RLS)
- ✅ Crear políticas de acceso
- ✅ Insertar datos de ejemplo

### 2️⃣ Configurar Storage Buckets

#### Bucket "images" (para fotos de recibos)
1. Ve a **Storage** en Supabase Dashboard
2. Click en "Create a new bucket"
3. Nombre: `images`
4. Selecciona **Public bucket** ✅
5. Click "Create bucket"

#### Bucket "documents" (para documentos importantes)
1. Ve a **Storage** en Supabase Dashboard
2. Click en "Create a new bucket"
3. Nombre: `documents`
4. Selecciona **Public bucket** ✅
5. Click "Create bucket"

### 3️⃣ Verificar las tablas

En el **Table Editor**, deberías ver:
- ✅ `profiles` - Usuarios de la app
- ✅ `transactions` - Ventas y gastos
- ✅ `products` - Catálogo de productos
- ✅ `orders` - Pedidos
- ✅ `documents` - Documentos importantes

### 4️⃣ Configurar políticas de Storage (opcional)

Si quieres controlar mejor el acceso a los archivos, ejecuta este SQL adicional:

```sql
-- Políticas para el bucket 'images'
CREATE POLICY "Permitir subir images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'images');

CREATE POLICY "Permitir leer images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'images');

-- Políticas para el bucket 'documents'
CREATE POLICY "Permitir subir documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Permitir leer documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'documents');
```

## 🎯 Estructura de las Tablas

### transactions
```
- id: Identificador único
- type: 'venta' o 'compra'
- amount: Monto de la transacción
- description: Descripción opcional
- image_url: URL de la foto del recibo
- added_by: Usuario que creó el registro
- created_at: Fecha de creación
```

### products
```
- id: Identificador único
- name: Nombre del producto
- price: Precio del producto
- description: Descripción opcional
- added_by: Usuario que creó el producto
- created_at: Fecha de creación
- updated_at: Fecha de última actualización
```

### orders
```
- id: Identificador único
- customer_name: Nombre del cliente
- customer_phone: Teléfono del cliente
- items: JSON con los productos del pedido
- total: Total del pedido
- status: Estado (pendiente, en_proceso, completado, cancelado)
- delivery_date: Fecha de entrega
- notes: Notas adicionales
- added_by: Usuario que creó el pedido
- created_at: Fecha de creación
- updated_at: Fecha de última actualización
```

### documents
```
- id: Identificador único
- name: Nombre del archivo
- url: URL del documento
- type: Tipo MIME del archivo
- added_by: Usuario que subió el documento
- created_at: Fecha de creación
```

### profiles
```
- id: Identificador único
- username: Nombre de usuario único
- created_at: Fecha de registro
```

## ⚠️ Importante

**Antes de ejecutar el script de eliminación:**
- Asegúrate de hacer un backup si tienes datos importantes
- Verifica que las tablas a eliminar realmente no se usan
- Las tablas que se eliminarán son: 
  - `customer_payments`
  - `invoice_items`
  - `invoices`
  - `customers`
  - `notes`
  - `supplies`

**Después de ejecutar el script:**
- Verifica que todas las tablas se crearon correctamente
- Prueba la app para asegurarte de que todo funciona
- Los productos de ejemplo se insertarán automáticamente
