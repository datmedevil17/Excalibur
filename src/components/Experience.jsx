import { Environment } from "@react-three/drei";
import React from "react";
import {
  Joystick,
  insertCoin,
  isHost,
  myPlayer,
  onPlayerJoin,
  useMultiplayerState,
} from "playroomkit";
import Stats from "./Stats.json";
import { useEffect, useState } from "react";
import { Bullet } from "./Bullet";
import { BulletHit } from "./BulletHit";
import { CharacterController } from "./CharacterController";
import { Map } from "./Map";

export const Experience = ({ downgradedPerformance = false, playerData,xpChange }) => {
  const [playersMap, setPlayersMap] = useState({});
  const weaponStats = Stats.find((item) => item.type === playerData.weapon);

  if (!weaponStats) {
    console.error(`Weapon type ${playerData.weapon} not found in Stats.json`);
    return null;
  }

  const { FIRE_RATE, BULLET_SPEED, DAMAGE, MOVEMENT_SPEED } = weaponStats;
  const getRank = (xp) => {
    if (xp < 100) return "private";
    if (xp < 200) return "corporal";
    if (xp < 300) return "sergeant";
    return "major";
  };
  useEffect(() => {
    onPlayerJoin((state) => {
      const joystick = new Joystick(state, {
        type: "angular",
        buttons: [{ id: "fire", label: "Fire" },{ id: "quit", label: "Quit" }],
      });

      state.setState("health", 100);
      state.setState("deaths", 0);
      state.setState("kills", 0);
      const isMe = state.id === myPlayer()?.id;
      if (isMe) {
        state.setState("profile2", {
          name: playerData.name,
          address: playerData.address,
          weapon: playerData.weapon,
          color: playerData.color,
          league: getRank(playerData.xp),
          photo: playerData.photo,
          xp: playerData.xp,
          roomCode: playerData.roomCode,
          token: playerData.token,
        });
      }

      setPlayersMap((prev) => ({
        ...prev,
        [state.id]: { state, joystick },
      }));

      state.onQuit(() => {
        setPlayersMap((prev) => {
          const next = { ...prev };
          delete next[state.id];
          return next;
        });
      });
    });

    // Finally, join the game
    insertCoin({ skipLobby: true, roomCode:playerData?.roomCode}).catch(console.error);
  }, []);

  const [bullets, setBullets] = useState([]);
  const [hits, setHits] = useState([]);

  const [networkBullets, setNetworkBullets] = useMultiplayerState(
    "bullets",
    []
  );
  const [networkHits, setNetworkHits] = useMultiplayerState("hits", []);

  const onFire = (bullet) => setBullets((b) => [...b, bullet]);
  const onQuit = (kill,death,xp,id) => {
    xpChange(kill,death,xp,id);
  };
  const onHit = (id, position) => {
    setBullets((b) => b.filter((x) => x.id !== id));
    setHits((h) => [...h, { id, position }]);
  };
  const onHitEnded = (id) => setHits((h) => h.filter((x) => x.id !== id));

  useEffect(() => setNetworkBullets(bullets), [bullets]);
  useEffect(() => setNetworkHits(hits), [hits]);

  const onKilled = (_victim, killer) => {
    const killerState = playersMap[killer]?.state;
    if (killerState) {
      killerState.setState("kills", killerState.state.kills + 1);
    }
  };

  const localId = myPlayer()?.id;
  const localEntry =
    localId && playersMap[localId] ? [playersMap[localId]] : [];
  const others = Object.entries(playersMap)
    .filter(([id]) => id !== localId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => entry);
  const players = [...localEntry, ...others];

  return (
    <>
      <Map />
      {players.map(({ state, joystick }) => (
        <CharacterController
          key={state.id}
          state={state}
          userPlayer={state.id === localId}
          joystick={joystick}
          onFire={onFire}
          onQuit={onQuit}
          onKilled={onKilled}
          downgradedPerformance={downgradedPerformance}
          FIRE_RATE={FIRE_RATE}
          MOVEMENT_SPEED={MOVEMENT_SPEED}
        />
      ))}

      {(isHost() ? bullets : networkBullets).map((b) => (
        <Bullet
          key={b.id}
          {...b}
          onHit={(pos) => onHit(b.id, pos)}
          BULLET_SPEED={BULLET_SPEED}
          DAMAGE={DAMAGE}
        />
      ))}
      {(isHost() ? hits : networkHits).map((h) => (
        <BulletHit key={h.id} {...h} onEnded={() => onHitEnded(h.id)} />
      ))}

      <Environment preset="sunset" />
    </>
  );
};
