import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}

export const unstable_settings = {
  initialRouteName: "(tabs)",
};