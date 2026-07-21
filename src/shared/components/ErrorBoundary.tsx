import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { StateView } from './StateView';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * App-wide crash net: a render error anywhere below shows a retry surface
 * instead of a blank white screen. Retry clears the boundary; a deterministic
 * error surfaces again, which is the intended signal rather than a silent loop.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Uncaught render error', error);
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <StateView
            icon="⚠️"
            title={strings.common.error}
            actionLabel={strings.common.retry}
            onAction={this.reset}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
});
