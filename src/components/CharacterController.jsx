import { Billboard, CameraControls, Text } from "@react-three/drei";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, vec3 } from "@react-three/rapier";
import { isHost, myPlayer } from "playroomkit";
import { useEffect, useRef, useState } from "react";
import { TextureLoader } from "three";
import { CharacterSoldier } from "./CharacterSoldier";
import React from "react";

export const WEAPON_OFFSET = {
  x: -0.2,
  y: 1.4,
  z: 0.8,
};

export const CharacterController = ({
  state,
  joystick,
  userPlayer,
  onKilled,
  onFire,
  onQuit,
  downgradedPerformance,
  FIRE_RATE,
  MOVEMENT_SPEED,
  ...props
}) => {
  const group = useRef();
  const quitHandled = useRef(false);
  const character = useRef();
  const rigidbody = useRef();
  const [animation, setAnimation] = useState("Idle");
  const [spacePressed, setSpacePressed] = useState(false);
  const [keysPressed, setKeysPressed] = useState(new Set());
  const [weapon, setWeapon] = useState(
    state?.state?.profile2?.weapon || "Pistol"
  );
  const lastShoot = useRef(0);
  const scene = useThree((state) => state.scene);
  const controls = useRef();
  const directionalLight = useRef();

  const spawnRandomly = () => {
    const spawns = [];
    for (let i = 0; i < 1000; i++) {
      const spawn = scene.getObjectByName(`spawn_${i}`);
      if (spawn) {
        spawns.push(spawn);
      } else {
        break;
      }
    }
    const spawnPos = spawns[Math.floor(Math.random() * spawns.length)].position;
    rigidbody.current.setTranslation(spawnPos);
  };

  useEffect(() => {
    if (isHost()) {
      spawnRandomly();
    }
  }, []);

  useEffect(() => {
    if (state.state.dead) {
      const audio = new Audio("/audios/dead.mp3");
      audio.volume = 0.5;
      audio.play();
    }
  }, [state.state.dead]);

  useEffect(() => {
    if (state.state.health < 100) {
      const audio = new Audio("/audios/hurt.mp3");
      audio.volume = 0.4;
      audio.play();
    }
  }, [state.state.health]);

  useEffect(() => {
    if (character.current && userPlayer) {
      directionalLight.current.target = character.current;
    }
  }, [character.current]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.code;
      if (key === "Space") {
        e.preventDefault(); // ✨ This stops the page from scrolling
        setSpacePressed(true);
      }
    
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(key)) {
        setKeysPressed((prev) => new Set(prev).add(key));
      }
    };
    

    const handleKeyUp = (e) => {
      const key = e.code;
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(key)) {
        setKeysPressed((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
      if (key === "Space") setSpacePressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    // CAMERA FOLLOW
    if (controls.current) {
      const cameraDistanceY = window.innerWidth < 1024 ? 16 : 20;
      const cameraDistanceZ = window.innerWidth < 1024 ? 12 : 16;
      const playerWorldPos = vec3(rigidbody.current.translation());
      controls.current.setLookAt(
        playerWorldPos.x,
        playerWorldPos.y + (state.state.dead ? 12 : cameraDistanceY),
        playerWorldPos.z + (state.state.dead ? 2 : cameraDistanceZ),
        playerWorldPos.x,
        playerWorldPos.y + 1.5,
        playerWorldPos.z,
        true
      );
    }

    if (state.state.dead) {
      setAnimation("Death");
      return;
    }

    const angle = joystick.angle();
    let moving = false;
    let movementAngle = angle;

    if (joystick.isJoystickPressed() && angle) {
      moving = true;
    } else if (keysPressed.size > 0) {
      moving = true;
      const direction = { x: 0, z: 0 };

      if (keysPressed.has("KeyW")) direction.z -= 1;
      if (keysPressed.has("KeyS")) direction.z += 1;
      if (keysPressed.has("KeyA")) direction.x -= 1;
      if (keysPressed.has("KeyD")) direction.x += 1;

      if (direction.x !== 0 || direction.z !== 0) {
        movementAngle = Math.atan2(direction.x, direction.z);
      }
    }

    if (moving && movementAngle != null) {
      setAnimation(
        spacePressed || joystick.isPressed("fire") ? "Run_Shoot" : "Run"
      );
      character.current.rotation.y = movementAngle;

      const impulse = {
        x: Math.sin(movementAngle) * MOVEMENT_SPEED * delta,
        y: 0,
        z: Math.cos(movementAngle) * MOVEMENT_SPEED * delta,
      };
      rigidbody.current.applyImpulse(impulse, true);
    } else {
      if (spacePressed || joystick.isPressed("fire")) {
        setAnimation("Idle_Shoot");
      } else {
        setAnimation("Idle");
      }
    }

    if (joystick.isPressed("fire") || spacePressed) {
      if (isHost()) {
        if (Date.now() - lastShoot.current > FIRE_RATE) {
          lastShoot.current = Date.now();
          const newBullet = {
            id: state.id + "-" + +new Date(),
            position: vec3(rigidbody.current.translation()),
            angle: movementAngle,
            player: state.id,
          };
          onFire(newBullet);
        }
      }
    }

    if (joystick.isPressed("quit")) {
      if (!quitHandled.current) {
        quitHandled.current = true;
        if (isHost()) {
          const death = state.state.deaths;
          const kill = state.state.kills;
          const xp = state.state.profile2.xp;
          onQuit(kill, death, xp, state.id);
        }
      }
    } else {
      quitHandled.current = false;
    }

    if (isHost()) {
      state.setState("pos", rigidbody.current.translation());
    } else {
      const pos = state.getState("pos");
      if (pos) {
        rigidbody.current.setTranslation(pos);
      }
    }
  });

  return (
    <group {...props} ref={group}>
      {userPlayer && <CameraControls ref={controls} />}
      <RigidBody
        ref={rigidbody}
        colliders={false}
        linearDamping={12}
        lockRotations
        type={isHost() ? "dynamic" : "kinematicPosition"}
        onIntersectionEnter={({ other }) => {
          if (
            isHost() &&
            other.rigidBody.userData.type === "bullet" &&
            state.state.health > 0
          ) {
            const newHealth =
              state.state.health - other.rigidBody.userData.damage;
            if (newHealth <= 0) {
              state.setState("deaths", state.state.deaths + 1);
              state.setState("dead", true);
              state.setState("health", 0);
              rigidbody.current.setEnabled(false);
              setTimeout(() => {
                spawnRandomly();
                rigidbody.current.setEnabled(true);
                state.setState("health", 100);
                state.setState("dead", false);
              }, 2000);
              onKilled(state.id, other.rigidBody.userData.player);
            } else {
              state.setState("health", newHealth);
            }
          }
        }}
      >
        <PlayerInfo state={state.state} />
        <group ref={character}>
          <CharacterSoldier
            color={state.state.profile2?.color || "#4287f5"}
            animation={animation}
            weapon={weapon}
          />
          {userPlayer && (
            <Crosshair
              position={[WEAPON_OFFSET.x, WEAPON_OFFSET.y, WEAPON_OFFSET.z]}
            />
          )}
        </group>
        {userPlayer && (
          <directionalLight
            ref={directionalLight}
            position={[25, 18, -25]}
            intensity={0.3}
            castShadow={!downgradedPerformance}
            shadow-camera-near={0}
            shadow-camera-far={100}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.0001}
          />
        )}
        <CapsuleCollider args={[0.7, 0.6]} position={[0, 1.28, 0]} />
      </RigidBody>
    </group>
  );
};

