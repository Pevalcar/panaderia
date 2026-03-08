import {
  AlertCircle,
  CalendarDays,
  Clock,
  Crown,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { formatCOP } from "../../lib/currency";
import { supabase } from "../../lib/supabase";

type Period = "dia" | "semana" | "mes";

type TransactionItem = {
  product_name?: string;
  quantity?: number;
};

type Transaction = {
  type: "venta" | "compra";
  sale_type?: "productos" | "otros";
  amount: number;
  description?: string | null;
  items?: TransactionItem[] | null;
  created_at: string;
};

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

const PERIOD_OPTIONS: Array<{ id: Period; label: string }> = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
];

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
    (sum, item) => sum + (item.amount || 0),
    0,
  );
  const purchases = purchaseTransactions.reduce(
    (sum, item) => sum + (item.amount || 0),
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
    purchasedMap.set(key, (purchasedMap.get(key) || 0) + item.amount);
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
      current.sales += item.amount || 0;
    } else {
      current.purchases += item.amount || 0;
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

export default function HomeScreen() {
  const { username } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("dia");
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayPurchases: 0,
    pendingOrders: 0,
    completedOrders: 0,
  });
  const [report, setReport] = useState<DashboardReport>({
    sales: 0,
    purchases: 0,
    netProfit: 0,
    avgTicket: 0,
    salesCount: 0,
    purchasesCount: 0,
    topBreads: [],
    topPurchasedMaterials: [],
  });
  const [dailyHistory, setDailyHistory] = useState<DailySummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: transactions } = await supabase
        .from("transactions")
        .select("type, sale_type, amount, description, items, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      const typedTransactions = (transactions || []) as Transaction[];
      setAllTransactions(typedTransactions);

      const todaySales = typedTransactions
        .filter((item) => item.type === "venta" && item.created_at >= today)
        .reduce((sum, item) => sum + (item.amount || 0), 0);

      const todayPurchases = typedTransactions
        .filter((item) => item.type === "compra" && item.created_at >= today)
        .reduce((sum, item) => sum + (item.amount || 0), 0);

      // Pending Orders
      const { count: pendingOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendiente");

      const { count: completedOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "completado");

      setStats({
        todaySales,
        todayPurchases,
        pendingOrders: pendingOrders || 0,
        completedOrders: completedOrders || 0,
      });

      setDailyHistory(buildDailyHistory(typedTransactions));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const periodStart = getPeriodStart(selectedPeriod);
    const periodTransactions = allTransactions.filter(
      (item) => new Date(item.created_at).getTime() >= periodStart.getTime(),
    );
    setReport(buildReport(periodTransactions));
  }, [allTransactions, selectedPeriod]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366F1"
        />
      }
    >
      <View className="mb-8 mt-12">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-3xl font-bold text-text">
              Hola, {username} 👋
            </Text>
            <Text className="text-muted text-lg">
              Reportes rápidos de tu panadería
            </Text>
          </View>
          <TouchableOpacity
            onPress={async () => {
              await fetchStats();
            }}
            className="bg-surface p-2 rounded-full border border-border"
          >
            <RefreshCw color="#94A3B8" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-surface p-3 rounded-xl border border-border mb-4">
        <Text className="text-text font-bold mb-3">Periodo del informe</Text>
        <View className="flex-row gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => setSelectedPeriod(option.id)}
              className={`flex-1 py-2 rounded-lg items-center ${
                selectedPeriod === option.id ? "bg-primary" : "bg-background"
              }`}
            >
              <Text
                className={
                  selectedPeriod === option.id
                    ? "text-white font-bold"
                    : "text-muted"
                }
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="flex-row flex-wrap justify-between">
        <View className="w-[48%] bg-surface p-4 rounded-xl border border-border mb-4">
          <View className="flex-row items-center mb-2">
            <TrendingUp size={20} color="#10B981" />
            <Text className="text-muted ml-2 font-medium">Ventas Hoy</Text>
          </View>
          <Text className="text-2xl font-bold text-text">
            {formatCOP(stats.todaySales)}
          </Text>
        </View>

        <View className="w-[48%] bg-surface p-4 rounded-xl border border-border mb-4">
          <View className="flex-row items-center mb-2">
            <TrendingDown size={20} color="#EC4899" />
            <Text className="text-muted ml-2 font-medium">Insumos/Gastos</Text>
          </View>
          <Text className="text-2xl font-bold text-text">
            {formatCOP(stats.todayPurchases)}
          </Text>
        </View>

        <View className="w-[48%] bg-surface p-4 rounded-xl border border-border mb-4">
          <View className="flex-row items-center mb-2">
            <Clock size={20} color="#F59E0B" />
            <Text className="text-muted ml-2 font-medium">
              Pedidos Pendientes
            </Text>
          </View>
          <Text className="text-2xl font-bold text-text">
            {stats.pendingOrders}
          </Text>
        </View>

        <View className="w-[48%] bg-surface p-4 rounded-xl border border-border mb-4">
          <View className="flex-row items-center mb-2">
            <AlertCircle size={20} color="#EF4444" />
            <Text className="text-muted ml-2 font-medium">Completados</Text>
          </View>
          <Text className="text-2xl font-bold text-text">
            {stats.completedOrders}
          </Text>
        </View>
      </View>

      <View className="bg-surface p-6 rounded-xl border border-border mt-1 mb-4">
        <Text className="text-xl font-bold text-text mb-4">
          Resumen {selectedPeriod}
        </Text>

        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <TrendingUp size={18} color="#22C55E" />
            <Text className="text-muted">Ventas</Text>
          </View>
          <Text className="text-text font-semibold">
            {formatCOP(report.sales)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <TrendingDown size={18} color="#EF4444" />
            <Text className="text-muted">Compras/Gastos</Text>
          </View>
          <Text className="text-text font-semibold">
            {formatCOP(report.purchases)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Crown size={18} color="#F59E0B" />
            <Text className="text-muted">Ganancia neta</Text>
          </View>
          <Text className="text-primary font-bold">
            {formatCOP(report.netProfit)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <ShoppingBag size={18} color="#6366F1" />
            <Text className="text-muted">Ticket promedio</Text>
          </View>
          <Text className="text-text font-semibold">
            {formatCOP(report.avgTicket)}
          </Text>
        </View>
      </View>

      <View className="bg-surface p-6 rounded-xl border border-border mb-4">
        <Text className="text-xl font-bold text-text mb-4">
          Panes más vendidos
        </Text>
        {report.topBreads.length === 0 ? (
          <Text className="text-muted">
            Sin ventas de panes en este periodo.
          </Text>
        ) : (
          report.topBreads.map((entry) => (
            <View
              key={entry.name}
              className="flex-row items-center justify-between mb-2"
            >
              <Text className="text-text">{entry.name}</Text>
              <Text className="text-primary font-semibold">
                {entry.value} uds
              </Text>
            </View>
          ))
        )}
      </View>

      <View className="bg-surface p-6 rounded-xl border border-border mb-4">
        <Text className="text-xl font-bold text-text mb-4">
          Materiales/Compras top
        </Text>
        {report.topPurchasedMaterials.length === 0 ? (
          <Text className="text-muted">
            Sin compras registradas en este periodo.
          </Text>
        ) : (
          report.topPurchasedMaterials.map((entry) => (
            <View
              key={entry.name}
              className="flex-row items-center justify-between mb-2"
            >
              <Text className="text-text flex-1 mr-2">{entry.name}</Text>
              <Text className="text-pink-400 font-semibold">
                {formatCOP(entry.value)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View className="bg-surface p-6 rounded-xl border border-border mt-1">
        <View className="flex-row items-center mb-4 gap-2">
          <CalendarDays size={20} color="#60A5FA" />
          <Text className="text-xl font-bold text-text">
            Historial resumido (7 días)
          </Text>
        </View>

        {dailyHistory.map((day) => (
          <View
            key={day.label}
            className="bg-background rounded-lg p-3 border border-border mb-2"
          >
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-text font-semibold">{day.label}</Text>
              <Text className="text-primary font-bold">
                {formatCOP(day.net)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">
                Ventas: {formatCOP(day.sales)}
              </Text>
              <Text className="text-muted text-sm">
                Compras: {formatCOP(day.purchases)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
