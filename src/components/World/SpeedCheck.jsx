import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import Stats from 'stats.js';
import { Logger } from '../../utils/Logger';

/**
 * SpeedCheck — Development-only FPS counter and speed reporter.
 * 
 * Shows a small FPS/MS panel in the top-left corner.
 * Logs a one-time speed report (draw calls, triangles, memory)
 * after the scene has had 120 frames to settle in.
 * 
 * Only renders in development mode.
 */
export default function SpeedCheck() {
  const { gl } = useThree();
  const statsRef = useRef(null);
  const frameCount = useRef(0);
  const reportDone = useRef(false);

  useEffect(() => {
    // Create the stats.js panel
    const stats = new Stats();
    stats.showPanel(0); // 0 = FPS, 1 = MS, 2 = Memory
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '0px';
    stats.dom.style.left = '0px';
    stats.dom.style.zIndex = '9999';
    document.body.appendChild(stats.dom);
    statsRef.current = stats;

    // Enable info tracking so we can read draw calls
    gl.info.autoReset = false;

    return () => {
      if (stats.dom.parentNode) {
        stats.dom.parentNode.removeChild(stats.dom);
      }
    };
  }, [gl]);

  useFrame(() => {
    const stats = statsRef.current;
    if (stats) {
      stats.update();
    }

    frameCount.current++;

    // After 120 frames, run the one-time speed report
    if (!reportDone.current && frameCount.current >= 120) {
      reportDone.current = true;
      Logger.perfReport(gl);
      // Reset info counters after reporting
      gl.info.reset();
    }

    // Reset renderer info each frame so counts stay per-frame
    if (reportDone.current) {
      gl.info.reset();
    }
  });

  return null;
}
