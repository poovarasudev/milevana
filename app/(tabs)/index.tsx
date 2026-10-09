import { ComingSoonTab } from '../../src/ui/ComingSoonTab';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';

export default function Dashboard() {
  return (
    <ErrorBoundary screen="dashboard">
      <ComingSoonTab tabKey="dashboard" showAdd />
    </ErrorBoundary>
  );
}
