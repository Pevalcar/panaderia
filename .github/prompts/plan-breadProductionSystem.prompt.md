# Plan: Sistema Completo de Control y Costos de Panes (v2)

**TL;DR:** Módulo de gestión de panes con:
1. **Ingredientes con histórico de costos** - borrable en caso de error
2. **Recetas automáticas** - cálculo dinámico de costos
3. **Producción de lotes** - registro de cada batch
4. **Reportes de ganancias** - análisis por pan y tendencias

---

## Steps

### FASE 1: Base de Datos (database_setup.sql)

Agregar 5 tablas:

```sql
-- 1. Ingredientes base
CREATE TABLE ingredients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  supplier TEXT,
  unit TEXT NOT NULL, -- kg, g, l, ml, pzas
  current_cost_per_unit DECIMAL(10, 4) NOT NULL,
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Histórico de costos (borrable si hay error)
CREATE TABLE ingredient_cost_history (
  id BIGSERIAL PRIMARY KEY,
  ingredient_id BIGINT NOT NULL REFERENCES ingredients(id),
  cost_per_unit DECIMAL(10, 4) NOT NULL,
  notes TEXT, -- para justificar el cambio
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Recetas/Panes
CREATE TABLE recipes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  selling_price DECIMAL(10, 2) NOT NULL,
  yield_quantity INT NOT NULL, -- cuántos panes produce una receta
  yield_unit TEXT DEFAULT 'pzas',
  calculated_cost DECIMAL(10, 4), -- costo auto-calculado
  profit_margin_percent DECIMAL(5, 2), -- % ganancia
  profit_margin_amount DECIMAL(10, 2), -- $ ganancia
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Detalle de ingredientes por receta
CREATE TABLE recipe_ingredients (
  id BIGSERIAL PRIMARY KEY,
  recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id BIGINT NOT NULL REFERENCES ingredients(id),
  quantity DECIMAL(10, 4) NOT NULL, -- cantidad a usar
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Registro de producción
CREATE TABLE bread_productions (
  id BIGSERIAL PRIMARY KEY,
  recipe_id BIGINT NOT NULL REFERENCES recipes(id),
  quantity_produced INT NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'producido' CHECK (status IN ('en_proceso', 'producido', 'vendido', 'descartado')),
  notes TEXT,
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_ingredients_name ON ingredients(name);
CREATE INDEX idx_ingredient_cost_history_ingredient ON ingredient_cost_history(ingredient_id);
CREATE INDEX idx_recipes_name ON recipes(name);
CREATE INDEX idx_bread_productions_date ON bread_productions(created_at DESC);
CREATE INDEX idx_bread_productions_status ON bread_productions(status);

-- RLS
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bread_productions ENABLE ROW LEVEL SECURITY;
```

---

### FASE 2: Tipos TypeScript (types.d.ts)

```typescript
export type Ingredient = {
  id: string;
  name: string;
  supplier?: string;
  unit: 'kg' | 'g' | 'l' | 'ml' | 'pzas';
  current_cost_per_unit: number;
  created_at: string;
};

export type IngredientCostHistory = {
  id: string;
  ingredient_id: string;
  cost_per_unit: number;
  notes?: string;
  added_by: string;
  created_at: string;
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient?: Ingredient; // join opcional
};

export type Recipe = {
  id: string;
  name: string;
  description?: string;
  selling_price: number;
  yield_quantity: number;
  yield_unit: string;
  calculated_cost: number;
  profit_margin_percent: number;
  profit_margin_amount: number;
  created_at: string;
};

export type BreadProduction = {
  id: string;
  recipe_id: string;
  quantity_produced: number;
  total_cost: number;
  status: 'en_proceso' | 'producido' | 'vendido' | 'descartado';
  notes?: string;
  added_by: string;
  created_at: string;
};
```

---

### FASE 3: Pantallas Nuevas

#### A) `app/(tabs)/ingredients.tsx`
- ✅ CRUD de ingredientes (nombre, supplier, unit, costo)
- ✅ Cambiar precio → registra automáticamente en histórico
- ✅ **Ver histórico de precios** con opción a **borrar registros de error**
  - Tabla: [Fecha] [Costo] [Notas] [Botón Borrar]
  - **Confirmar antes de borrar** (modal con advertencia)
- ✅ Búsqueda por nombre/supplier
- ✅ Skeleton loader

#### B) `app/(tabs)/recipes.tsx`
- ✅ CRUD de recetas (nombre, descripción, precio venta)
- ✅ **Selector de ingredientes**: 
  - Modal con búsqueda + tabla de ingredientes disponibles
  - Agregar ingrediente + cantidad
  - Mostrar lista agregada con opción quitar
- ✅ **Cálculo automático** de costo (suma ingredientes × cantidades)
- ✅ **Cálculo automático** de margen:
  - En $ = Precio Venta - Costo
  - En % = (Margen$ / Costo) × 100
- ✅ Mostrar rentabilidad con colores (verde si >50%, amarillo si 20-50%, rojo si <20%)
- ✅ Búsqueda

#### C) `app/(tabs)/production.tsx`
- ✅ Seleccionar receta + cantidad a producir
- ✅ Sistema de carrito: agregar múltiples lotes en la misma sesión
  - [Receta] [Cantidad] [Costo Total] [Botón Quitar]
- ✅ Mostrar costo total + ganancia si todo se vende
- ✅ Botón "Registrar Producción" → inserta todos los items
- ✅ Listado de hoy/últimos días con filtro por estatus
- ✅ Cambiar estatus: en_proceso → producido → vendido → descartado
- ✅ **Al marcar "vendido"**: automáticamente crea transacción de venta en la tabla `transactions`

