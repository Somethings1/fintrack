import { Component, type ReactNode } from 'react';
/** Fail visibly, without sending financial state or access tokens to a logger. */
export class AppBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main role="alert"><h1>This view could not be displayed safely</h1><p>No automatic financial action was taken. Reload and check your records before retrying a save.</p><button onClick={() => location.reload()}>Reload</button></main> : this.props.children;
  }
}
