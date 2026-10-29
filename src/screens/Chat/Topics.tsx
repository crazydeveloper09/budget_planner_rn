import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useChat } from "../../contexts/ChatContext";
import { useAccent } from "../../contexts/ThemeContext";

const TopicsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { accent, surfaces } = useAccent();
  const { topics, messages, addTopic } = useChat();
  const [title, setTitle] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const lastPreview = (topicId: string) => {
    const last = [...messages].reverse().find((item) => item.topicId === topicId);
    if (!last) return "Jeszcze cisza. Napisz pierwsze zdanie.";
    if (last.plan) {
      return last.plan.type === "expense" ? `Zaplanowany wydatek · ${last.plan.category}` : `Zaplanowany wpływ · ${last.plan.category}`;
    }
    return last.body;
  };

  const onAdd = async () => {
    const created = await addTopic(title);
    if (!created) {
      Alert.alert("Nazwa tematu", "Podaj przynajmniej dwa znaki.");
      return;
    }
    setTitle("");
    setFormOpen(false);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <Text style={styles.deck}>Rozmowy w wątkach. Z czatu od razu wrzucisz wydatek albo wpływ do budżetu.</Text>
      {topics.map((topic) => (
        <Pressable
          key={topic.id}
          onPress={() =>
            navigation.navigate("ChatThread" as never, { topicId: topic.id, title: topic.title } as never)
          }
          style={[styles.card, { backgroundColor: surfaces.surface }]}
        >
          <View style={[styles.icon, { backgroundColor: accent }]}>
            <MaterialCommunityIcons name="pound" size={20} color="#fff" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{topic.title}</Text>
            <Text style={styles.preview} numberOfLines={2}>
              {lastPreview(topic.id)}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={accent} />
        </Pressable>
      ))}

      {formOpen ? (
        <View style={styles.form}>
          <TextInput
            mode="outlined"
            label="Nowy temat"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            outlineColor={surfaces.border}
            activeOutlineColor={accent}
          />
          <Pressable onPress={() => void onAdd()} style={[styles.addBtn, { backgroundColor: accent }]}>
            <Text style={styles.addBtnText}>Dodaj temat</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setFormOpen(true)} style={styles.newLink}>
          <MaterialCommunityIcons name="plus" size={18} color={accent} />
          <Text style={[styles.newLinkText, { color: accent }]}>Nowy temat</Text>
        </Pressable>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingBottom: 120 },
  deck: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#6b5f6a",
    lineHeight: 20,
    marginBottom: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  title: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#1f1220",
  },
  preview: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 2,
  },
  newLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  newLinkText: {
    fontFamily: "MontserratSemiBold",
    fontSize: 15,
  },
  form: { marginTop: 8 },
  input: { marginBottom: 10, backgroundColor: "#fff" },
  addBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  addBtnText: {
    fontFamily: "MontserratSemiBold",
    color: "#fff",
    fontSize: 15,
  },
});

export default TopicsScreen;
