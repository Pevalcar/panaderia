import "../global.css";

import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import {
  Slot,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, LogBox, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../context/AuthContext";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated and will be removed in a future release.",
]);

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // You can load custom fonts here if needed
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const Toast = require("react-native-toast-message").default;
  const { username, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!username && !inAuthGroup) {
      // Redirect to the login page
      router.replace("/login");
    } else if (username && inAuthGroup) {
      // Redirect to the tabs page
      router.replace("/(tabs)");
    }
  }, [username, isLoading, segments, rootNavigationState?.key, router]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={DarkTheme}>
        <Slot />
        {isLoading ? (
          <View
            style={{
              pointerEvents: "none",
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#0F172A",
            }}
          >
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : null}
        <Toast />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
