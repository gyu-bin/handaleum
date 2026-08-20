import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { strings } from '@/shared/constants/strings';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { StateView } from './StateView';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fallback, { backgroundColor: colors.canvas }]}>
      <StateView
        icon="⚠️"
        title={strings.common.error}
        actionLabel={strings.common.retry}
        onAction={onRetry}
      />
    </View>
  );
}

/**
 * App-wide crash net: a render error anywhere below shows a retry surface
 * instead of a blank white screen.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Uncaught render error', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
  },
});
