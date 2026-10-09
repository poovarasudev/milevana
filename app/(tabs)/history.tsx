import { ComingSoonTab } from '../../src/ui/ComingSoonTab';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';

export default function History() {
  return (
    <ErrorBoundary screen="history">
      <ComingSoonTab tabKey="history" showAdd />
    </ErrorBoundary>
  );
}
