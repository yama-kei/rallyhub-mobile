import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerBackTitle: "Back" }}>
      <Stack.Screen
        name="index"
        options={{
          title: "Profile",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          title: "Edit Profile",
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="passport"
        options={{
          title: "Player Passport",
          headerShown: true,
        }}
      />
    </Stack>
  );
}
