import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import type { Href } from 'expo-router';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  House,
  TrendingUp,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/auth-context';

export default function AppTabs() {
  return (
    <Tabs>
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="habits" href="/" asChild>
            <TabButton icon={House}>Habits</TabButton>
          </TabTrigger>
          <TabTrigger name="analytics" href={'/analytics' as Href} asChild>
            <TabButton icon={TrendingUp}>Analytics</TabButton>
          </TabTrigger>
          <TabTrigger name="configuration" href={'/configuration' as Href} asChild>
            <TabButton icon={Settings}>Configuration</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
      <TabSlot />
    </Tabs>
  );
}

function TabButton({
  children,
  isFocused,
  icon: Icon,
  style,
  ...props
}: TabTriggerSlotProps & { icon: LucideIcon }) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={[style as any, { flexDirection: 'column' }]} className="flex-1 items-center gap-1">
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        className="w-14 h-14 items-center justify-center rounded-2xl">
        <Icon
          size={18}
          color={isFocused ? theme.text : theme.textSecondary}
          strokeWidth={2}
        />
      </ThemedView>
      <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  return (
    <ThemedView>
      <SafeAreaView edges={['top']}>
        <View className="flex-row items-center gap-2 px-4 py-2">
          <View {...props} className="flex-1 flex-row items-center gap-2">
            {props.children}
          </View>
          <UserMenu />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<View>(null);
  const [menuY, setMenuY] = useState(0);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  function handleOpen() {
    buttonRef.current?.measure((_x, _y, _w, h, _px, py) => {
      setMenuY(py + h + 6);
    });
    setOpen(true);
  }

  return (
    <>
      <Pressable ref={buttonRef} onPress={handleOpen} hitSlop={8}>
        <View
          style={{ backgroundColor: theme.backgroundSelected, width: 36, height: 36, borderRadius: 18 }}
          className="items-center justify-center">
          <ThemedText type="small" style={{ fontWeight: '600' }}>
            {initials}
          </ThemedText>
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)}>
          <View
            style={{
              position: 'absolute',
              right: 12,
              top: menuY,
              width: 220,
              borderRadius: 12,
              backgroundColor: theme.backgroundElement,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
              overflow: 'hidden',
            }}>
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: theme.backgroundSelected }}>
              <ThemedText style={{ fontWeight: '600' }}>{user?.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{user?.email}</ThemedText>
            </View>
            <Pressable
              onPress={() => { setOpen(false); router.push('/settings' as never); }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 14,
                opacity: pressed ? 0.6 : 1,
              })}>
              <Settings size={16} color={theme.textSecondary} strokeWidth={2} />
              <ThemedText themeColor="textSecondary">Settings</ThemedText>
            </Pressable>
            <View style={{ height: 1, backgroundColor: theme.backgroundSelected }} />
            <Pressable
              onPress={async () => { setOpen(false); await signOut(); }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 14,
                opacity: pressed ? 0.6 : 1,
              })}>
              <LogOut size={16} color={theme.textSecondary} strokeWidth={2} />
              <ThemedText themeColor="textSecondary">Sign out</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
