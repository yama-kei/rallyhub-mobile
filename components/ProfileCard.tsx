import type { ProfileModel } from "@/lib/data/models/ProfileModel";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ProfileCardProps {
  profile: ProfileModel;
  onRemove: () => void;
  footer?: React.ReactNode;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onRemove,
  footer,
}) => {
  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.name}>
          {profile.username || "Unknown Player"}
        </Text>
        <Text style={styles.id}>{profile.user_id}</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
        {footer}
        <TouchableOpacity onPress={onRemove}>
          <MaterialCommunityIcons name="close" size={26} color="#555" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
  },
  id: {
    fontSize: 12,
    color: "#666",
  },
});
