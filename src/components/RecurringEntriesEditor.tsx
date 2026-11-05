import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAccent } from "../contexts/ThemeContext";
import { Member, NewTransaction, Transaction, TransactionType } from "../db/interfaces";
import { formatPln, parseAmount } from "../helpers/money";
import { ownerLabel } from "../helpers/owners";
import { toIsoDate } from "../helpers/dates";
import CategoryPicker from "./CategoryPicker";
import EditEntryModal from "./EditEntryModal";
import OwnerPicker from "./OwnerPicker";

type RecurringEntriesEditorProps = {
  title: string;
  addLabel: string;
  emptyLabel: string;
  kind: TransactionType;
  items: Transaction[];
  members?: Member[];
  showOwnerPicker?: boolean;
  readOnly?: boolean;
  onAdd: (input: { name: string; category: string; amount: number; memberId: number | null; date: string }) => void;
  onUpdate: (id: number, input: NewTransaction) => void;
  onRemove: (id: number) => void;
};

export default function RecurringEntriesEditor({
  title,
  addLabel,
  emptyLabel,
  kind,
  items,
  members = [],
  showOwnerPicker = false,
  readOnly = false,
  onAdd,
  onUpdate,
  onRemove,
}: RecurringEntriesEditorProps) {
  const { accent, surfaces } = useAccent();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);

  const [day, setDay] = useState("10");
  const validDay = /^\d{1,2}$/.test(day) && Number(day) >= 1 && Number(day) <= 31;
  const canAdd = (kind !== "income" || validDay) && category.length > 0 && parseAmount(amount) !== null;

  const resetForm = () => {
    setName("");
    setCategory("");
    setAmount("");
    setMemberId(null);
    setDay("10");
    setFormOpen(false);
  };

  const submit = () => {
    const parsed = parseAmount(amount);
    if (!category || parsed === null || !canAdd) return;
    onAdd({ name: name.trim(), category, amount: parsed, memberId, date: kind === "income" ? `2000-01-${day.padStart(2, "0")}` : toIsoDate(new Date()) });
    resetForm();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {readOnly ? null : (
        <Pressable
          onPress={() => {
            if (formOpen) resetForm();
            else setFormOpen(true);
          }}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name={formOpen ? "minus" : "plus"}
            size={26}
            color={accent}
          />
        </Pressable>
        )}
      </View>

      {formOpen && !readOnly ? (
        <>
          {showOwnerPicker ? (
            <OwnerPicker members={members} value={memberId} onChange={setMemberId} />
          ) : null}
          <TextInput
            mode="outlined"
            label="Kwota"
            placeholder="np. 1800"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={styles.input}
            outlineColor="#d7c8d3"
            activeOutlineColor={accent}
          />
          <TextInput
            mode="outlined"
            label="Nazwa (opcjonalnie)"
            placeholder={kind === "expense" ? "np. Czynsz za mieszkanie" : "np. Pensja Ani"}
            value={name}
            onChangeText={setName}
            style={styles.input}
            outlineColor="#d7c8d3"
            activeOutlineColor={accent}
          />
          {kind === "income" ? <><TextInput mode="outlined" label="Dzień wpływu w miesiącu (1–31)" value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} style={styles.input} /><Text>W krótszym miesiącu: ostatni dzień miesiąca.</Text></> : null}
          <CategoryPicker recurring type={kind} value={category} onChange={setCategory} />
          <Button
            mode="outlined"
            onPress={submit}
            disabled={!canAdd}
            textColor={accent}
            style={[styles.addButton, { borderColor: accent }]}
          >
            {addLabel}
          </Button>
        </>
      ) : null}

      {items.length === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={[styles.row, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}>
              <View style={styles.rowCopy}>
                <Text style={styles.personName}>{item.name || item.category}</Text>
                <Text style={styles.personMeta}>
                  {item.category} · {formatPln(item.amount)} / miesiąc
                  {kind === "income" ? ` · ${item.date.startsWith("2000-01-") ? Number(item.date.slice(8, 10)) : 10}. dzień miesiąca` : ""}
                  {showOwnerPicker ? ` · ${ownerLabel(item.memberId, members)}` : ""}
                </Text>
              </View>
              {readOnly ? null : (
                <>
                  <Pressable onPress={() => setEditing(item)} hitSlop={8}>
                    <MaterialCommunityIcons name="pencil-outline" size={22} color={accent} />
                  </Pressable>
                  <Pressable onPress={() => onRemove(item.id)} hitSlop={8}>
                    <MaterialCommunityIcons name="close-circle" size={22} color="#9a8a96" />
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      <EditEntryModal
        entry={editing}
        showOwnerPicker={showOwnerPicker}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          if (!editing) return;
          onUpdate(editing.id, input);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 18,
    color: "#1f1220",
    flex: 1,
    marginRight: 12,
  },
  input: {
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  addButton: {
    borderRadius: 12,
    marginBottom: 16,
  },
  empty: {
    fontFamily: "PoppinsRegular",
    color: "#6b5f6a",
    fontSize: 14,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#eadfe6",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fdf8fb",
  },
  rowCopy: {
    flex: 1,
  },
  personName: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#1f1220",
  },
  personMeta: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 2,
  },
});
