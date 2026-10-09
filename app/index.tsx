import { Redirect } from 'expo-router';
import { useStore } from '../src/data/store';

export default function Index() {
  const hasVehicle = useStore((s) => s.vehicles.some((v) => !v.archived));
  return <Redirect href={hasVehicle ? '/(tabs)' : '/welcome'} />;
}
