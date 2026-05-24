import { useRef, useState } from 'react';
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
import * as Auth from '@/lib/auth';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof schema>, string>>;

export default function SignUpScreen() {
  const { signIn } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  function clearFieldError(field: keyof FieldErrors) {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit() {
    setServerError(null);

    const result = schema.safeParse({ name, email, password });
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setFieldErrors({
        name: flat.name?.[0],
        email: flat.email?.[0],
        password: flat.password?.[0],
      });
      return;
    }
    setFieldErrors({});

    setIsLoading(true);
    try {
      await Auth.signUp(result.data.name, result.data.email, result.data.password);
      await signIn(result.data.email, result.data.password);
      // Stack.Protected in _layout.tsx navigates to (tabs) once user is set.
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign up failed. Please try again.';
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
            <ThemedText type="subtitle">Create an account</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.headerSub}>
              Get started with Trackbit
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
                Name
              </ThemedText>
              <TextInput
                style={inputStyle(!!fieldErrors.name)}
                value={name}
                onChangeText={(v) => { setName(v); clearFieldError('name'); }}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                autoComplete="name"
                placeholder="Your name"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                editable={!isLoading}
              />
              {fieldErrors.name ? (
                <ThemedText style={styles.fieldError}>{fieldErrors.name}</ThemedText>
              ) : null}
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold" style={styles.label}>
                Email
              </ThemedText>
              <TextInput
                ref={emailRef}
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
                onSubmitEditing={() => passwordRef.current?.focus()}
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
                  ref={passwordRef}
                  style={[inputStyle(!!fieldErrors.password), styles.passwordInput]}
                  value={password}
                  onChangeText={(v) => { setPassword(v); clearFieldError('password'); }}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
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
                {isLoading ? 'Creating account…' : 'Create account'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <ThemedText themeColor="textSecondary" type="small">
              Already have an account?{'  '}
            </ThemedText>
            <TouchableOpacity onPress={() => router.back()}>
              <ThemedText type="small" style={styles.signInLink}>
                Sign in
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
  signInLink: {
    color: '#3c87f7',
  },
});
