import { Stack } from 'expo-router';

/**
 * Nested stack so /cards/create → /cards/[id] keeps create underneath.
 * Without this, sibling routes under /cards replace each other and back
 * jumps to home.
 */
export default function CardsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Create stays under preview — freeze it so collage/grid don't keep
        // baking thumbs while the preview/export screen is open.
        freezeOnBlur: true,
      }}
    />
  );
}
