import { Stack } from 'expo-router';

/**
 * Nested stack so /cards/create → /cards/[id] keeps create underneath.
 * Without this, sibling routes under /cards replace each other and back
 * jumps to home.
 */
export default function CardsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
