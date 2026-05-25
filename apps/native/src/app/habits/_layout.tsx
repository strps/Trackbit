import { Stack } from "expo-router";

export default function HabitsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="manage" options={{ title: "Manage Habits" }} />
      <Stack.Screen name="new" options={{ title: "New Habit", presentation: "modal" }} />
      <Stack.Screen name="[id]/edit" options={{ title: "Edit Habit", presentation: "modal" }} />
    </Stack>
  );
}
