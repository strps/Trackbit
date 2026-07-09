import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import type { Href } from 'expo-router';
import { Modal, Pressable, View, Text } from 'react-native';
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
import Svg, { Circle, Defs, LinearGradient, Stop, ClipPath, Mask, G } from 'react-native-svg';

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

function CustomTabList(props: TabListProps) {
  return (
    <View className="w-full bg-gray-700 pb-2" >
      <SafeAreaView edges={['top']}>
        <View className="flex-row gap-2 px-4 py-2">
          <View {...props} className="flex-1 flex-row ">
            {props.children}
          </View>
          <UserMenu />
        </View>
      </SafeAreaView>
    </View>
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
      {/* <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
        {children}
      </ThemedText> */}
    </Pressable>
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
      <Pressable ref={buttonRef} onPress={handleOpen} hitSlop={8} className="px-5">
        <View
          className="w-16 h-16 rounded-full bg-green-500 items-center justify-center"
        >
          <UserMenuSVG />
          <Text style={{ position: 'absolute', fontWeight: '600', color: '#fff' }}>
            {initials}
          </Text>
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


function UserMenuSVG() {
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56" style={{ position: 'absolute' }}>
      <Defs>
        {/* Surface shading: light-to-dark top-to-bottom, multiplied over base color */}
        <LinearGradient id="um_surface" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="rgb(200,200,200)" />
          <Stop offset="100%" stopColor="rgb(40,40,40)" />
        </LinearGradient>
        {/* Border ring shading: white top → black bottom for the side shadow */}
        <LinearGradient id="um_side" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="rgb(255,255,255)" />
          <Stop offset="100%" stopColor="rgb(0,0,0)" />
        </LinearGradient>
        {/* Clip to circle boundary */}
        <ClipPath id="um_clip">
          <Circle cx="28" cy="28" r="28" />
        </ClipPath>
        {/* Mask that isolates only the border ring */}
        <Mask id="um_ring">
          <Circle cx="28" cy="28" r="28" fill="white" />
          <Circle cx="28" cy="28" r="25.5" fill="black" />
        </Mask>
      </Defs>
      {/* Surface gradient multiplied over base color for depth */}
      <G clipPath="url(#um_clip)">
        <Circle cx="28" cy="28" r="28" fill="url(#um_surface)" opacity={0.3} />
      </G>
      {/* Border ring with side-shadow gradient */}
      <Circle cx="28" cy="28" r="28" fill="url(#um_side)" mask="url(#um_ring)" opacity={0.5} />
    </Svg>
  )
}