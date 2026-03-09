import { useEffect, useMemo, useState } from "preact/hooks";
import { formatCOP } from "../../lib/currency";
import { supabase } from "../../lib/supabase";

type TransactionItem = {
  product_name?: string;
  quantity?: number;
};

type Transaction = {
  type: "venta" | "compra";
  sale_type?: "productos" | "otros" | null;
  amount: number;
  description?: string | null;
  items?: TransactionItem[] | null;
  created_at: string;
};

type Order = {
  status: string;
  delivery_date: string;
};

type DailyRow = {
  date: string;
  sales: number;
  purchases: number;
  net: number;
};

type TopEntry = {
  name: string;
  value: number;
};

function getDefaultMonth(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function getMonthRange(month: string): {
  startIso: string;
  endIso: string;
  startDate: string;
  endDate: string;
} {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;

  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

function getPreviousMonth(month: string): string {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const prev = new Date(Date.UTC(year, monthIndex - 1, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

function percentChange(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "0%";
  if (previous === 0) return "+100%";
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

function downloadTextFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function CierresMensualesIsland() {
  const [month, setMonth] = useState(getDefaultMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const summary = useMemo(() => {
    const salesTx = transactions.filter((item) => item.type === "venta");
    const purchasesTx = transactions.filter((item) => item.type === "compra");

    const sales = salesTx.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );
    const purchases = purchasesTx.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );

    const completed = orders.filter(
      (order) => order.status === "completado",
    ).length;
    const cancelled = orders.filter(
      (order) => order.status === "cancelado",
    ).length;

    return {
      sales,
      purchases,
      net: sales - purchases,
      avgTicket: salesTx.length ? sales / salesTx.length : 0,
      salesCount: salesTx.length,
      purchasesCount: purchasesTx.length,
      completed,
      cancelled,
      totalOrders: orders.length,
    };
  }, [transactions, orders]);

  const previousSummary = useMemo(() => {
    const sales = prevTransactions
      .filter((item) => item.type === "venta")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const purchases = prevTransactions
      .filter((item) => item.type === "compra")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      sales,
      purchases,
      net: sales - purchases,
    };
  }, [prevTransactions]);

  const dailyRows = useMemo<DailyRow[]>(() => {
    const range = getMonthRange(month);
    const start = new Date(`${range.startDate}T00:00:00Z`);
    const end = new Date(`${range.endDate}T00:00:00Z`);

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

    const rows: DailyRow[] = [];
    for (
      let day = new Date(start);
      day < end;
      day.setUTCDate(day.getUTCDate() + 1)
    ) {
      const key = day.toISOString().split("T")[0];
      const item = byDate.get(key) || { sales: 0, purchases: 0 };
      rows.push({
        date: key,
        sales: item.sales,
        purchases: item.purchases,
        net: item.sales - item.purchases,
      });
    }

    return rows;
  }, [month, transactions]);

  const topProducts = useMemo<TopEntry[]>(() => {
    const map = new Map<string, number>();

    transactions
      .filter((item) => item.type === "venta" && item.sale_type === "productos")
      .forEach((tx) => {
        (tx.items || []).forEach((entry) => {
          const name = entry.product_name?.trim();
          if (!name) return;
          const quantity = Number(entry.quantity || 0);
          map.set(name, (map.get(name) || 0) + quantity);
        });
      });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions]);

  const topExpenses = useMemo<TopEntry[]>(() => {
    const map = new Map<string, number>();

    transactions
      .filter((item) => item.type === "compra")
      .forEach((tx) => {
        const key = tx.description?.trim() || "Sin detalle";
        map.set(key, (map.get(key) || 0) + Number(tx.amount || 0));
      });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions]);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    const range = getMonthRange(month);
    const prevMonth = getPreviousMonth(month);
    const prevRange = getMonthRange(prevMonth);

    const [txRes, prevTxRes, orderRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("type, sale_type, amount, description, items, created_at")
        .gte("created_at", range.startIso)
        .lt("created_at", range.endIso)
        .order("created_at", { ascending: true }),
      supabase
        .from("transactions")
        .select("type, sale_type, amount, description, items, created_at")
        .gte("created_at", prevRange.startIso)
        .lt("created_at", prevRange.endIso)
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select("status, delivery_date")
        .gte("delivery_date", range.startDate)
        .lt("delivery_date", range.endDate),
    ]);

    if (txRes.error || prevTxRes.error || orderRes.error) {
      setError(
        txRes.error?.message ||
          prevTxRes.error?.message ||
          orderRes.error?.message ||
          "Error al cargar cierres",
      );
      setLoading(false);
      return;
    }

    setTransactions((txRes.data || []) as Transaction[]);
    setPrevTransactions((prevTxRes.data || []) as Transaction[]);
    setOrders((orderRes.data || []) as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [month]);

  const exportCsv = () => {
    const headerRows = [
      ["Mes", month],
      ["Ventas", summary.sales],
      ["Compras", summary.purchases],
      ["Utilidad neta", summary.net],
      ["Pedidos totales", summary.totalOrders],
      ["Pedidos completados", summary.completed],
      ["Pedidos cancelados", summary.cancelled],
      ["Ticket promedio", summary.avgTicket],
      [
        "Variación ventas vs mes anterior",
        percentChange(summary.sales, previousSummary.sales),
      ],
      [
        "Variación utilidad vs mes anterior",
        percentChange(summary.net, previousSummary.net),
      ],
      ["", ""],
      ["Historial Diario", ""],
      ["Fecha", "Ventas", "Compras", "Neto"],
    ];

    const daily = dailyRows.map((row) => [
      row.date,
      row.sales,
      row.purchases,
      row.net,
    ]);

    const productHeader = [
      ["", ""],
      ["Top Productos", ""],
      ["Producto", "Cantidad"],
    ];
    const productRows = topProducts.map((row) => [row.name, row.value]);

    const expenseHeader = [
      ["", ""],
      ["Top Compras", ""],
      ["Concepto", "Monto"],
    ];
    const expenseRows = topExpenses.map((row) => [row.name, row.value]);

    const allRows = [
      ...headerRows,
      ...daily,
      ...productHeader,
      ...productRows,
      ...expenseHeader,
      ...expenseRows,
    ];
    const csv = allRows
      .map((row) => row.map((cell) => csvEscape(cell ?? "")).join(","))
      .join("\n");

    downloadTextFile(csv, `cierre-${month}.csv`);
  };

  return (
    <section class="grid gap-4">
      <article class="panel-card">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-text">Cierres Mensuales</h1>
            <p class="text-sm text-muted">
              Análisis por mes sin tocar el inicio
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <input
              class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text"
              onInput={(event) =>
                setMonth((event.currentTarget as HTMLInputElement).value)
              }
              type="month"
              value={month}
            />
            <button
              class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text"
              onClick={fetchData}
              type="button"
            >
              {loading ? "Cargando..." : "Actualizar"}
            </button>
            <button
              class="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
              onClick={exportCsv}
              type="button"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </article>

      {!!error && (
        <p class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <article class="panel-card">
          <p class="text-sm text-muted">Ventas del mes</p>
          <p class="mt-1 text-xl font-bold text-text">
            {formatCOP(summary.sales)}
          </p>
          <p class="mt-1 text-xs text-muted">
            {summary.salesCount} movimientos
          </p>
        </article>
        <article class="panel-card">
          <p class="text-sm text-muted">Compras del mes</p>
          <p class="mt-1 text-xl font-bold text-text">
            {formatCOP(summary.purchases)}
          </p>
          <p class="mt-1 text-xs text-muted">
            {summary.purchasesCount} movimientos
          </p>
        </article>
        <article class="panel-card">
          <p class="text-sm text-muted">Utilidad neta</p>
          <p class="mt-1 text-xl font-bold text-primary">
            {formatCOP(summary.net)}
          </p>
          <p class="mt-1 text-xs text-muted">
            Ticket prom: {formatCOP(summary.avgTicket)}
          </p>
        </article>
        <article class="panel-card">
          <p class="text-sm text-muted">Pedidos del mes</p>
          <p class="mt-1 text-xl font-bold text-text">{summary.totalOrders}</p>
          <p class="mt-1 text-xs text-muted">
            {summary.completed} completados • {summary.cancelled} cancelados
          </p>
        </article>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <article class="panel-card">
          <h2 class="text-lg font-semibold text-text">
            Comparativo vs mes anterior
          </h2>
          <div class="mt-3 space-y-2 text-sm">
            <p class="flex items-center justify-between">
              <span class="text-muted">Ventas</span>
              <span class="font-semibold text-text">
                {percentChange(summary.sales, previousSummary.sales)}
              </span>
            </p>
            <p class="flex items-center justify-between">
              <span class="text-muted">Compras</span>
              <span class="font-semibold text-text">
                {percentChange(summary.purchases, previousSummary.purchases)}
              </span>
            </p>
            <p class="flex items-center justify-between">
              <span class="text-muted">Utilidad neta</span>
              <span class="font-semibold text-primary">
                {percentChange(summary.net, previousSummary.net)}
              </span>
            </p>
          </div>
        </article>

        <article class="panel-card">
          <h2 class="text-lg font-semibold text-text">
            Top productos vendidos
          </h2>
          <div class="mt-3 space-y-2 text-sm">
            {topProducts.length === 0 ? (
              <p class="text-muted">Sin ventas por producto en este mes.</p>
            ) : (
              topProducts.map((entry) => (
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
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <article class="panel-card">
          <h2 class="text-lg font-semibold text-text">Top compras del mes</h2>
          <div class="mt-3 space-y-2 text-sm">
            {topExpenses.length === 0 ? (
              <p class="text-muted">Sin compras registradas en este mes.</p>
            ) : (
              topExpenses.map((entry) => (
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
            Historial diario del mes
          </h2>
          <div class="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1 text-sm">
            {dailyRows.map((row) => (
              <article class="rounded-lg border border-border bg-background px-3 py-2">
                <p class="flex items-center justify-between">
                  <span class="font-semibold text-text">
                    {new Date(`${row.date}T00:00:00`).toLocaleDateString(
                      "es-CO",
                    )}
                  </span>
                  <span class="font-bold text-primary">
                    {formatCOP(row.net)}
                  </span>
                </p>
                <p class="mt-1 flex items-center justify-between text-muted">
                  <span>Ventas: {formatCOP(row.sales)}</span>
                  <span>Compras: {formatCOP(row.purchases)}</span>
                </p>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
