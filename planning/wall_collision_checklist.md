# Wall Collision Checklist

> To verify step 1.2.1, please walk your character into these 10 distinct spots in the current area to test if the physics collider allows the player to clip through geometry.

1. [ ] **North-East corner of the main table** — wedge yourself tightly into the corner and try to jump while sprinting.
2. [ ] **Under the Start Match Teleport Pad** (if there's space) — check if jumping into the underside causes clipping.
3. [ ] **Against the Cereal Box front doorway** — rub against the sides of the opening, checking if the composite collider geometry leaks.
4. [ ] **Inside the Cereal Box** — push into the back internal corners.
5. [ ] **Behind the Toaster** (if present) — push the character into the gap between the toaster and the invisible edge.
6. [ ] **Falling off the table edge** — ensure you fall cleanly downwards without getting 'stuck' jittering on the vertical face.
7. [ ] **Against another player/character** (if running two instances, or swap character on pad and push into it) — check capsule-on-capsule sliding.
8. [ ] **Wall sliding** — sprint forwards slightly diagonally into a flat wall. The character should slide smoothly along it instead of getting stuck.
9. [ ] **Reverse wall test** — back up explicitly into a wall while facing away, jump backward.
10. [ ] **Drop-down collision** — jump from the highest available point directly onto the corner of a cereal box or table edge.

If you pass through or get stuck in any of these, let me know which number failed and we will adjust the `PlayerController` physics parameters!
