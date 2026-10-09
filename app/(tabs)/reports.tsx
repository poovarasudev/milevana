import { ComingSoonTab } from '../../src/ui/ComingSoonTab';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';

export default function Reports() {
  return (
    <ErrorBoundary screen="reports">
      <ComingSoonTab tabKey="reports" />
    </ErrorBoundary>
  );
}
