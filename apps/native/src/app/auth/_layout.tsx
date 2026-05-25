import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';

export default function AuthLayout() {
  const theme = useTheme();
  return (
    <Stack>
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen
        name="sign-up"
        options={{
          title: '',
          headerBackTitle: 'Sign in',
          headerStyle: { backgroundColor: theme.background },
          headerShadowVisible: false,
          headerTintColor: '#3c87f7',
        }}
      />
    </Stack>
  );
}
