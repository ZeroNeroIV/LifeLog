import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '../theme';

export default function TooltipButton({ 
  icon, 
  onPress, 
  available = true, 
  tooltipText = "Under maintenance",
  size = 50,
  iconSize = 20,
  color,
  iconColor,
}) {
  const { colors } = useTheme();
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef(null);
  const btnColor = color || colors.primary;
  const finalIconColor = iconColor || (available ? colors.primary : colors.textDim);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const showTooltipAnimated = () => {
    setShowTooltip(true);
    Animated.timing(tooltipAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Auto-hide after 2 seconds
      hideTimeoutRef.current = setTimeout(() => {
        Animated.timing(tooltipAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowTooltip(false));
      }, 2000);
    });
  };

  const handlePress = () => {
    if (!available) {
      showTooltipAnimated();
    } else {
      onPress?.();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[
          styles.btn, 
          { width: size, height: size, borderRadius: size / 2 },
          !available && styles.btnDisabled,
          available && { backgroundColor: btnColor + '20' }
        ]}
        onPress={handlePress}
      >
        {React.cloneElement(icon, { 
          color: finalIconColor, 
          size: iconSize 
        })}
      </TouchableOpacity>
      
      {showTooltip && (
        <Animated.View 
          style={[
            styles.tooltip,
            { 
              opacity: tooltipAnim,
              transform: [{
                translateY: tooltipAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                })
              }]
            }
          ]}
        >
          <Text style={[styles.tooltipText, { color: colors.text }]}>{tooltipText}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  tooltip: {
    position: 'absolute',
    top: -40,
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 100,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
