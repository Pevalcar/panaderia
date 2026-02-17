import { Tabs } from "expo-router";
import {
  FileText,
  Home,
  Package,
  ShoppingBag,
  Wallet,
} from "lucide-react-native";
import { Platform, useColorScheme } from "react-native";

const Colors = {
  active: "#6366F1",
  inactive: "#94A3B8",
  background: "#0F172A",
  border: "#334155",
};

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.active,
        tabBarInactiveTintColor: Colors.inactive,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          ...Platform.select({
            ios: {
              position: "absolute",
            },
            default: {},
          }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Cuentas",
          tabBarIcon: ({ color }) => <Wallet size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Pedidos",
          tabBarIcon: ({ color }) => <ShoppingBag size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Productos",
          tabBarIcon: ({ color }) => <Package size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: "Docs",
          tabBarIcon: ({ color }) => <FileText size={24} color={color} />,
        }}
      />
      {/* Pantallas ocultas pero accesibles */}
      <Tabs.Screen
        name="transactions"
        options={{
          href: null, // Oculta del tab bar
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          href: null, // Oculta del tab bar
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          href: null, // Oculta del tab bar
        }}
      />
    </Tabs>
  );
}
