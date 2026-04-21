import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function MCPController() {
  const { scene } = useThree();
  const wsRef = useRef(null);

  useEffect(() => {
    // Only run in development
    if (!import.meta.env.DEV) return;

    const ws = new WebSocket('ws://localhost:8082');
    wsRef.current = ws;

    const sendSceneState = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      
      // Create a simplified map of the scene
      const data = scene.children
        .filter(child => child.type === 'Mesh' || child.type === 'Group')
        .map(child => ({
          id: child.uuid,
          name: child.name || 'Unnamed',
          type: child.type,
          position: child.position.toArray()
        }));

      ws.send(JSON.stringify({ data }));
    };

    ws.onopen = () => {
      console.log("[MCP] Connected to three-js-mcp Editor server");
      sendSceneState();
    };

    ws.onmessage = (event) => {
      try {
        const cmd = JSON.parse(event.data);
        console.log("[MCP] Received Command:", cmd);
        
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
        console.error("[MCP] Message Error:", err);
      }
    };

    ws.onclose = () => {
      console.log("[MCP] Disconnected from server");
    };

    return () => {
      ws.close();
    };
  }, [scene]);

  // Component renders nothing visible
  return null;
}
