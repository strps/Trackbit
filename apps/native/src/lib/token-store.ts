import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "trackbit_session_token";

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Accessible after the first device unlock after boot — allows token reads
  // on app resume without requiring the user to unlock again.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, OPTIONS);
}

export async function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY, OPTIONS);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY, OPTIONS);
}
