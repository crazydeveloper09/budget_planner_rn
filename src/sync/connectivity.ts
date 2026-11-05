import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

function isOnline(state: NetInfoState) {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export async function hasInternet() {
  try {
    return isOnline(await NetInfo.fetch());
  } catch {
    return false;
  }
}

export function watchInternet(listener: (online: boolean) => void) {
  let previous: boolean | undefined;
  return NetInfo.addEventListener((state) => {
    // Unknown state during native initialization is not a loss of connection.
    if (state.isConnected == null) return;
    const online = isOnline(state);
    if (online === previous) return;
    previous = online;
    listener(online);
  });
}
