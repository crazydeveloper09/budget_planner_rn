import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { StyleSheet, View } from "react-native";
import { List, TextInput } from "react-native-paper";
import { readShops, Shop, suggestShops } from "../helpers/shops";

export default function ExpenseNameInput({ profileId, value, onChange, onSuggest }: {
  profileId?: number;
  value: string;
  onChange: (value: string) => void;
  onSuggest: (shop: Shop) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);
  const [custom, setCustom] = useState<Shop[]>([]);

  useFocusEffect(useCallback(() => {
    if (profileId === undefined) return;
    let active = true;
    void readShops(profileId).then(shops => {
      if (active) setCustom(shops);
    }).catch(console.warn);
    return () => { active = false; };
  }, [profileId]));

  const suggestions = focused && value !== accepted ? suggestShops(custom, value) : [];

  return (
    <View style={styles.field}>
      <TextInput
        mode="outlined"
        style={styles.input}
        label="Nazwa (opcjonalnie)"
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={text => {
          setAccepted(null);
          onChange(text);
        }}
      />
      {suggestions.map(shop => (
        <List.Item
          key={JSON.stringify([shop.category, shop.name])}
          title={shop.name}
          description={shop.category}
          accessibilityRole="button"
          onPress={() => {
            setAccepted(shop.name);
            onSuggest(shop);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  input: { backgroundColor: "#fff" },
});
