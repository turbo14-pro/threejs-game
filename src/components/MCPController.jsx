import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function MCPController() {
  const { scene } = useThree();
  const wsRef = useRef([]);

  useEffect(() => {
    // Only run in development
    if (!import.meta.env.DEV) return;

    const sockets = [];
    wsRef.current = sockets;

    const sendSceneState = () => {
      // Create a simplified map of the scene
      const data = scene.children
        .filter(child => child.type === 'Mesh' || child.type === 'Group')
        .map(child => ({
          id: child.uuid,
          name: child.name || 'Unnamed',
          type: child.type,
          position: child.position.toArray()
        }));

      const message = JSON.stringify({ data });
      sockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    };

    // Attempt to connect to a range of ports
    for (let port = 8082; port <= 8092; port++) {
      try {
        const ws = new WebSocket(`ws://localhost:${port}`);
        
        ws.onopen = () => {
          console.log(`[MCP] Connected to three-js-mcp Editor server on port ${port}`);
          sockets.push(ws);
          sendSceneState();
        };

        ws.onmessage = (event) => {
          try {
            const cmd = JSON.parse(event.data);
            console.log(`[MCP:${port}] Received Command:`, cmd);
            
            switch (cmd.action) {
              case 'addObject':
                // Example basic implementation
                const geo = new THREE.BoxGeometry();
                const mat = new THREE.MeshBasicMaterial({ color: cmd.color || 0xff0000 });
                const mesh = new THREE.Mesh(geo, mat);
                if (cmd.position) mesh.position.fromArray(cmd.position);
                scene.add(mesh);
                sendSceneState();
                break;
                
              case 'moveObject':
                const objToMove = scene.getObjectByProperty('uuid', cmd.id);
                if (objToMove && cmd.position) {
                  objToMove.position.fromArray(cmd.position);
                  sendSceneState();
                }
                break;

              case 'removeObject':
                const objToRemove = scene.getObjectByProperty('uuid', cmd.id);
                if (objToRemove) {
                  scene.remove(objToRemove);
                  sendSceneState();
                }
                break;
                
              // Add other actions like startRotation here if needed
            }
          } catch (err) {
            console.error(`[MCP:${port}] Message Error:`, err);
          }
        };

        ws.onclose = () => {
          const idx = sockets.indexOf(ws);
          if (idx !== -1) sockets.splice(idx, 1);
        };
      } catch (e) {
        // ignore setup errors
      }
    }

    return () => {
      sockets.forEach(ws => ws.close());
      sockets.length = 0;
    };
  }, [scene]);

  // Component renders nothing visible
  return null;
}
