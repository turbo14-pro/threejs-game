import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import { Billboard, Text } from '@react-three/drei';
import PlayerModel from './PlayerModel.jsx';
import { useGameStore } from '../../store/useGameStore';
import {
  BotBrain,
  shouldRegisterTag,
  TAG_COOLDOWN,
  BOT_COMBAT,
  botSpawnPosition,
  randomBotName,
  randomTableRespawn,
  selectTarget,
  getBotPowerUpCombatBoost,
  resolveImpact,
} from './BotAI.jsx';
import { registerBot, unregisterBot, getBotCandidates, damageBot, applyBotKnockback, getBotVelocity } from './botRegistry.js';
import { getLocalPlayerWorldPos, getLocalPlayerWorldVel, getActivePowerUps } from '../World/items/PowerUpCoin.jsx';
import { BOT_DIFFICULTY } from './BotAI.jsx';
import { SKINS } from '../../data/registries';
import { POWERUP_DURATIONS, POWERUP_EFFECTS } from '../../config/playerConfig';

/**
 * THE BOT PLAYER
 * Renders a CPU opponent and drives it from the BotAI brain.
 *
 * Movement is kinematic (like RemotePlayer) rather than a full Rapier character
 * controller, because the human's PlayerController is a singleton bound to the camera,
 * pointer-lock and local-player store state — a second instance would fight over all three.
 * The brain still produces the exact `mobileInput` shape PlayerController consumes, so the
 * same decision logic can be handed to a real controller later if that is ever refactored.
 *
 * COMBAT: bots slide-lunge any living candidate — the human AND the other bots
 * (candidates via botRegistry + getLocalPlayerWorldPos; selection is the brain's
 * `selectTarget` scoring). Landing a slide deals BOT_COMBAT.hitDamage and knocks the
 * victim back (store knockback for the human, kinematic push for other bots).
 */

// Matches the arena's gravity in GameCanvas.jsx (<Physics gravity={[0, -90.81, 0]}>)
const BOT_GRAVITY = 90.81;
// Matches PlayerController's single-jump impulse
const BOT_JUMP_SPEED = 38;
// Cruising speeds (units/sec) between PlayerController's walk (8) and sprint (30)
const BOT_SPRINT_SPEED = 22;
const BOT_WALK_SPEED = 11;
// Clamp delta so a stalled tab cannot teleport a bot across the arena
const MAX_STEP = 0.05;
// The arena's ground/platform collision group, as used by PlayerController's ground probe
const GROUND_FILTER = 0x00010001;
// CapsuleCollider args are [halfHeight, radius] = [1.5, 1], so the body centre sits this
// far above the feet. Ground "sticks" must land at groundY + this offset — landing at
// groundY itself is what used to sink bots half-way into the floor.
const BODY_OFFSET_Y = 2.5;
    // Snap down to a surface within this distance instead of floating above it
const MAX_STICK_DOWN = 0.6;
// The ground probe casts a Ball; its contact point is BALL_RADIUS above the true surface
const GROUND_BALL_RADIUS = 0.5;
// Horizontal wall-cast tuning: skip contacts within this gap (lets a bot slide along
// a wall it's already touching instead of sticking) and stop this far short of a
// surface it runs head-on into.
const WALL_CAST_GAP = 0.12;
const WALL_STOP_SKIN = 0.06;
// Safety net only — the arena table's surface is y≈0 (Arena.jsx: RigidBody [0,-1,0] + 600x2x600)
const RESPAWN_FLOOR_Y = -80;
// Below this the bot has dropped off the arena table — it falls freely past it,
// then respawns at a fresh random point on the table (never eliminated-hovering).
const ELIMINATION_FLOOR_Y = -6;
// Ignore vertical differences larger than this when picking a target (lobby unreachable)
const MAX_TARGET_HEIGHT_DIFF = 6;

