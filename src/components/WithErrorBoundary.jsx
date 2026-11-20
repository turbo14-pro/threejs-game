import React from 'react';
import GameCanvas from './GameCanvas.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

export default function WithErrorBoundary({sendUpdate}) {
    return (
        <ErrorBoundary>
            <GameCanvas sendUpdate={sendUpdate} />
        </ErrorBoundary>
    );
}