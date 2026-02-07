import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

type ErrorBoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    try {
      const payload = {
        message: error.message,
        stack: error.stack,
        time: new Date().toISOString(),
      };
      localStorage.setItem("halaldl:lastError", JSON.stringify(payload));
    } catch {
      void 0;
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen w-full bg-background text-foreground flex items-center justify-center p-8">
          <div className="max-w-xl w-full space-y-4 rounded-xl border border-muted/40 bg-muted/20 p-6">
            <div className="text-lg font-semibold">HalalDL failed to start</div>
            <div className="text-sm text-muted-foreground break-words">
              {this.state.error.message}
            </div>
            <div className="flex gap-2">
              <button
                className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <button
                className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
                onClick={() => {
                  try {
                    const payload = localStorage.getItem("halaldl:lastError");
                    if (payload) navigator.clipboard.writeText(payload);
                  } catch {
                    void 0;
                  }
                }}
              >
                Copy Error
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
