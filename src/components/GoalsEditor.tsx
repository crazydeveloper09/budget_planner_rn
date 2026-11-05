import GoalCategoryPicker, { goalCategoryIcon } from "./GoalCategoryPicker";
import GoalPriorityPicker from "./GoalPriorityPicker";
import { orderedGoals } from "../helpers/goalAllocation";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useAccent } from "../contexts/ThemeContext";
import { Goal } from "../db/interfaces";
import { parsePickedDate, toIsoDate } from "../helpers/dates";
import { formatPln, parseAmount } from "../helpers/money";

type GoalsEditorProps = {
  items: Goal[];
  readOnly?: boolean;
  autoSavedFor?: (goal: Goal) => number;
  onAdd: (input: { priority?: number; category?: string; title: string; targetAmount: number; savedAmount: number; deadline: string | null }) => void;
  onUpdate: (
    id: string,
    input: { priority?: number; category?: string; title: string; targetAmount: number; savedAmount: number; deadline: string | null }
  ) => void;
  onOpen?: (id: string) => void;
  onRemove: (id: string) => void;
};

function formatDeadline(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("pl-PL");
}

export default function GoalsEditor({
  items,
  readOnly = false,
  autoSavedFor,
  onAdd,
  onRemove,
  onOpen,
}: GoalsEditorProps) {
  const { accent, surfaces } = useAccent();
  const [formOpen, setFormOpen] = useState(false);
  const [priority, setPriority] = useState(2);
  const [category, setCategory] = useState("Inne");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);

  const canSave = title.trim().length > 0 && parseAmount(target) !== null;

  const resetForm = () => {
    setFormOpen(false);
    setTitle("");
    setCategory("Inne");
    setPriority(2);
    setTarget("");
    setSaved("");
    setDeadline(null);
  };

  const submit = () => {
    const targetAmount = parseAmount(target);
    if (!title.trim() || targetAmount === null) return;
    const savedAmount = parseAmount(saved) ?? 0;
    const payload = {
      title: title.trim(),
      category,
      priority,
      targetAmount,
      savedAmount,
      deadline,
    };
    onAdd(payload);
    resetForm();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Cele</Text>
        {readOnly ? null : (
          <Pressable
            onPress={() => {
              if (formOpen) resetForm();
              else setFormOpen(true);
            }}
            hitSlop={8}
          >
            <MaterialCommunityIcons name={formOpen ? "minus" : "plus"} size={26} color={accent} />
          </Pressable>
        )}
      </View>

      {formOpen && !readOnly ? (
        <>
          <GoalCategoryPicker value={category} onChange={setCategory} />
          <GoalPriorityPicker value={priority} onChange={setPriority} />
          <TextInput
            mode="outlined"
            label="Nazwa celu"
            placeholder="np. Wakacje, nowy laptop"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            outlineColor="#d7c8d3"
            activeOutlineColor={accent}
          />
          <TextInput
            mode="outlined"
            label="Kwota docelowa"
            placeholder="np. 4000"
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
            style={styles.input}
            outlineColor="#d7c8d3"
            activeOutlineColor={accent}
          />
          <TextInput
            mode="outlined"
            label="Dodatkowo odłożone"
            placeholder="np. 500"
            value={saved}
            onChangeText={setSaved}
            keyboardType="decimal-pad"
            style={styles.input}
            outlineColor="#d7c8d3"
            activeOutlineColor={accent}
          />
          <Text style={styles.hint}>Niewykorzystany limit trafia do celów według priorytetu i kolejności dodania.</Text>
          <Pressable onPress={() => setDateOpen(true)} style={styles.deadlineRow}>
            <MaterialCommunityIcons name="calendar-outline" size={20} color={accent} />
            <Text style={styles.deadlineText}>
              {deadline ? `Termin: ${formatDeadline(deadline)}` : "Termin (opcjonalnie)"}
            </Text>
            {deadline ? (
              <Pressable
                onPress={() => setDeadline(null)}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="close" size={18} color="#9a8a96" />
              </Pressable>
            ) : null}
          </Pressable>
          <DateTimePickerModal
            isVisible={dateOpen}
            mode="date"
            date={deadline ? parsePickedDate(deadline) : new Date()}
            onConfirm={(picked) => {
              setDeadline(toIsoDate(picked));
              setDateOpen(false);
            }}
            onCancel={() => setDateOpen(false)}
            confirmTextIOS="OK"
            cancelTextIOS="Anuluj"
            locale="pl-PL"
          />
          <Button
            mode="contained"
            buttonColor={accent}
            textColor="#fff"
            disabled={!canSave}
            onPress={submit}
            style={styles.addButton}
          >
            Dodaj cel
          </Button>
        </>
      ) : null}

      {items.length === 0 && !formOpen ? (
        <Text style={styles.empty}>
          Nie dodano jeszcze celów — np. wakacje albo poduszka bezpieczeństwa. Niewykorzystany dzienny limit dzielimy według priorytetu i kolejności dodania.
        </Text>
      ) : (
        <View style={styles.list}>
          {orderedGoals(items).map((item) => {
            const fromDays = autoSavedFor?.(item) ?? 0;
            const saved = Math.round((item.savedAmount + fromDays) * 100) / 100;
            const ratio = item.targetAmount > 0 ? Math.min(1, Math.max(0, saved / item.targetAmount)) : 0;
            const done = ratio >= 1;
            return (
              <View key={item.id} style={[styles.row, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}>
                <View style={styles.rowCopy}>
                  <View style={styles.goalTitleRow}><MaterialCommunityIcons name={goalCategoryIcon(item.category)} size={21} color={accent} /><Text style={[styles.personName, { flex: 1 }]}>{item.title}</Text>                <View style={styles.rowActions}>
                {onOpen ? <Pressable accessibilityRole="button" accessibilityLabel={"Zobacz plan celu: " + item.title} onPress={() => onOpen(item.id)} style={styles.iconButton}><MaterialCommunityIcons name="clipboard-text-outline" size={22} color={accent} /></Pressable> : null}
                {readOnly ? null : (
                  <>
                    <Pressable
                      onPress={() => {
                        Alert.alert("Usunąć cel?", item.title, [
                          { text: "Anuluj", style: "cancel" },
                          { text: "Usuń", style: "destructive", onPress: () => onRemove(item.id) },
                        ]);
                      }}
                      style={styles.iconButton}
                      accessibilityRole="button"
                      accessibilityLabel={"Usuń cel: " + item.title}
                    >
                      <MaterialCommunityIcons name="close-circle" size={22} color="#9a8a96" />
                    </Pressable>
                  </>
                )}
                </View></View>
                  <Text style={styles.personMeta}>
                    {formatPln(saved)} z {formatPln(item.targetAmount)}
                    {item.deadline ? ` · do ${formatDeadline(item.deadline)}` : ""}
                  </Text>
                  {fromDays > 0 ? (
                    <Text style={styles.personMeta}>w tym {formatPln(fromDays)} z dziennych limitów</Text>
                  ) : null}
                  <View style={[styles.track, { backgroundColor: surfaces.border }]}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.round(ratio * 100)}%`, backgroundColor: done ? "#2f9e6e" : accent },
                      ]}
                    />
                  </View>
                </View>

              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  goalTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  iconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  wrap: {
    marginTop: 8,
    marginBottom: 8,
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
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  deadlineText: {
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#1f1220",
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
  hint: {
    fontFamily: "PoppinsRegular",
    color: "#6b5f6a",
    fontSize: 12,
    marginTop: -6,
    marginBottom: 12,
    lineHeight: 17,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    borderWidth: 1,
    borderColor: "#eadfe6",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fdf8fb",
  },
  rowCopy: {
    width: "100%",
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
  track: {
    height: 8,
    borderRadius: 99,
    backgroundColor: "#eadfe6",
    marginTop: 8,
    overflow: "hidden",
  },
  fill: {
    height: 8,
    borderRadius: 99,
  },
});
