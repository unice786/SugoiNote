import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal as RNModal,
  ViewStyle,
  StyleProp,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Modal({
  visible,
  onClose,
  children,
  title,
  fullWidth = false,
  style,
}: ModalProps) {
  const { tokens } = useTheme();

  if (!visible) return null;

  const showHeader = title !== undefined;

  return (
    <RNModal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      supportedOrientations={['portrait']}
    >
      <View style={styles.overlay} onStartShouldSetResponder={() => true}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: tokens.bgSurface,
              borderRadius: tokens.radiusLg,
              width: fullWidth ? '95%' : '85%',
              maxWidth: 500,
            },
            style,
          ]}
        >
          {showHeader && (
            <View style={styles.header}>
              <Text style={[styles.title, { color: tokens.textPrimary }]}>{title ?? ''}</Text>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Text style={{ fontSize: 24, color: tokens.textMuted, lineHeight: 24 }}>&times;</Text>
              </Pressable>
            </View>
          )}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.contentWrapper}
            keyboardVerticalOffset={100}
          >
            <View style={styles.content}>{children}</View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    padding: 20,
  },
  container: {
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 24, 40, 0.07)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginRight: 28,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  contentWrapper: {
    maxHeight: '70%',
  },
  content: {
    paddingTop: 16,
  },
});