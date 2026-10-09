// First-run routing (FND-SHL-01, DR-09): welcome once per uid; afterwards the
// tabs — which show the "Add your first vehicle" empty state when there is no
// active vehicle.

import { Redirect } from 'expo-router';
import { useAppStore } from '../src/features/appStore';

export default function Index() {
  const welcomeSeen = useAppStore((s) => s.welcomeSeen);
  return <Redirect href={welcomeSeen ? '/(tabs)' : '/welcome'} />;
}
