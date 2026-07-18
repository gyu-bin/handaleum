export const cardsQueryKeys = {
  all: ['cards'] as const,
  list: ['cards', 'list'] as const,
  detail: (id: string) => ['cards', 'detail', id] as const,
};
