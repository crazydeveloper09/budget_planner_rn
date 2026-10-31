import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useAccent } from "../../contexts/ThemeContext";
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED } from "../../helpers/privacyPolicy";
import { privacyPolicyUrl } from "../../helpers/support";

const PrivacyScreen: React.FC = () => {
  const { accent } = useAccent();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Budget Planner</Text>
      <Text style={styles.title}>Polityka prywatności</Text>
      <Text style={styles.updated}>Aktualizacja: {PRIVACY_UPDATED}</Text>
      <Text style={styles.body}>{PRIVACY_INTRO}</Text>
      {PRIVACY_SECTIONS.map((section) => (
        <View key={section.title} style={styles.block}>
          <Text style={styles.heading}>{section.title}</Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.body}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
      <Pressable onPress={() => void Linking.openURL(privacyPolicyUrl())}>
        <Text style={[styles.link, { color: accent }]}>Otwórz wersję WWW</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  kicker: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
    color: "#6b5f6a",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: "MontserratSemiBold",
    fontSize: 24,
    color: "#1f1220",
    marginTop: 6,
  },
  updated: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 8,
    marginBottom: 16,
  },
  block: {
    marginBottom: 18,
  },
  heading: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#1f1220",
    marginBottom: 8,
  },
  body: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#3d323c",
    lineHeight: 22,
    marginBottom: 8,
  },
  link: {
    fontFamily: "MontserratSemiBold",
    fontSize: 15,
    marginTop: 8,
  },
});

export default PrivacyScreen;
