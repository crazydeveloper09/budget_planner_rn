export const getStackScreenOptions = (accent: string) => ({
  headerStyle: {
    backgroundColor: accent,
  },
  headerTintColor: "white",
  headerTitleStyle: {
    color: "white" as const,
    fontFamily: "MontserratSemiBold",
    fontSize: 19,
  },
  contentStyle: {
    backgroundColor: "#fff",
  },
});
