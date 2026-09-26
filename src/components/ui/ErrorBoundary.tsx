"use client";

import { Component, type ReactNode } from "react";
import { friendlyErrorMessage } from "@/lib/apiClient";
import ErrorBanner from "./ErrorBanner";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  /** Called before retrying, e.g. to clear a cached Suspense resource so the next render refetches. */
  onRetry?: () => void;
}

interface State {
  error: unknown;
}

/** Pairs with Suspense: a resource's `.read()` throws its rejection here once settled. Class component because
 * `getDerivedStateFromError`/`componentDidCatch` have no hook equivalent. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  retry = () => {
    this.props.onRetry?.();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="space-y-2">
          <ErrorBanner>{friendlyErrorMessage(this.state.error, this.props.fallbackMessage ?? "Something went wrong.")}</ErrorBanner>
          <button type="button" onClick={this.retry} className="btn-secondary">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
