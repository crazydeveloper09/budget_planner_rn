import React, { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAccent } from "../contexts/ThemeContext";
import { CloudFamilyPerson } from "../api/types";
import { AccountType, NewMember } from "../db/interfaces";
import { formatPln, parseAmount } from "../helpers/money";

type PeopleEditorProps = {
  accountType: Extract<AccountType, "family" | "business">;
  people: NewMember[];
  onAdd: (person: NewMember) => void;
  onUpdateDailySaldo?: (index: number, amount: number) => Promise<void>;
  onRemove: (index: number) => void;
  collapseForm?: boolean;
  readOnly?: boolean;
  canInvite?: boolean;
  inviteInfo?: CloudFamilyPerson[];
  onInvite?: (name: string) => void;
};

export default function PeopleEditor({
  accountType,
  people,
  onAdd,
  onRemove,
  onUpdateDailySaldo,
  collapseForm = false,
  readOnly = false,
  canInvite = false,
  inviteInfo = [],
  onInvite,
}: PeopleEditorProps) {
  const { accent, surfaces } = useAccent();
  const isFamily = accountType === "family";
  const [formOpen, setFormOpen] = useState(!collapseForm);
  const [name, setName] = useState("");
  const [dailySaldo, setDailySaldo] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [limitDraft, setLimitDraft] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);
  const [salary, setSalary] = useState("");

  const title = isFamily ? "Członkowie rodziny" : "Pracownicy";
  const addLabel = isFamily ? "Dodaj członka rodziny" : "Dodaj pracownika";
  const emptyLabel = isFamily
    ? "Nie dodano jeszcze członków rodziny"
    : "Nie dodano jeszcze pracowników";

  const resetForm = () => {
    setName("");
    setDailySaldo("");
    setSalary("");
  };

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;

    if (isFamily) {
      const saldo = parseAmount(dailySaldo);
      if (saldo === null) return;
      onAdd({
        name: trimmed,
        role: "family",
        dailySaldo: saldo,
        salary: null,
      });
    } else {
      const pay = parseAmount(salary);
      if (pay === null) return;
      onAdd({
        name: trimmed,
        role: "employee",
        dailySaldo: null,
        salary: pay,
      });
    }

    resetForm();
    if (collapseForm) {
      setFormOpen(false);
    }
  };

  const canAdd = isFamily
    ? name.trim().length > 1 && parseAmount(dailySaldo) !== null
    : name.trim().length > 1 && parseAmount(salary) !== null;

  return (
    <View>
      <Modal visible={editingIndex !== null && !readOnly} transparent animationType="fade" onRequestClose={() => { if (!savingLimit) setEditingIndex(null); }}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: surfaces.surface }]}>
            <Text style={styles.sectionTitle}>Dzienny limit: {editingIndex == null ? "" : people[editingIndex]?.name}</Text>
            <TextInput mode="outlined" label="Dzienny limit" value={limitDraft} onChangeText={setLimitDraft} keyboardType="decimal-pad" disabled={savingLimit} style={styles.input} />
            <Button mode="contained" buttonColor={accent} loading={savingLimit} disabled={savingLimit || parseAmount(limitDraft) === null} onPress={async () => {
              const amount = parseAmount(limitDraft);
              if (editingIndex == null || amount == null || !onUpdateDailySaldo) return;
              setSavingLimit(true);
              try {
                await onUpdateDailySaldo(editingIndex, amount);
                setEditingIndex(null);
              } catch {
                Alert.alert("Nie zapisano limitu", "Spróbuj ponownie.");
              } finally { setSavingLimit(false); }
            }}>Zapisz limit</Button>
            <Button disabled={savingLimit} onPress={() => setEditingIndex(null)}>Anuluj</Button>
          </View>
        </View>
      </Modal>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {collapseForm && !readOnly ? (
          <Pressable onPress={() => setFormOpen((open) => !open)} hitSlop={8}>
            <MaterialCommunityIcons
              name={formOpen ? "minus" : "plus"}
              size={26}
              color={accent}
            />
          </Pressable>
        ) : null}
      </View>
      {formOpen && !readOnly ? (
        <>
      <TextInput
        mode="outlined"
        label="Imię"
        placeholder="np. Kasia"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        style={styles.input}
        outlineColor="#d7c8d3"
        activeOutlineColor={accent}
      />
      {isFamily ? (
        <TextInput
          mode="outlined"
          label="Dzienny limit"
          placeholder="np. 150"
          value={dailySaldo}
          onChangeText={setDailySaldo}
          keyboardType="decimal-pad"
          style={styles.input}
          outlineColor="#d7c8d3"
          activeOutlineColor={accent}
        />
      ) : (
        <TextInput
          mode="outlined"
          label="Wypłata"
          placeholder="np. 6800"
          value={salary}
          onChangeText={setSalary}
          keyboardType="decimal-pad"
          style={styles.input}
          outlineColor="#d7c8d3"
          activeOutlineColor={accent}
        />
      )}
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

      {people.length === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        <View style={styles.list}>
          {people.map((person, index) => {
            const cloud = inviteInfo.find((item) => item.name === person.name);
            return (
            <View key={`${person.name}-${index}`} style={[styles.row, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}>
              <View style={styles.rowCopy}>
                <Text style={styles.personName}>{person.name}</Text>
                {isFamily ? (
                  <Text style={styles.personMeta}>
                    Limit {formatPln(person.dailySaldo ?? 0)} / dzień
                    {cloud?.linked ? " · ma konto" : cloud?.inviteCode ? ` · kod ${cloud.inviteCode}` : ""}
                  </Text>
                ) : (
                  <Text style={styles.personMeta}>
                    Wypłata {formatPln(person.salary ?? 0)}
                    {cloud?.linked ? " · ma konto" : cloud?.inviteCode ? ` · kod ${cloud.inviteCode}` : ""}
                  </Text>
                )}
              </View>
              {canInvite && !cloud?.linked ? (
                <Pressable onPress={() => onInvite?.(person.name)} hitSlop={8}>
                  <MaterialCommunityIcons name="email-plus-outline" size={22} color={accent} />
                </Pressable>
              ) : null}
              {isFamily && !readOnly && onUpdateDailySaldo ? (
                <Pressable accessibilityRole="button" accessibilityLabel={"Edytuj dzienny limit: " + person.name} onPress={() => { setEditingIndex(index); setLimitDraft(String(person.dailySaldo ?? 0).replace(".", ",")); }} hitSlop={8}>
                  <MaterialCommunityIcons name="pencil-outline" size={22} color={accent} />
                </Pressable>
              ) : null}
              {readOnly ? null : (
              <Pressable onPress={() => onRemove(index)} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={22} color="#9a8a96" />
              </Pressable>
              )}
            </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { borderRadius: 20, padding: 24, gap: 16 },
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
