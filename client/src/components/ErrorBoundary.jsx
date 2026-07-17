import React, { Component } from 'react';
import styles from './ErrorBoundary.module.css';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught unexpected UI exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container} role="alert">
          <div className={styles.card}>
            <span className={styles.icon}>⚠️</span>
            <h1 className={styles.title}>An unexpected error occurred</h1>
            <p className={styles.message}>
              We apologize for the inconvenience. The application crashed during rendering.
            </p>
            <button onClick={this.handleReset} className={styles.retryBtn}>
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
