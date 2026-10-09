// Cosmetic platform branching lives in src/ui (see scripts/check-boundaries.mjs).
import { KeyboardAvoidingViewProps, Platform } from 'react-native';

/** KeyboardAvoidingView behavior: padding on iOS, default elsewhere. */
export const KEYBOARD_BEHAVIOR: KeyboardAvoidingViewProps['behavior'] =
  Platform.OS === 'ios' ? 'padding' : undefined;
