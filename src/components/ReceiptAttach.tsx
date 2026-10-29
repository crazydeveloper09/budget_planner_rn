import React from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { persistReceiptFromPicker, pickReceiptImage } from "../helpers/receiptFiles";
import { useAccent } from "../contexts/ThemeContext";

type ReceiptAttachProps = {
  uris: string[];
  onChange: (uris: string[]) => void;
};

const ReceiptAttach: React.FC<ReceiptAttachProps> = ({ uris, onChange }) => {
  const { accent, surfaces } = useAccent();

  const add = async () => {
    try {
      const uri = await pickReceiptImage();
      if (!uri) return;
      const stored = await persistReceiptFromPicker(uri);
      onChange([...uris, stored.uri]);
    } catch (error) {
      console.error(error);
      Alert.alert("Paragon", "Nie udało się dodać zdjęcia. Spróbuj ponownie.");
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => void add()}
        style={[styles.addBtn, { borderColor: accent, backgroundColor: surfaces.surface }]}
      >
        <MaterialCommunityIcons name="camera-plus-outline" size={18} color={accent} />
        <Text style={[styles.addLabel, { color: accent }]}>Dodaj paragon</Text>
      </Pressable>
      {uris.length > 0 ? (
        <View style={styles.thumbs}>
          {uris.map((uri) => (
            <View key={uri} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <Pressable
                onPress={() => onChange(uris.filter((item) => item !== uri))}
                style={styles.remove}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="close-circle" size={20} color="#6b5f6a" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
  },
  addLabel: {
    fontFamily: "MontserratSemiBold",
    fontSize: 15,
  },
  thumbs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  thumbWrap: {
    position: "relative",
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#eadfe6",
  },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
});

export default ReceiptAttach;