export default function BotPlayer({ bot }) {
    const bodyRef = useRef();
  const modelRef = useRef();
  const { world, rapier } = useRapier();
  // Last frame time, published in the useFrame loop so async callbacks (e.g.
  // applyKnockback, invoked from the shared bot registry) can arm a knockback
  // window without their own clock.
  const nowRef = useRef(0);

  // Each bot owns its own brain: independent boot-up delay, personality and animation
  const brainRef = useRef(null);
  if (brainRef.current === null) {
    brainRef.current = new BotBrain({
      difficulty: bot.difficulty,
      name: bot.name,
      seed: bot.id, // per-bot decision variables (aggression, patience, caution, ...)
    });
  }

  const spawn = useMemo(() => botSpawnPosition(bot.spawnIndex ?? 0), [bot.spawnIndex]);
  // Give each bot a different skin from the master registry so they are easy to tell apart
  const skin = SKINS[(bot.spawnIndex ?? 0) % SKINS.length].id;
  // Floating name tag: starts as the roster name, re-rolled to a fresh random
  // name from the pool on every respawn (see DOWNED below).
  const [tagName, setTagName] = useState(bot.name);

  const stateRef = useRef({
    pos: new THREE.Vector3(spawn.x, spawn.y, spawn.z),
    vy: 0,
    yaw: Math.PI,
    grounded: true,
    health: BOT_COMBAT.maxHealth,
    downUntil: 0,
    lastHitAt: -Infinity,
    lastTagAt: -Infinity,
    slideArmedUntil: 0,
            knockVec: new THREE.Vector3(),
    knockUntil: 0, // end-time of the current knockback window (steering locked during)
    fellOff: false, // latched while falling off the table — cleared on respawn
    powerUp: null, // { category, rarity } the bot is currently holding
    powerUpUntil: 0, // clock time the current power-up expires
    vel: new THREE.Vector3(), // horizontal velocity (units/sec), for Newtonian impact
    lastDebug: null,
  });

  const [anim, setAnim] = useState({ mv: false, dir: 'for', spr: false, jp: 'none', sl: false });

  const groundShape = useMemo(() => (rapier ? new rapier.Ball(0.5) : null), [rapier]);
  // Horizontal probe matching the capsule's radius (1.0), used to stop the kinematic
  // bot at fixed geometry (cereal boxes, arena walls) the solver would otherwise let
  // it phase through. A kinematic body is only pushed by dynamic bodies, not stopped
  // by fixed ones — hence this manual sweep. The probe radius equals the collider
  // radius, so the sweep's time-of-impact is exactly how far the body centre may travel.
  const wallShape = useMemo(() => (rapier ? new rapier.Ball(1.0) : null), [rapier]);
  const addMatchScore = useGameStore(s => s.addMatchScore);

  // Publish this bot so other bots can target it and deal damage to it
  useEffect(() => {
    registerBot(bot.id, {
      getPosition: () => ({
        x: stateRef.current.pos.x,
        y: stateRef.current.pos.y,
        z: stateRef.current.pos.z,
      }),
      // Horizontal velocity so other bodies can run a Newtonian impact resolution
      // (who's driving into whom) against this bot.
      getVelocity: () => ({ x: stateRef.current.vel.x, z: stateRef.current.vel.z }),
      get health() { return stateRef.current.health; },
      takeDamage: (amount) => {
        const s = stateRef.current;
        if (s.health <= 0) return;
        s.health = Math.max(0, s.health - amount);
      },
            // Kinematic launch: the bot is pushed horizontally at `force`-scaled velocity and
      // given a vertical pop so it actually arcs — `applyImpulse` would do nothing on a
      // kinematic body, and a tiny pop gets immediately re-snapped by the ground probe.
            applyKnockback: (dir, force) => {
        const s = stateRef.current;
        const now = nowRef.current;
        // Clamp horizontal velocity so a single hit can't rocket a bot across the map,
        // while still being strong enough to read as a launch.
        const strength = Math.min(Math.max(force, 40), 110);
        s.knockVec.set(dir.x * strength, 0, dir.z * strength);
        s.vy = Math.max(s.vy, 28); // visibly launched, then gravity takes over
        s.knockUntil = now + BOT_COMBAT.knockbackDuration;
        s.grounded = false;
      },
      // Power-up pickup: mirror the player's single-slot powerUp with an expiry so
      // the buff auto-clears. `speed` boosts movement; `slide` boosts the lunge
      // speed and hit knockback (see getBotPowerUpCombatBoost in useFrame). The
      // remaining categories (jump/dash) are held but inert for bots.
      collectPowerUp: (category, rarity) => {
        const s = stateRef.current;
        const now = nowRef.current;
        s.powerUp = { category, rarity };
        s.powerUpUntil = now + (POWERUP_DURATIONS[rarity] ?? POWERUP_DURATIONS.bronze) * 1000;
      },
    });
    return () => unregisterBot(bot.id);
  }, [bot.id]);

  useFrame((frameState, delta) => {
    if (!bodyRef.current) return;

    const s = stateRef.current;
    const brain = brainRef.current;
        const step = Math.min(delta, MAX_STEP);
    const now = frameState.clock.elapsedTime;
    nowRef.current = now;
    const store = useGameStore.getState();

    // --- POWER-UP EXPIRY: clear the buff when its duration runs out ---
    if (s.powerUp && now >= s.powerUpUntil) {
      s.powerUp = null;
      s.powerUpUntil = 0;
    }

    // --- DOWNED: respawn at a fresh random table spot after the delay ---
    // (Falling off the table also routes through here — see FELL OFF below.)
    if (s.health <= 0) {
      if (s.downUntil <= 0) s.downUntil = now + BOT_COMBAT.respawnDelay;
      if (now < s.downUntil) {
        // Hide the body far under the arena while downed (occluded by the
        // table from above; the blob shadow hides itself below y=-1).
        bodyRef.current.setNextKinematicTranslation({ x: s.pos.x, y: -60, z: s.pos.z });
        return;
      }
      const spot = randomTableRespawn();
      s.pos.set(spot.x, spot.y, spot.z);
      s.vy = 0;
      s.knockVec.set(0, 0, 0);
      s.knockUntil = 0;
      s.health = BOT_COMBAT.maxHealth;
      s.downUntil = 0;
      s.fellOff = false;
      s.grounded = true;
      s.powerUp = null; // buffs don't survive a respawn
      s.powerUpUntil = 0;
      // Fresh random name tag every respawn — try to avoid repeating the old one
      setTagName((prev) => {
        let next = randomBotName();
        for (let retry = 0; retry < 5 && next === prev; retry++) next = randomBotName();
        return next;
      });
    }

    // --- TARGET SELECTION: the human + every other living bot, scored by the brain ---
    const candidates = getBotCandidates(bot.id);
    const playerPos = getLocalPlayerWorldPos();
    const playerHealth = store.player?.health;
    const playerIsReachable = playerPos
      && Number.isFinite(playerPos.x)
      && Math.abs((playerPos.y ?? 0) - s.pos.y) <= MAX_TARGET_HEIGHT_DIFF;
        if (playerIsReachable && !(Number.isFinite(playerHealth) && playerHealth <= 0)) {
      candidates.push({
        id: 'player',
        kind: 'player',
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z,
        health: Number.isFinite(playerHealth) ? playerHealth : BOT_COMBAT.maxHealth,
      });
    }
    // On normal-or-above, also feed live powerup tokens into the candidate set so bots
    // seek them out as a secondary primary aim (selectTarget prefers a nearby token).
    const seekPowerups = bot.difficulty >= BOT_DIFFICULTY.normal;
    if (seekPowerups) {
      for (const p of getActivePowerUps()) {
        if (p && Number.isFinite(p.x)) candidates.push({ id: `powerup-${p.x.toFixed(0)}-${p.z.toFixed(0)}`, kind: 'powerup', x: p.x, y: p.y, z: p.z });
      }
    }
    const target = selectTarget(
      s.pos,
      candidates,
      brain.personality,
      seekPowerups ? { seekPowerups: true } : {},
    );

    const input = brain.update(step, {
      bot: { x: s.pos.x, y: s.pos.y, z: s.pos.z, rotationY: s.yaw },
      target,
      targetScore: store.matchScore.player,
      botScore: store.matchScore.bots,
      healthRatio: s.health / BOT_COMBAT.maxHealth,
    });
    const debug = brain.lastDebug;
    const distance = debug?.distance ?? null;

    // --- GROUND PROBE: same castShape as before, but the stick now lands the body
    // centre on groundY + BODY_OFFSET_Y so the FEET rest on the surface ---
    let groundY = null;
    if (groundShape) {
      const hit = world.castShape(
        s.pos,
        { w: 1, x: 0, y: 0, z: 0 },
        { x: 0, y: -1, z: 0 },
        groundShape,
        0.0,
        3.0,
        true,
        null,
        GROUND_FILTER,
        null,
        bodyRef.current
      );
      if (hit) {
        // hit.time_of_impact is where the BALL CENTRE stops; the true surface is
        // ballRadius below that (the ball touches the floor bottom-first).
        const toi = hit.toi ?? hit.time_of_impact;
        if (typeof toi === 'number' && Number.isFinite(toi)) {
          groundY = s.pos.y - toi - GROUND_BALL_RADIUS;
        }
      }
      const feetAboveGround = s.pos.y - BODY_OFFSET_Y - groundY;
      s.grounded = groundY !== null && feetAboveGround >= -0.1 && feetAboveGround <= MAX_STICK_DOWN;
    }

    // --- VERTICAL ---
    const canJump = input.jump && s.grounded && s.vy <= 0;
    if (canJump) {
      s.vy = BOT_JUMP_SPEED;
      s.grounded = false;
      s.pos.y += s.vy * step;
    } else if (groundY !== null && s.vy <= 0 && (s.pos.y - BODY_OFFSET_Y - groundY) <= MAX_STICK_DOWN) {
      s.pos.y = groundY + BODY_OFFSET_Y;
      s.vy = 0;
      s.grounded = true;
    } else {
      s.vy -= BOT_GRAVITY * step;
      s.pos.y += s.vy * step;
      s.grounded = false;
    }
    if (s.pos.y < RESPAWN_FLOOR_Y) {
      s.pos.set(spawn.x, spawn.y, spawn.z);
      s.vy = 0;
      s.grounded = true;
    }

        // --- FELL OFF: the bot walked off the table edge — let it fall, then route
    // it through the DOWNED respawn so it pops back at a fresh random table
    // spot after the delay. Latch fellOff so the trigger fires once per fall.
    if (!s.fellOff && s.pos.y < ELIMINATION_FLOOR_Y) {
      s.fellOff = true;
      s.health = 0; // DOWNED block above handles the delay + random respawn
      s.downUntil = 0;
      s.knockVec.set(0, 0, 0);
      s.vy = Math.min(s.vy, 0);
      console.log("💀 Bot fell off the arena — respawning:", bot.name);
    }

    // --- KNOCKBACK: decaying displacement from the last slide hit received ---
    if (s.knockVec.lengthSq() > 0.01) {
      s.pos.addScaledVector(s.knockVec, step);
      s.knockVec.multiplyScalar(Math.max(0, 1 - step / BOT_COMBAT.knockbackDuration));
    } else if (s.knockVec.lengthSq() > 0) {
      s.knockVec.set(0, 0, 0);
    }

        // --- HORIZONTAL: walk/sprint cruise, biased up during a slide lunge ---
    // During a knockback launch window the bot is airborne and coasts on its
    // knockVec alone — zero the self-steering so the launch actually carries.
    const inKnockback = now < s.knockUntil;
    const steerX = inKnockback ? 0 : input.x;
    const steerZ = inKnockback ? 0 : input.y;
    // Speed power-up multiplies movement speed (matches the player's speed buff)
    const powerUpActive = s.powerUp && now < s.powerUpUntil;
    const speedMult = powerUpActive && s.powerUp.category === 'speed'
      ? (POWERUP_EFFECTS.speed?.[s.powerUp.rarity]?.speedMultiplier ?? 1)
      : 1;
    // Slide power-up boosts the lunge speed and the knockback the bot deals —
    // computed once per frame and reused by the slide-attack block below.
    const combatBoost = getBotPowerUpCombatBoost(powerUpActive ? s.powerUp : null);
    const baseSpeed = (input.sprint ? BOT_SPRINT_SPEED : BOT_WALK_SPEED) * speedMult;
    const slideBias = input.slide ? combatBoost.slideSpeedBias : 1;
    const moveX = steerX * baseSpeed * slideBias * step;
    const moveZ = steerZ * baseSpeed * slideBias * step;
    const moveLen = Math.hypot(moveX, moveZ);

    // Kinematic bodies are pushed BY dynamic bodies but are NOT stopped BY fixed ones,
    // so without this sweep the bot phases straight through the (fixed) cereal boxes
    // while the (dynamic) cans/player still shove it. Cast the capsule probe along the
    // intended move against FIXED geometry only; stop at contact and slide along it.
    let appliedMove = false;
    if (moveLen > 1e-4 && wallShape) {
      const dirX = moveX / moveLen;
      const dirZ = moveZ / moveLen;
      // EXCLUDE_DYNAMIC | EXCLUDE_KINEMATIC -> only fixed bodies (boxes, arena walls)
      const flags = rapier.QueryFilterFlags
        ? (rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_KINEMATIC)
        : 6;
      const hit = world.castShape(
        s.pos,
        { w: 1, x: 0, y: 0, z: 0 },
        { x: dirX, y: 0, z: dirZ },
        wallShape,
        WALL_CAST_GAP,      // ignore walls we're already touching (lets us slide off them)
        moveLen + 2.0,      // reach the full step plus the probe radius
        false,              // only hits the sweep actually reaches
        flags,
        GROUND_FILTER,
        null,
        bodyRef.current
      );
      if (hit) {
        const toi = hit.toi ?? hit.time_of_impact;
        if (typeof toi === 'number' && Number.isFinite(toi) && toi < moveLen) {
          // Probe ball radius (1.0) equals the capsule radius, so `toi` is exactly how
          // far the body centre may travel before touching. Stop just short of it...
          const allowed = Math.max(0, toi - WALL_STOP_SKIN);
          let advX = dirX * allowed;
          let advZ = dirZ * allowed;
          // ...then convert the leftover into a slide along the wall tangent so the
          // bot glides around boxes instead of sticking to them. The tangent is
          // independent of the hit-normal's orientation.
          const n = hit.normal1;
          if (n && Number.isFinite(n.x) && Number.isFinite(n.z) && (n.x * n.x + n.z * n.z) > 1e-4) {
            const nLen = Math.hypot(n.x, n.z);
            const nx = n.x / nLen;
            const nz = n.z / nLen;
            const dn = dirX * nx + dirZ * nz;
            let tx = dirX - nx * dn;
            let tz = dirZ - nz * dn;
            const tLen = Math.hypot(tx, tz);
            if (tLen > 1e-4) {
              const remain = moveLen - allowed;
              advX += (tx / tLen) * remain;
              advZ += (tz / tLen) * remain;
            }
          }
          s.pos.x += advX;
          s.pos.z += advZ;
          appliedMove = true;
        }
      }
    }
    if (!appliedMove) {
      s.pos.x += moveX;
      s.pos.z += moveZ;
    }

    // --- VELOCITY: track this frame's horizontal displacement as a velocity so a
    // Newtonian impact (below) can tell who's driving into whom. Knockback coast
    // counts too — a launched bot is moving fast even with no steering input. ---
    if (step > 1e-5) {
      s.vel.set(
        (moveX + s.knockVec.x * step) / step,
        0,
        (moveZ + s.knockVec.z * step) / step,
      );
    }

    // --- SLIDE ATTACK: the lunge stays armed for slideLinger after the slide input
    // drops (at lunge speed the strike window is shorter than a single frame), and
    // the impact applies to BOTH bots and the human player ---
    s.slideArmedUntil = input.slide ? now + BOT_COMBAT.slideLinger : s.slideArmedUntil || 0;
    const lunging = now < s.slideArmedUntil;
    const canHit = lunging
      && target
      && distance !== null
      && distance <= BOT_COMBAT.hitRange
      && (now - s.lastHitAt) >= BOT_COMBAT.hitCooldown;
    if (canHit) {
      s.lastHitAt = now;
      s.slideArmedUntil = 0; // one hit per lunge

      // --- NEWTONIAN RESOLUTION: only the body driving into the other deals the
      // knockback. Consider position (contact normal), each body's direction and
      // speed. If the TARGET is the aggressor (e.g. the player slid into us), the
      // bot must NOT knock them back — the player's own collision handler owns
      // that impact. This is the fix for "player slides into a sliding bot and
      // still gets launched". ---
      const targetVel = target.kind === 'player'
        ? getLocalPlayerWorldVel()
        : (getBotVelocity(target.id) || { x: 0, z: 0 });
      const impact = resolveImpact(
        { x: s.pos.x, z: s.pos.z, vx: s.vel.x, vz: s.vel.z },
        { x: target.x, z: target.z, vx: targetVel.x, vz: targetVel.z },
      );
      const botIsAggressor = impact.aggressor === 'a';

      if (botIsAggressor) {
        // Push the victim away from us along the contact normal; scale by closing speed.
        const dir = { x: impact.knockDir.x, y: 0, z: impact.knockDir.z };
        const force = combatBoost.knockbackForce * (0.5 + 0.5 * impact.impact);
        if (target.kind === 'player') {
          store.triggerKnockback({ x: dir.x, y: 0, z: dir.z }, force);
          store.damagePlayer(BOT_COMBAT.hitDamage);
        } else {
          damageBot(target.id, BOT_COMBAT.hitDamage);
          applyBotKnockback(target.id, dir, force);
        }
        // --- BOT ATTACK REPORT: who tackled whom, for how much, at what range ---
        const victim = target.kind === 'player' ? 'PLAYER' : `bot:${target.id}`;
        const boosted = combatBoost.knockbackForce > BOT_COMBAT.knockbackForce;
        console.log(
          `🗡️  [BOT ATTACK] ${bot.name} slide-tackled ${victim} ` +
          `for ${BOT_COMBAT.hitDamage} dmg @ ${distance.toFixed(1)}m ` +
          `(closing ${impact.closingSpeed.toFixed(1)} m/s, knockback ${Math.round(force)}${boosted ? ', slide-boosted' : ''})`
        );
      } else {
        // We're the victim of this collision — the aggressor's own system applies
        // our knockback, so we deliberately do nothing here (avoids double-hit).
        console.log(
          `🛡️  [BOT] ${bot.name} was driven into by ${target.kind === 'player' ? 'PLAYER' : `bot:${target.id}`} ` +
          `@ ${distance.toFixed(1)}m — deferring knockback to the aggressor`
        );
      }
    }

    // --- TAG SCORING: drives the bots' side of the adaptive difficulty ---
    if (shouldRegisterTag({ distance, lastTagAt: s.lastTagAt, now, cooldown: TAG_COOLDOWN })) {
      s.lastTagAt = now;
      addMatchScore('bots', 1);
    }

    // --- FACING: smooth toward the travel direction ---
    if (debug && Number.isFinite(debug.targetRotationY)) {
      s.yaw = THREE.MathUtils.damp(s.yaw, debug.targetRotationY, 8, step);
    }
    if (modelRef.current) modelRef.current.rotation.y = s.yaw;

    // --- APPLY: kinematic body follows the integrated position ---
    bodyRef.current.setNextKinematicTranslation(s.pos);

    // --- ANIMATION: only re-render on an actual change, not every frame ---
    const next = brain.getAnimationState(input, s.grounded);
    setAnim(prev => (
      prev.mv === next.mv && prev.dir === next.dir && prev.spr === next.spr && prev.jp === next.jp && prev.sl === next.sl
        ? prev
        : next
    ));
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      collisionGroups={0x0002FFFF}
      position={[spawn.x, spawn.y, spawn.z]}
      userData={{ type: 'bot-player', id: bot.id, name: bot.name, isBot: true }}
    >
      <CapsuleCollider args={[1.5, 1]} />

      {/* Floating name tag — billboarded so it always faces the camera */}
      <Billboard position={[0, BODY_OFFSET_Y + 3.4, 0]}>
        <Text
          fontSize={1.1}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.08}
          outlineColor="#000000"
        >
          {tagName}
        </Text>
      </Billboard>

      <group ref={modelRef} position={[0, -BODY_OFFSET_Y, 0]}>
        <PlayerModel
          isMoving={anim.mv}
          moveDir={anim.dir}
          isSprinting={anim.spr}
          jumpPhase={anim.jp}
          isSliding={anim.sl}
          skinOverride={skin}
        />
      </group>
    </RigidBody>
  );
}
