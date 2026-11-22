import React, {Component} from "react";

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {hasError: false};
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return {hasError: true};
    }

    componentDidCatch(error, errorInfo) {
        // You can log errorInfo to an error reporting service here.
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // You can customize this fallback UI to be more specific
            return (
                <div style={{textAlign: "center", padding: "20px"}}>
                    <h1>Something went wrong.</h1>
                    <p>The application encountered an error and has stopped working.</p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
