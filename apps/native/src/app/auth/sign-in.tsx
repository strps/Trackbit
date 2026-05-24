import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof schema>, string>>;

export default function SignInScreen() {
  const { signIn } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function clearFieldError(field: keyof FieldErrors) {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit() {
    setServerError(null);

    const result = schema.safeParse({ email, password });
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setFieldErrors({
        email: flat.email?.[0],
        password: flat.password?.[0],
      });
      return;
    }
    setFieldErrors({});

    setIsLoading(true);
    try {
      await signIn(result.data.email, result.data.password);
      // Stack.Protected in _layout.tsx navigates to (tabs) once user is set.
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign in failed. Please try again.';
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const inputStyle = (hasError: boolean) => [
    styles.input,
    {
      backgroundColor: theme.backgroundElement,
      color: theme.text,
      borderWidth: 1,
      borderColor: hasError ? '#ef4444' : 'transparent',
    },
  ];

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <ThemedText type="subtitle">Welcome back</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.headerSub}>
              Sign in to your account
            </ThemedText>
          </View>

          <View style={styles.form}>
            {serverError ? (
              <View style={styles.errorBanner}>
                <ThemedText style={styles.errorBannerText}>{serverError}</ThemedText>
              </View>
            ) : null}

            <View style={styles.field}>
              <ThemedText type="smallBold" style={styles.label}>
                Email
              </ThemedText>
              <TextInput
                style={inputStyle(!!fieldErrors.email)}
                value={email}
                onChangeText={(v) => { setEmail(v); clearFieldError('email'); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                placeholder="name@example.com"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="next"
                editable={!isLoading}
              />
              {fieldErrors.email ? (
                <ThemedText style={styles.fieldError}>{fieldErrors.email}</ThemedText>
              ) : null}
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold" style={styles.label}>
                Password
              </ThemedText>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[inputStyle(!!fieldErrors.password), styles.passwordInput]}
                  value={password}
                  onChangeText={(v) => { setPassword(v); clearFieldError('password'); }}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  placeholderTextColor={theme.textSecondary}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={[styles.eyeButton, { backgroundColor: theme.backgroundElement }]}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <ThemedText type="small" themeColor="textSecondary">
                    {showPassword ? 'Hide' : 'Show'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
              {fieldErrors.password ? (
                <ThemedText style={styles.fieldError}>{fieldErrors.password}</ThemedText>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { opacity: isLoading ? 0.6 : 1 }]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.submitText}>
                {isLoading ? 'Signing in…' : 'Sign in'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <ThemedText themeColor="textSecondary" type="small">
              Don't have an account?{'  '}
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/auth/sign-up' as never)}>
              <ThemedText type="small" style={styles.signUpLink}>
                Sign up
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  headerSub: {
    marginTop: Spacing.one,
  },
  form: {
    gap: Spacing.three,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: Spacing.three,
  },
  errorBannerText: {
    color: '#ef4444',
    fontSize: 14,
  },
  field: {
    gap: Spacing.two,
  },
  label: {
    marginBottom: 2,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  passwordInput: {
    flex: 1,
  },
  eyeButton: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: '#3c87f7',
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  submitText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  signUpLink: {
    color: '#3c87f7',
  },
});
