import React from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Receipt } from "../db/interfaces";
import { formatPln } from "../helpers/money";
import { useAccent } from "../contexts/ThemeContext";

type ReceiptPreviewModalProps = {
  receipt: Receipt | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
};

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({ receipt, onClose, onDelete }) => {
  const { accent } = useAccent();
  if (!receipt) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>{receipt.name || receipt.category}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color="#6b5f6a" />
            </Pressable>
          </View>
          <Text style={styles.meta}>
            {receipt.category} · {formatDay(receipt.date)} · {formatPln(receipt.amount)}
            {receipt.ownerName ? ` · ${receipt.ownerName}` : ""}
          </Text>
          <Image source={{ uri: receipt.uri }} style={styles.image} resizeMode="contain" />
          {onDelete ? (
            <Pressable
              onPress={() => onDelete(receipt.id)}
              style={styles.deleteBtn}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={accent} />
              <Text style={[styles.deleteText, { color: accent }]}>Usuń paragon</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 8, 18, 0.72)",
    justifyContent: "center",
    padding: 16,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    maxHeight: "92%",
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontFamily: "MontserratSemiBold",
    fontSize: 18,
    color: "#1f1220",
    flex: 1,
    marginRight: 12,
  },
  meta: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 4,
    marginBottom: 10,
  },
  image: {
    width: "100%",
    height: 420,
    backgroundColor: "#1f1220",
    borderRadius: 12,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
  },
  deleteText: {
    fontFamily: "MontserratSemiBold",
    fontSize: 15,
  },
});

export default ReceiptPreviewModal;
