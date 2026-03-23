import React, { ReactNode, ComponentType, useMemo } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { LucideIcon } from 'lucide-react-native';

interface BentoCardProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  color?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function BentoCard({ title, subtitle, icon: Icon, color, children, style }: BentoCardProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={[s.card, style]}>
      <View style={s.header}>
        <View style={s.titleRow}>
          {Icon && <Icon size={20} color={color} style={s.icon} />}
          <Text style={s.title}>{title}</Text>
        </View>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={s.content}>{children}</View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceInput,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
  },
  header: { marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  icon: { marginRight: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textDim, fontWeight: '700', letterSpacing: 0.5 },
  content: { flex: 1 },
});
