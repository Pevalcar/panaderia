import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

export default function SkeletonLoader({
  width = "100%",
  height = 20,
  radius = 4,
  colorMode = "dark",
}: {
  width?: number | `${number}%` | "auto";
  height?: number | `${number}%` | "auto";
  radius?: number;
  colorMode?: "light" | "dark";
}) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [opacity]);

  const backgroundColor = colorMode === "dark" ? "#2a2a2a" : "#e6e6e6";

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor,
        opacity,
      }}
    />
  );
}
