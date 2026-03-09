import { useEffect, useMemo, useState } from "preact/hooks";
import { formatCOP } from "../../lib/currency";
import { getCurrentUsername, supabase } from "../../lib/supabase";

type Period = "dia" | "semana" | "mes";

type TopEntry = {
  name: string;
  value: number;
};

type DailySummary = {
  label: string;
  sales: number;
  purchases: number;
  net: number;
};

type DashboardReport = {
  sales: number;
  purchases: number;
  netProfit: number;
  avgTicket: number;
  salesCount: number;
  purchasesCount: number;
  topBreads: TopEntry[];
  topPurchasedMaterials: TopEntry[];
};

type Transaction = {
  type: "venta" | "compra";
  sale_type?: "productos" | "otros";
  amount: number;
  description?: string | null;
  items?: Array<{ product_name?: string; quantity?: number }> | null;
  created_at: string;
};

function getPeriodStart(period: Period): Date {
  const now = new Date();
  const start = new Date(now);

  if (period === "dia") {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "semana") {
    const day = start.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildReport(transactions: Transaction[]): DashboardReport {
  const salesTransactions = transactions.filter(
    (item) => item.type === "venta",
  );
  const purchaseTransactions = transactions.filter(
    (item) => item.type === "compra",
  );

  const sales = salesTransactions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const purchases = purchaseTransactions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const netProfit = sales - purchases;

  const breadMap = new Map<string, number>();
  salesTransactions
    .filter((item) => item.sale_type === "productos")
    .forEach((transaction) => {
      (transaction.items || []).forEach((item) => {
        const name = item.product_name?.trim();
        if (!name) return;

        const quantity = Number(item.quantity || 0);
        breadMap.set(name, (breadMap.get(name) || 0) + quantity);
      });
    });

  const topBreads = Array.from(breadMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const purchasedMap = new Map<string, number>();
  purchaseTransactions.forEach((item) => {
    const key = item.description?.trim() || "Sin detalle";
    purchasedMap.set(
      key,
      (purchasedMap.get(key) || 0) + Number(item.amount || 0),
    );
  });

  const topPurchasedMaterials = Array.from(purchasedMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    sales,
    purchases,
    netProfit,
    avgTicket: salesTransactions.length ? sales / salesTransactions.length : 0,
    salesCount: salesTransactions.length,
    purchasesCount: purchaseTransactions.length,
    topBreads,
    topPurchasedMaterials,
  };
}

function buildDailyHistory(transactions: Transaction[]): DailySummary[] {
  const byDate = new Map<string, { sales: number; purchases: number }>();

  transactions.forEach((item) => {
    const date = new Date(item.created_at);
    if (Number.isNaN(date.getTime())) return;

    const key = date.toISOString().split("T")[0];
    const current = byDate.get(key) || { sales: 0, purchases: 0 };

    if (item.type === "venta") {
      current.sales += Number(item.amount || 0);
    } else {
      current.purchases += Number(item.amount || 0);
    }

    byDate.set(key, current);
  });

  const summaries: DailySummary[] = [];
  const now = new Date();

  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - offset);
    const key = day.toISOString().split("T")[0];
    const data = byDate.get(key) || { sales: 0, purchases: 0 };

    summaries.push({
      label: day.toLocaleDateString("es-CO", {
        weekday: "short",
        day: "2-digit",
      }),
      sales: data.sales,
      purchases: data.purchases,
      net: data.sales - data.purchases,
    });
  }

  return summaries;
}

export default function InicioDashboardIsland() {
  const [period, setPeriod] = useState<Period>("dia");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailyHistory, setDailyHistory] = useState<DailySummary[]>([]);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayPurchases: 0,
    pendingOrders: 0,
    completedOrders: 0,
  });
  const [error, setError] = useState("");
  const username = getCurrentUsername();

  const report = useMemo(() => {
    const periodStart = getPeriodStart(period).getTime();
    const periodTransactions = transactions.filter(
      (item) => new Date(item.created_at).getTime() >= periodStart,
    );
    return buildReport(periodTransactions);
  }, [period, transactions]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    const today = new Date().toISOString().split("T")[0];

    const [
      { data: txData, error: txError },
      { count: pendingOrders, error: pendingError },
      { count: completedOrders, error: completedError },
    ] = await Promise.all([
      supabase
        .from("transactions")
        .select("type, sale_type, amount, description, items, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendiente"),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "completado"),
    ]);

    if (txError || pendingError || completedError) {
      setError(
        txError?.message ||
          pendingError?.message ||
          completedError?.message ||
          "Error al cargar el inicio",
      );
      setInitialLoading(false);
      setLoading(false);
      return;
    }

    const safeTransactions = (txData || []) as Transaction[];
    setTransactions(safeTransactions);
    setDailyHistory(buildDailyHistory(safeTransactions));

    const todaySales = safeTransactions
      .filter((item) => item.type === "venta" && item.created_at >= today)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const todayPurchases = safeTransactions
      .filter((item) => item.type === "compra" && item.created_at >= today)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    setStats({
      todaySales,
      todayPurchases,
      pendingOrders: pendingOrders || 0,
      completedOrders: completedOrders || 0,
    });
    setInitialLoading(false);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (initialLoading) {
    return (
      <section class="grid gap-4">
        <article class="panel-card">
          <p class="text-sm text-muted">Cargando análisis e historial...</p>
        </article>
      </section>
    );
  }

  return (
    <section class="grid gap-4">
      <article class="panel-card flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-text">
            Hola, {username || "Usuario"} 👋
          </h1>
          <p class="text-sm text-muted">Reportes rápidos de tu panadería</p>
        </div>
        <button
          class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted hover:text-text"
          onClick={fetchData}
          type="button"
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </article>

      <article class="panel-card">
        <p class="mb-2 text-sm text-muted">Periodo del informe</p>
        <div class="grid grid-cols-3 gap-2">
          {(["dia", "semana", "mes"] as Period[]).map((value) => (
            <button
              class={`rounded-lg px-3 py-2 text-sm ${period === value ? "bg-primary font-semibold text-white" : "bg-background text-muted"}`}
              onClick={() => setPeriod(value)}
              type="button"
            >
              {value === "dia" ? "Día" : value === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </article>

      {!!error && (
        <p class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div class="grid gap-3 md:grid-cols-2">
        <article class="panel-card">
          <p class="text-sm text-muted">Ventas Hoy</p>
          <p class="mt-1 text-xl font-bold text-text">
            {formatCOP(stats.todaySales)}
          </p>
        </article>
        <article class="panel-card">
          <p class="text-sm text-muted">Insumos/Gastos Hoy</p>
          <p class="mt-1 text-xl font-bold text-text">
            {formatCOP(stats.todayPurchases)}
          </p>
        </article>
        <article class="panel-card">
          <p class="text-sm text-muted">Pedidos Pendientes</p>
          <p class="mt-1 text-xl font-bold text-text">{stats.pendingOrders}</p>
        </article>
        <article class="panel-card">
          <p class="text-sm text-muted">Completados</p>
          <p class="mt-1 text-xl font-bold text-text">
            {stats.completedOrders}
          </p>
        </article>
      </div>

      <article class="panel-card">
        <h2 class="text-lg font-semibold text-text">Resumen {period}</h2>
        <div class="mt-3 grid gap-2 text-sm">
          <p class="flex justify-between">
            <span class="text-muted">Ventas</span>
            <span class="font-semibold text-text">
              {formatCOP(report.sales)}
            </span>
          </p>
          <p class="flex justify-between">
            <span class="text-muted">Compras/Gastos</span>
            <span class="font-semibold text-text">
              {formatCOP(report.purchases)}
            </span>
          </p>
          <p class="flex justify-between">
            <span class="text-muted">Ganancia neta</span>
            <span class="font-bold text-primary">
              {formatCOP(report.netProfit)}
            </span>
          </p>
          <p class="flex justify-between">
            <span class="text-muted">Ticket promedio</span>
            <span class="font-semibold text-text">
              {formatCOP(report.avgTicket)}
            </span>
          </p>
        </div>
      </article>

      <article class="panel-card">
        <h2 class="text-lg font-semibold text-text">Panes más vendidos</h2>
        <div class="mt-3 space-y-2 text-sm">
          {report.topBreads.length === 0 ? (
            <p class="text-muted">Sin ventas de panes en este periodo.</p>
          ) : (
            report.topBreads.map((entry) => (
              <p class="flex items-center justify-between">
                <span class="text-text">{entry.name}</span>
                <span class="font-semibold text-primary">
                  {entry.value} uds
                </span>
              </p>
            ))
          )}
        </div>
      </article>

      <article class="panel-card">
        <h2 class="text-lg font-semibold text-text">Materiales/Compras top</h2>
        <div class="mt-3 space-y-2 text-sm">
          {report.topPurchasedMaterials.length === 0 ? (
            <p class="text-muted">Sin compras registradas en este periodo.</p>
          ) : (
            report.topPurchasedMaterials.map((entry) => (
              <p class="flex items-center justify-between gap-2">
                <span class="min-w-0 flex-1 truncate text-text">
                  {entry.name}
                </span>
                <span class="font-semibold text-pink-400">
                  {formatCOP(entry.value)}
                </span>
              </p>
            ))
          )}
        </div>
      </article>

      <article class="panel-card">
        <h2 class="text-lg font-semibold text-text">
          Historial resumido (7 días)
        </h2>
        <div class="mt-3 space-y-2 text-sm">
          {dailyHistory.map((day) => (
            <article class="rounded-lg border border-border bg-background px-3 py-2">
              <p class="flex items-center justify-between">
                <span class="font-semibold text-text">{day.label}</span>
                <span class="font-bold text-primary">{formatCOP(day.net)}</span>
              </p>
              <p class="mt-1 flex items-center justify-between text-muted">
                <span>Ventas: {formatCOP(day.sales)}</span>
                <span>Compras: {formatCOP(day.purchases)}</span>
              </p>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
