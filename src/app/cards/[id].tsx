import { useLocalSearchParams } from 'expo-router';

import { CardPreviewScreen } from '@/features/cards';

export default function CardPreviewRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const cardId = Array.isArray(id) ? id[0] : id;
  if (!cardId) {
    return null;
  }
  return <CardPreviewScreen cardId={cardId} />;
}
