import { Platform } from "react-native";
import Constants from "expo-constants";

export function getApiBaseUrl() {
  const env = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (env) return env;

  const hostUri = Constants.expoConfig?.hostUri ?? "";
  const host = hostUri.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:4000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  return "http://127.0.0.1:4000";
}