const PlayerInfo = ({ state }) => {
  const health = state.health;
  const profile = state.profile2;
  const name = profile?.name || "";
  const address = profile?.address || "";
  const league = profile?.league?.toLowerCase() || "private";
  const leagueTexture = useLoader(TextureLoader, `/ranks/${league}.png`);

  return (
    <Billboard position-y={2.5}>
      <Text position-y={0.75} fontSize={0.3}>
        {address}
        <meshBasicMaterial color="black" />
      </Text>
      <group position-y={0.36}>
        <mesh position={[-(name.length * 0.11 + 0.25), 0, 0]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial map={leagueTexture} transparent />
        </mesh>
        <Text fontSize={0.4}>
          {name}
          <meshBasicMaterial color="black" />
        </Text>
      </group>
      <mesh position-z={-0.1}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="black" transparent opacity={0.5} />
      </mesh>
      <mesh scale-x={health / 100} position-x={-0.5 * (1 - health / 100)}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </Billboard>
  );
};

const Crosshair = (props) => (
  <group {...props}>
    {[1, 2, 3, 4.5, 6.5, 9].map((z, i) => (
      <mesh key={i} position-z={z}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshBasicMaterial color="black" opacity={0.95 - i * 0.1} transparent />
      </mesh>
    ))}
  </group>
);
