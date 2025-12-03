import { useAuth } from "@/lib/auth/auth";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { useVenueStore } from "@/lib/data/hooks/useVenueStore";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { Alert, useColorScheme } from "react-native";
import Colors from "../../constants/Colors";

export default function TabsLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? "light"].tint;

  // Auth and profile state for leaderboard access check
  const { session } = useAuth();
  const { currentLink, loadLink } = useLocalProfileLinkStore();
  const { profiles, loadProfiles } = useProfileStore();
  const { venues, loadVenues } = useVenueStore();

  // Load necessary data on mount
  useEffect(() => {
    loadLink();
    loadProfiles();
    loadVenues();
  }, []);

  // Check if user can access leaderboard
  const canAccessLeaderboard = useMemo(() => {
    const isSignedIn = !!session;
    const profile = currentLink && profiles.length > 0
      ? profiles.find((p) => p.id === currentLink.profile_id)
      : null;
    const hasDefaultVenue = profile?.default_venue_id
      ? venues.some((v) => v.id === profile.default_venue_id)
      : false;
    return isSignedIn && hasDefaultVenue;
  }, [session, currentLink, profiles, venues]);

  // Color for leaderboard icon (greyed out when not accessible)
  const leaderboardIconColor = canAccessLeaderboard ? undefined : "#ccc";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tint,
      }}
    >
      {/* LEFT tab */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" size={24} color={color} />
          ),
        }}
      />

      {/* Match */}
      <Tabs.Screen
        name="match"
        options={{
          title: "Match",
          href: "/match",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color} size={size} />
          ),
        }}
      />

      {/* CENTER tab */}
      <Tabs.Screen
        name="play"
        options={{
          title: "Play",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="tennisball-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Leaderboard tab */}
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          href: "/leaderboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="trophy-outline"
              size={size}
              color={leaderboardIconColor ?? color}
            />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            if (!canAccessLeaderboard) {
              e.preventDefault();
              Alert.alert(
                "Leaderboard Unavailable",
                "Leaderboard is available for users who have signed-in, and have default venue selected"
              );
            }
          },
        }}
      />

      {/* Venue tab */}
      <Tabs.Screen
        name="venue"
        options={{
          title: "Venue",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" size={size} color={color} />
          ),
        }}
      />

      {/* RIGHT tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}