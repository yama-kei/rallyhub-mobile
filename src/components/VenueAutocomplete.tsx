// src/components/VenueAutocomplete.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { RemoteVenue } from "@/lib/supabase/types";
import { useVenueStore } from "@/lib/data/hooks/useVenueStore";

interface VenueAutocompleteProps {
  onSelectVenue: (venue: RemoteVenue | null) => void;
  selectedVenue?: RemoteVenue | null;
  placeholder?: string;
}

export default function VenueAutocomplete({
  onSelectVenue,
  selectedVenue,
  placeholder = "Search for a venue...",
}: VenueAutocompleteProps) {
  const { venues, loading, loadVenues, syncFromSupabase, searchVenues } = useVenueStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredVenues, setFilteredVenues] = useState<RemoteVenue[]>([]);

  // Load venues on mount and sync from Supabase
  useEffect(() => {
    const initVenues = async () => {
      await loadVenues();
      // Sync from Supabase in the background
      syncFromSupabase();
    };
    initVenues();
  }, []);

  // Update search query when selectedVenue changes
  useEffect(() => {
    if (selectedVenue) {
      setSearchQuery(selectedVenue.name);
      setShowSuggestions(false);
    }
  }, [selectedVenue]);

  // Filter venues based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchVenues(searchQuery);
      setFilteredVenues(results);
    } else {
      setFilteredVenues(venues);
    }
  }, [searchQuery, venues]);

  const handleSelectVenue = (venue: RemoteVenue) => {
    setSearchQuery(venue.name);
    setShowSuggestions(false);
    onSelectVenue(venue);
  };

  const handleClearSelection = () => {
    setSearchQuery("");
    setShowSuggestions(false);
    onSelectVenue(null);
  };

  const handleFocus = () => {
    setShowSuggestions(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={handleFocus}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearSelection}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Loading venues...</Text>
        </View>
      )}

      {showSuggestions && filteredVenues.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            style={styles.suggestionsList}
            nestedScrollEnabled
          >
            {filteredVenues.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestionItem}
                onPress={() => handleSelectVenue(item)}
              >
                <Text style={styles.venueName}>{item.name}</Text>
                {item.address && (
                  <Text style={styles.venueAddress}>{item.address}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {showSuggestions && !loading && filteredVenues.length === 0 && searchQuery.trim() !== "" && (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>No venues found</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  input: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  clearButton: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  clearButtonText: {
    fontSize: 18,
    color: "#666",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666",
  },
  suggestionsContainer: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  venueName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  venueAddress: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  noResultsContainer: {
    padding: 16,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 14,
    color: "#666",
  },
});
