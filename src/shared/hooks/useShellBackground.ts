import { useMemo } from 'react';

import { useTheme } from '@/shared/theme/ThemeProvider';

/** Dynamic shell background for screens and chrome strips. */
export function useShellBackground(): { backgroundColor: string } {
  const { colors } = useTheme();
  return useMemo(
    () => ({ backgroundColor: colors.background }),
    [colors.background],
  );
}

/** Text colors that sit on the shell (not on paper cards / the map). */
export function useShellInk() {
  const { colors } = useTheme();
  return useMemo(
    () => ({
      ink: { color: colors.shellInk },
      soft: { color: colors.shellInkSoft },
      subtle: { color: colors.shellSubtle },
      fill: colors.shellInk,
      line: colors.line,
      hairline: colors.hairline,
    }),
    [colors],
  );
}
