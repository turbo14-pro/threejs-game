import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';

/**
 * NETWORK STATUS COMPONENT
 * Displays a sleek notification in the top-right corner based on multiplayer connection.
 */
export default function NetworkStatus() {
  const status = useGameStore(state => state.game.networkStatus);
  const [isVisible, setIsVisible] = useState(false);

  // Configuration for different statuses
  const config = {
    CONNECTING: { label: 'Searching for Server...', color: '#ffcc00', icon: '📡' },
    ONLINE: { label: 'Multiplayer Online', color: '#00ff88', icon: '✅' },
    ERROR: { label: 'Connection Failed', color: '#ff4444', icon: '⚠️' },
    OFFLINE: { label: 'Offline Mode', color: '#ffffff', icon: '🏠' }
  };

  const current = config[status] || config.OFFLINE;

  useEffect(() => {
    // Always show if we are connecting or have an error
    if (status === 'CONNECTING' || status === 'ERROR') {
      setIsVisible(true);
    } 
    // If we just went online, show for 4 seconds then hide
    else if (status === 'ONLINE') {
      setIsVisible(true);
      const timer = setTimeout(() => setIsVisible(false), 4000);
      return () => clearTimeout(timer);
    } 
    // Otherwise hide
    else {
      setIsVisible(false);
    }
  }, [status]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            border: `1px solid ${current.color}44`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            color: 'white',
            fontFamily: '"Outfit", sans-serif',
            fontSize: '14px',
            fontWeight: '600',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '18px' }}>{current.icon}</span>
          <span>{current.label}</span>
          
          {/* Subtle glow effect */}
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: current.color,
            boxShadow: `0 0 10px ${current.color}`
          }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
