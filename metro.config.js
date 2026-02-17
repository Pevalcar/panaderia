const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Set the app root directory
process.env.EXPO_ROUTER_APP_ROOT = __dirname;

// Create the default Expo config
const config = getDefaultConfig(__dirname);

// Wrap with NativeWind for CSS processing
module.exports = withNativeWind(config, { input: "./global.css" });
