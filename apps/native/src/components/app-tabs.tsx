import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  House,
  Dumbbell,
  TrendingUp,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="habits" href="/" asChild>
            <TabButton icon={House}>Habits</TabButton>
          </TabTrigger>
          <TabTrigger name="log" href={'/log' as Href} asChild>
            <TabButton icon={Dumbbell}>Log</TabButton>
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
  ...props
}: TabTriggerSlotProps & { icon: LucideIcon }) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <Icon
          size={15}
          color={isFocused ? theme.text : theme.textSecondary}
          strokeWidth={2}
        />
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  return (
    <ThemedView>
      <SafeAreaView edges={['top']}>
        <View {...props} style={styles.tabListContainer}>
          <ThemedText type="smallBold" style={styles.brandText}>
            Trackbit
          </ThemedText>
          {props.children}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
