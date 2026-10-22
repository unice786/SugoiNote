import { useTheme } from '../../theme/ThemeProvider';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { name: 'index', label: 'Inicio', icon: 'home-outline', activeIcon: 'home' },
  { name: 'apuntes', label: 'Apuntes', icon: 'document-text-outline', activeIcon: 'document-text' },
  { name: 'resumenes', label: 'Resúmenes', icon: 'sparkles-outline', activeIcon: 'sparkles' },
  { name: 'chat', label: 'Chat IA', icon: 'chatbubble-outline', activeIcon: 'chatbubble' },
  { name: 'examenes', label: 'Exámenes', icon: 'clipboard-outline', activeIcon: 'clipboard' },
  { name: 'comunidad', label: 'Comunidad', icon: 'people-outline', activeIcon: 'people' },
  { name: 'perfil', label: 'Perfil', icon: 'person-outline', activeIcon: 'person' },
] as const;

export default function TabsLayout() {
  const { tokens } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.textMuted,
        tabBarStyle: {
          backgroundColor: tokens.bgSidebar,
          borderTopColor: tokens.borderSubtle,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 8,
        },
        tabBarItemStyle: {
          paddingBottom: 4,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? tab.activeIcon : tab.icon}
                size={24}
                color={color}
              />
            ),
            tabBarLabel: tab.label,
          }}
        />
      ))}
    </Tabs>
  );
}