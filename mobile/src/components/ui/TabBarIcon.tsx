import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme/colors';

type IconProps = { color: string; size?: number };

function MissionsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="5" width="16" height="14" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M8 9h8M8 13h5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function StockIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8l8-4 8 4v8l-8 4-8-4V8z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M12 12V20M4 8l8 4 8-4" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function AssistIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l1.6 4.8L18.5 9.5l-4.9 1.6L12 16l-1.6-4.9L5.5 9.5l4.9-1.7L12 3z" fill={color} />
      <Path d="M18.5 15.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z" fill={color} opacity={0.85} />
    </Svg>
  );
}

function ProfileIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="9" r="3.2" stroke={color} strokeWidth={1.8} />
      <Path
        d="M6 19c1.2-2.5 3.2-3.8 6-3.8s4.8 1.3 6 3.8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const ICONS = {
  missions: MissionsIcon,
  stock: StockIcon,
  assist: AssistIcon,
  profile: ProfileIcon,
} as const;

export type TabIconName = keyof typeof ICONS;

/** Icône tab bar VECTRACOM — mint actif, muted inactif. */
export function TabBarIcon({
  name,
  focused,
  size = 22,
}: {
  name: TabIconName;
  focused: boolean;
  size?: number;
}) {
  const Icon = ICONS[name];
  const color = focused ? colors.primary : colors.muted;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 28 }}>
      <Icon color={color} size={size} />
    </View>
  );
}
