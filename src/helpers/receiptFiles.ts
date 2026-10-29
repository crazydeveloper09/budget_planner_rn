import { Alert, Image } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { getRandomBytes } from "expo-crypto";
import { bytesToHex } from "../crypto/bytes";

const MAX_EDGE = 1280;

export function newReceiptId() {
  return `r_${bytesToHex(getRandomBytes(8))}`;
}

export function receiptsDir() {
  return `${FileSystem.documentDirectory ?? ""}receipts/`;
}

export function receiptUri(fileName: string) {
  return `${receiptsDir()}${fileName}`;
}

export async function ensureReceiptsDir() {
  const dir = receiptsDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

function imageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function persistReceiptFromPicker(sourceUri: string, id = newReceiptId()) {
  await ensureReceiptsDir();
  let actions: ImageManipulator.Action[] = [];
  try {
    const size = await imageSize(sourceUri);
    const longest = Math.max(size.width, size.height);
    if (longest > MAX_EDGE) {
      actions =
        size.width >= size.height ? [{ resize: { width: MAX_EDGE } }] : [{ resize: { height: MAX_EDGE } }];
    }
  } catch {
    actions = [{ resize: { width: 960 } }];
  }
  const processed = await ImageManipulator.manipulateAsync(sourceUri, actions, {
    compress: 0.55,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const fileName = `${id}.jpg`;
  const dest = receiptUri(fileName);
  await FileSystem.copyAsync({ from: processed.uri, to: dest });
  return { id, uri: dest, fileName };
}

export async function writeReceiptBase64(id: string, image: string) {
  await ensureReceiptsDir();
  const fileName = `${id}.jpg`;
  const dest = receiptUri(fileName);
  await FileSystem.writeAsStringAsync(dest, image, { encoding: FileSystem.EncodingType.Base64 });
  return { id, uri: dest, fileName };
}

export async function readReceiptBase64(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return null;
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export async function deleteReceiptFile(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // leftover file is not fatal
  }
}

export function pickReceiptImage(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert("Paragon", "Zrób zdjęcie albo wybierz z galerii.", [
      {
        text: "Aparat",
        onPress: () => {
          void (async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              Alert.alert("Aparat", "Bez zgody na aparat nie zrobisz zdjęcia paragonu.");
              resolve(null);
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 0.7,
            });
            resolve(result.canceled ? null : result.assets[0]?.uri ?? null);
          })();
        },
      },
      {
        text: "Galeria",
        onPress: () => {
          void (async () => {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              Alert.alert("Galeria", "Bez zgody na zdjęcia nie dodasz paragonu z galerii.");
              resolve(null);
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.7,
            });
            resolve(result.canceled ? null : result.assets[0]?.uri ?? null);
          })();
        },
      },
      { text: "Anuluj", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}
