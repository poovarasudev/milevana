// A small centered confirmation sheet (the discard-run dialog, the delete
// template dialog) styled like the global overlays.

import { Modal, View } from 'react-native';
import { Button, Card, T } from './kit';
import { useTheme } from './theme';

export function ConfirmSheet({ title, body, confirmLabel, cancelLabel, danger, onConfirm, onCancel }: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const th = useTheme();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,20,27,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Card style={{ width: '100%', maxWidth: 420, paddingVertical: 24, gap: 14, backgroundColor: th.card }}>
          <T size={18} weight="semi">{title}</T>
          {body ? <T size={14} color={th.muted}>{body}</T> : null}
          <Button title={confirmLabel} kind={danger ? 'danger' : 'primary'} onPress={onConfirm} />
          <Button title={cancelLabel} kind="text" onPress={onCancel} />
        </Card>
      </View>
    </Modal>
  );
}
