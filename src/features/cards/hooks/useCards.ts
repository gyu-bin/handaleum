import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { RecapCardDraft } from '../types';
import {
  deleteCard,
  deleteCards,
  getCard,
  listCards,
  saveCard,
  updateCard,
} from '../services/cardStorage';
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

export function useUpdateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      fields: Pick<RecapCardDraft, 'title' | 'comment'>;
    }) => updateCard(input.id, input.fields),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: cardsQueryKeys.all }),
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardsQueryKeys.all }),
  });
}

export function useDeleteCards() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCards,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardsQueryKeys.all }),
  });
}
