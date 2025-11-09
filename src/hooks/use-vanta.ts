"use client";
import { useRef, useEffect, useState, useCallback } from "react";
// import * as THREE from "three"; // <--- DELETE THIS
import { useTheme } from "next-themes";
// import VANTA_CLOUDS from 'vanta/dist/vanta.clouds.min.js'; // <--- DELETE THIS

export const useVanta = () => {
  const vantaEffectRef = useRef<any>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [vantaNode, setVantaNode] = useState<HTMLElement | null>(null);

  const vantaRef = useCallback((node: HTMLElement | null) => {
    if (node) {
      setVantaNode(node);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !resolvedTheme || !vantaNode) {
      return;
    }

    let vantaEffect: any = null;

    // We create an async function to load everything
    const loadVanta = async () => {
      // 1. Dynamically import THREE.js (the 1MB one)
      const THREE = await import("three");
      
      // 2. Dynamically import Vanta
      const VANTA_CLOUDS = (await import('vanta/dist/vanta.clouds.min.js')).default;

      // 3. Check if component is still mounted after awaiting
      if (vantaNode) {
        const isDark = resolvedTheme === "dark";

        if (vantaEffectRef.current) {
          vantaEffectRef.current.destroy();
        }

        // 4. Create the effect
        vantaEffect = VANTA_CLOUDS({
          el: vantaNode,
          THREE: THREE, // Pass the dynamically imported THREE
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          skyColor: isDark ? 0x141a2f : 0x94b2d7,
          cloudColor: isDark ? 0x3e4a75 : 0xc7d3e5,
          cloudShadowColor: isDark ? 0x182248 : 0x4d6d99,
          sunColor: isDark ? 0xbd5e2d : 0xff9900,
          sunGlareColor: 0xff6633,
          sunlightColor: isDark ? 0xe5a34a : 0xffcc33, // <-- THIS IS THE FIX
          speed: 1.0,
        });
        vantaEffectRef.current = vantaEffect;
      }
    };

    loadVanta();

    return () => {
      if (vantaEffect) {
        vantaEffect.destroy();
        vantaEffectRef.current = null;
      }
    };
  }, [resolvedTheme, mounted, vantaNode]);

  return vantaRef;
};