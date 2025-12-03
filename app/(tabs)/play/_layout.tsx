// app/(tabs)/play/_layout.tsx
import { Stack } from "expo-router";

export default function PlayLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Play",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="scan-qr"
        options={{
          title: "Scan QR Code",
          headerShown: true,
        }}
      />
    </Stack>
  );
}
