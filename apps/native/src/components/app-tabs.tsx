import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import type { Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  House,
  TrendingUp,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '@/hooks/use-theme';

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
        <View {...props} className="flex-row items-center gap-2 px-4 py-2">
          {props.children}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
