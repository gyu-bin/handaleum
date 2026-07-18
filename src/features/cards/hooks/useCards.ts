import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteCard, getCard, listCards, saveCard } from '../services/cardStorage';
import { cardsQueryKeys } from './cardsQueryKeys';

export function useCards() {
  return useQuery({
    queryKey: cardsQueryKeys.list,
    queryFn: listCards,
  });
}

export function useCard(id: string) {
  return useQuery({
    queryKey: cardsQueryKeys.detail(id),
    queryFn: () => getCard(id),
  });
}

export function useSaveCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveCard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardsQueryKeys.all }),
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardsQueryKeys.all }),
  });
}
