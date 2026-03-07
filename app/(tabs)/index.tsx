import { useRouter } from "expo-router";
import {
  AlertCircle,
  Clock,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { formatCOP } from "../../lib/currency";
import { supabase } from "../../lib/supabase";
import type { Note } from "../../types";

export default function HomeScreen() {
  const { username } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    todaySales: 0,
    todayPurchases: 0,
    pendingOrders: 0,
    lowSupplies: 0,
    pendingInvoices: 0,
    customersWithDebt: 0,
  });
  const [urgentNote, setUrgentNote] = useState<Note | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Sales
      const { data: sales, error: salesError } = await supabase
        .from("transactions")
        .select("amount")
        .eq("type", "venta")
        .gte("created_at", today);

      // Purchases
      const { data: purchases, error: purchaseError } = await supabase
        .from("transactions")
        .select("amount")
        .eq("type", "compra")
        .gte("created_at", today);

      // Pending Orders
      const { count: pendingOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendiente");

      // Low Supplies (Mock logic: just count total for now as we don't have thresholds yet)
      const { count: lowSupplies } = await supabase
        .from("supplies")
        .select("*", { count: "exact", head: true })
        .lt("quantity", 10);

      // Pending Invoices
      const { count: pendingInvoices } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendiente");

      // Customers with debt (fetch all customers and calculate)
      const { data: customersData } = await supabase
        .from("customers")
        .select("id");
      let customersWithDebt = 0;

      if (customersData) {
        for (const customer of customersData) {
          const { data: invoices } = await supabase
            .from("invoices")
            .select("amount")
            .eq("customer_id", customer.id)
            .eq("status", "pendiente");

          const invoiceTotal =
            invoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0;

          const { data: payments } = await supabase
            .from("customer_payments")
            .select("amount, type")
            .eq("customer_id", customer.id);

          const paymentTotal =
            payments?.reduce(
              (sum, p) => sum + (p.type === "abono" ? p.amount : -p.amount),
              0,
            ) || 0;

          if (invoiceTotal - paymentTotal > 0) {
            customersWithDebt++;
          }
        }
      }

      // Get urgent/important notes
      const { data: notes } = await supabase
        .from("notes")
        .select("*")
        .eq("is_read", false)
        .in("category", ["urgente", "importante"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (notes && notes.length > 0) {
        setUrgentNote(notes[0]);
      } else {
        setUrgentNote(null);
      }

      const totalSales =
        sales?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;
      const totalPurchases =
        purchases?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;

      setStats({
        todaySales: totalSales,
        todayPurchases: totalPurchases,
        pendingOrders: pendingOrders || 0,
        lowSupplies: lowSupplies || 0,
        pendingInvoices: pendingInvoices || 0,
        customersWithDebt,
      });
    } catch (e) {
      console.error(e);
    }
  };

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
        <Text className="text-3xl font-bold text-text">
          Hola, {username} 👋
        </Text>
        <Text className="text-muted text-lg">
          Resumen de hoy en la Panadería
        </Text>
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
            <Text className="text-muted ml-2 font-medium">Insumos Bajos</Text>
          </View>
          <Text className="text-2xl font-bold text-text">
            {stats.lowSupplies}
          </Text>
        </View>
      </View>

      <View className="bg-surface p-6 rounded-xl border border-border mt-4">
        <Text className="text-xl font-bold text-text mb-4">
          Accesos Rápidos
        </Text>
        <Text className="text-muted">
          Usa las pestañas inferiores para navegar a cada sección.
        </Text>
      </View>
    </ScrollView>
  );
}
