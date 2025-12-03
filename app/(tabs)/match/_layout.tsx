import { Stack } from "expo-router";

export default function HistoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: "Match History",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Match Details",
        }}
      />
      <Stack.Screen
        name="enter-result"
        options={{
          title: "Enter Result",
        }}
      />
    </Stack>
  );
}
