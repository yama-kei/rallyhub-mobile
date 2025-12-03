import { Stack } from "expo-router";

export default function LeaderboardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: "Leaderboard",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
