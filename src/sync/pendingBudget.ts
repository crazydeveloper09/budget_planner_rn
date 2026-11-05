import AsyncStorage from "@react-native-async-storage/async-storage";

const key = (profileId: number) => `bp_pending_budget_p${profileId}`;

export async function markBudgetPending(profileId: number) {
  const revision = `${Date.now()}-${Math.random()}`;
  await AsyncStorage.setItem(key(profileId), revision);
  return revision;
}

export async function hasPendingBudget(profileId: number) {
  return (await AsyncStorage.getItem(key(profileId))) != null;
}

export async function clearPendingBudget(profileId: number, revision: string) {
  // A later edit must survive completion of an older upload.
  if (await AsyncStorage.getItem(key(profileId)) === revision) {
    await AsyncStorage.removeItem(key(profileId));
  }
}
