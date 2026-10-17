import { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{
    children: ReactNode;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? <main className="error-view"><h1>Let’s reconnect your workspace.</h1><p>An unexpected interface error occurred. Your saved demo records are retained.</p><button className="btn primary" onClick={() => window.location.reload()}>Reload portal</button></main> : this.props.children; }
}
