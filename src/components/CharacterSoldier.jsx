import { useAnimations, useGLTF } from "@react-three/drei";
import { useGraph } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, forwardRef } from "react";
import { Color, LoopOnce, MeshStandardMaterial } from "three";
import { SkeletonUtils } from "three-stdlib";

const WEAPONS = [
  "GrenadeLauncher",
  "AK",
  "Knife_1",
  "Knife_2",
  "Pistol",
  "Revolver",
  "Revolver_Small",
  "RocketLauncher",
  "ShortCannon",
  "SMG",
  "Shotgun",
  "Shovel",
  "Sniper",
  "Sniper_2",
];

const CharacterSoldier = forwardRef(
  ({ color = "black", animation = "Idle", weapon = "AK", ...props }, ref) => {
    const group = useRef();
    const { scene, materials, animations } = useGLTF(
      "/models/Character_Soldier.gltf"
    );
    const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
    const { nodes } = useGraph(clone);
    const { actions } = useAnimations(animations, group);

    if (actions["Death"]) {
      actions["Death"].loop = LoopOnce;
      actions["Death"].clampWhenFinished = true;
    }

    useEffect(() => {
      const action = actions[animation];
      if (action) {
        action.reset().fadeIn(0.2).play();
        return () => action.fadeOut(0.2);
      }
    }, [animation, actions]);
    

    const playerColorMaterial = useMemo(
      () =>
        new MeshStandardMaterial({
          color: new Color(color),
        }),
      [color]
    );

    useEffect(() => {
      WEAPONS.forEach((wp) => {
        const isCurrentWeapon = wp === weapon;
        nodes[wp].visible = isCurrentWeapon;
      });

      nodes.Body?.traverse?.((child) => {
        if (child.isMesh && child.material.name === "Character_Main") {
          child.material = playerColorMaterial;
        }
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      nodes.Head?.traverse?.((child) => {
        if (child.isMesh && child.material.name === "Character_Main") {
          child.material = playerColorMaterial;
        }
      });
      clone.traverse((child) => {
        if (child.isMesh && child.material.name === "Character_Main") {
          child.material = playerColorMaterial;
        }
        if (child.isMesh) {
          child.castShadow = true;
        }
      });
    }, [nodes, clone]);

    return (
      <group {...props} dispose={null} ref={ref || group}>
        <group name="Scene">
          <group name="CharacterArmature">
            <primitive object={nodes.Root} />
            <group name="Body_1">
              <skinnedMesh
                name="Cube004"
                geometry={nodes.Cube004.geometry}
                material={materials.Skin}
                skeleton={nodes.Cube004.skeleton}
                castShadow
              />
              <skinnedMesh
                name="Cube004_1"
                geometry={nodes.Cube004_1.geometry}
                material={materials.DarkGrey}
                skeleton={nodes.Cube004_1.skeleton}
                castShadow
              />
              <skinnedMesh
                name="Cube004_2"
                geometry={nodes.Cube004_2.geometry}
                material={materials.Pants}
                skeleton={nodes.Cube004_2.skeleton}
                castShadow
              />
              <skinnedMesh
                name="Cube004_3"
                geometry={nodes.Cube004_3.geometry}
                material={playerColorMaterial}
                skeleton={nodes.Cube004_3.skeleton}
                castShadow
              />
              <skinnedMesh
                name="Cube004_4"
                geometry={nodes.Cube004_4.geometry}
                material={materials.Black}
                skeleton={nodes.Cube004_4.skeleton}
                castShadow
              />
            </group>
          </group>
        </group>
      </group>
    );
  }
);

export { CharacterSoldier };

useGLTF.preload("/models/Character_Soldier.gltf");
