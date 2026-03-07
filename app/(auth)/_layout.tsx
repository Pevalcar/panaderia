import { Redirect, Slot } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function AuthLayout() {
  const { username, isLoading } = useAuth();

  if (!isLoading && username) {
    return <Redirect href="/(tabs)" />;
  }

  return <Slot />;
}