#### D) `app/reports/bread-performance.tsx` (oculta, accesible desde dashboard)
- ✅ **Reporte resumen** (tabla):
  ```
  Pan | Produced | Cost/Unit | Price | Total Cost | Revenue | Profit | Margin%
  ```
- ✅ **Histórico de costos** (gráfico):
  - Tendencia de costo de ingredientes últimos 30 días
- ✅ **Análisis de márgenes** (tarjetas + barra):
  - Top 3 panes más rentables
  - Bottom 3 menos rentables
- ✅ **Filtros**: Día, Semana, Mes, Custom (date picker)
- ✅ **Cards resumen**:
  - Total producido hoy
  - Costo total hoy
  - Ganancia potencial (si todo se vende)
  - Pan más vendido (rank)

---

### FASE 4: Funciones Cálculo (lib/calculations.ts)

```typescript
// Calcular costo total de una receta
export function calculateRecipeCost(recipeIngredients: RecipeIngredient[]): number

// Calcular margen
export function calculateMargin(cost: number, sellingPrice: number): {
  amountUSD: number;
  percentageMargin: number;
}

// Generar reporte
export function generateBreadPerformanceReport(
  dateFrom: Date,
  dateTo: Date
): BreadPerformanceReport

// Tendencia de costos
export function getIngredientCostTrend(
  ingredientId: string,
  days: number
): CostTrendData[]
```

---

### FASE 5: Integraciones

1. **Producción → Transacciones:**
   - Cuando cambias `bread_production.status = 'vendido'` → crea automáticamente una transacción
   - Transacción: `{ type: 'venta', sale_type: 'productos', amount: total_cost × quantity, items: detalles }`

2. **Dashboard (index.tsx) - Agregar cards:**
   ```
   | Panes hoy | Costo ingredientes | Ganancia potencial |
   |-----------|-------------------|-------------------|
   |    15     |     $34.50        |     $85.20        |
   ```

3. **Tab Bar (_layout.tsx):**
   - Reemplazar o agregar 3 nuevas pestañas: "Ingredientes", "Recetas", "Producción"
   - O mantener 5 tabs y agregar icon "Reportes" → acceso a `/reports/bread-performance`

---

### FASE 6: Capabilidad de Borrar Histórico

En pantalla **Ingredientes → Ver Histórico**:

```typescript
// Tabla de histórico con botón "Borrar"
<TouchableOpacity
  onPress={() => showDeleteConfirmation(historicItemId)}
  className="bg-red-500 px-3 py-2 rounded"
>
  <Text>🗑️</Text>
</TouchableOpacity>

// Modal de confirmación
<Modal visible={showDeleteModal}>
  <View className="bg-black/50 justify-center items-center flex-1">
    <View className="bg-surface p-6 rounded-xl w-80">
      <Text className="text-lg font-bold mb-4">
        Eliminar este registro de costo?
      </Text>
      <Text className="text-muted mb-4">
        Se borrará: ${cost} en {formatDate(date)}
      </Text>
      <View className="flex-row gap-2">
        <TouchableOpacity onPress={handleDelete} className="flex-1 bg-red-600 p-3">
          <Text className="text-white font-bold text-center">Eliminar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={closeModal} className="flex-1 bg-surface border">
          <Text className="text-center">Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

// Función borrar
const handleDeleteCostHistory = async (historyId: string) => {
  const { error } = await supabase
    .from('ingredient_cost_history')
    .delete()
    .eq('id', historyId);
  
  if (error) {
    Toast.show({ type: 'error', text1: 'Error al borrar' });
  } else {
    Toast.show({ type: 'success', text1: 'Registro eliminado' });
    refetch(); // recargar histórico
  }
};
```

**Comportamiento:**
- ✅ Cualquiera puede borrar cualquier registro (sin restricciones)
- ✅ Se elimina completamente de la BD (no hay soft delete)
- ✅ Modal de confirmación para evitar accidentes
- ✅ Toast de éxito/error

---

### FASE 7: UI/UX

**Esquema de colores:**
- 🟢 Ingredientes | 🔵 Recetas | 🟣 Producción | 🟠 Reportes/Ganancia

**Componentes reutilizables:**
- `<CostCalculator />` - muestra costo con margen
- `<IngredientSelector />` - modal con búsqueda
- `<ProductionCart />` - lista de items a producir
- `<HistoryDeleteConfirmation />` - modal confirmación borrar

---

## Verificación

```
1. Crear ingrediente: Harina ($0.50/kg)
2. Cambiar precio a $0.55 → registra en histórico
3. Ver histórico → borrar el registro de $0.55 ✓
4. Crear receta "Pan Integral" con harina
5. Verificar costo calculado automático
6. Crear producción de 15 panes
7. Marcar como "vendido" → verifica transacción creada ✓
8. Ver reporte → ganancia correcto ✓
```

---

## Decisiones (Confirmadas)

- ✅ **Histórico**: Completamente borrable (eliminación física)
- ✅ **Permisos**: Cualquiera puede borrar (sin restricciones)
- ✅ **Confirmación**: Modal antes de eliminar
- ✅ **Integración**: Automática producción → transacciones

---

## Notas Adicionales

- Todas las pantallas nuevas siguen patrones existentes del proyecto:
  - Pull-to-refresh en listas
  - Skeleton loaders durante carga
  - Modales deslizables para formularios
  - Toast notifications para feedback
  - Integración con AuthContext para `added_by`
  - Estilos NativeWind + Tailwind

- Los cálculos se actualizan en tiempo real:
  - Cambiar ingrediente → recalcula receta
  - Cambiar cantidad → recalcula producción
  - Marcar vendido → crea transacción

- Base de datos preparada para auditoría:
  - Todos los campos `added_by` rastrean quién hizo qué
  - Timestamps en todas las tablas
  - Histórico de costos inmutable (solo borrable, no editables)
