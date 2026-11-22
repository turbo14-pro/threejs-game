import React from "react";
import ErrorBoundary from "./ErrorBoundary.jsx";

export default function TestErrorBoundary() {
    // This will trigger the error boundary
    throw new Error("Test error");

    return <div>This won\'t render</div>;
}
