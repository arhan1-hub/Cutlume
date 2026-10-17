"use client";

import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export type LaunchScene = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  duration: number;
  motion: string;
};

export type LaunchFilmProps = {
  scenes: LaunchScene[];
  mood: string;
  projectName: string;
};

const palette: Record<string, { a: string; b: string; accent: string }> = {
  Cinematic: { a: "#090d1c", b: "#283f76", accent: "#9baeff" },
  Minimal: { a: "#101216", b: "#343b44", accent: "#e6e9ef" },
  Playful: { a: "#24143b", b: "#773f9e", accent: "#f4b4ff" },
  "High energy": { a: "#0a1922", b: "#006d7d", accent: "#73f4e2" },
};

export function LaunchFilmComposition({ scenes, mood, projectName }: LaunchFilmProps) {
  const frame = useCurrentFrame();
  const safeScenes = scenes.length ? scenes : [{
    id: "intro",
    kind: "01 · OPEN",
    title: "Your next big idea.",
    subtitle: "A better way to work starts here.",
    duration: 3,
    motion: "Slow reveal",
  }];
  const fps = 30;
  let elapsed = 0;
  let activeIndex = safeScenes.length - 1;
  let localFrame = 0;

  for (let index = 0; index < safeScenes.length; index += 1) {
    const sceneFrames = Math.max(2, Math.round(safeScenes[index].duration * fps));
    if (frame < elapsed + sceneFrames) {
      activeIndex = index;
      localFrame = frame - elapsed;
      break;
    }
    elapsed += sceneFrames;
  }

  const scene = safeScenes[activeIndex];
  const durationFrames = Math.max(2, Math.round(scene.duration * fps));
  const entrance = interpolate(localFrame, [0, Math.min(18, durationFrames / 2)], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const isSlide = scene.motion.toLowerCase().includes("slide");
  const isZoom = scene.motion.toLowerCase().includes("zoom") || scene.motion.toLowerCase().includes("reveal");
  const shiftX = isSlide ? interpolate(entrance, [0, 1], [90, 0]) : 0;
  const scale = isZoom ? interpolate(localFrame, [0, durationFrames], [1.08, 1]) : 1;
  const colors = palette[mood] ?? palette.Cinematic;
  const isClosing = activeIndex === safeScenes.length - 1;
  const safeTitle = scene.title.trim() || projectName || "Your next big idea.";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "9%",
        boxSizing: "border-box",
        color: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
        background: `radial-gradient(ellipse at 78% 20%, ${colors.b} 0%, transparent 45%), linear-gradient(135deg, ${colors.a}, #080a12 80%)`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: 0.15, backgroundImage: "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)", backgroundSize: "54px 54px" }} />
      <div style={{ position: "absolute", width: "54%", aspectRatio: "1", borderRadius: "50%", border: `1px solid ${colors.accent}55`, right: "-14%", top: "-20%", transform: `rotate(${frame * 0.12}deg) scale(${scale})` }} />
      <div style={{ position: "absolute", width: "38%", aspectRatio: "1", borderRadius: "50%", border: `1px solid ${colors.accent}33`, right: "-6%", top: "-10%", transform: `rotate(-${frame * 0.08}deg)` }} />
      <div style={{ position: "relative", zIndex: 1, opacity: entrance, transform: `translateX(${shiftX}px) scale(${scale})`, maxWidth: "90%" }}>
        <div style={{ fontSize: "clamp(12px, 1.5vw, 23px)", letterSpacing: "0.22em", fontWeight: 700, textTransform: "uppercase", color: colors.accent, marginBottom: "4%" }}>
          {scene.kind || `SCENE ${String(activeIndex + 1).padStart(2, "0")}`}
        </div>
        <div style={{ fontSize: "clamp(38px, 7vw, 112px)", fontWeight: 800, lineHeight: 0.98, letterSpacing: "-0.055em", overflowWrap: "break-word", textShadow: "0 10px 60px rgba(0,0,0,.2)" }}>
          {safeTitle}
        </div>
        <div style={{ marginTop: "4%", maxWidth: "78%", color: "rgba(255,255,255,.76)", fontSize: "clamp(16px, 2.3vw, 34px)", lineHeight: 1.35 }}>
          {scene.subtitle}
        </div>
      </div>
      <div style={{ position: "absolute", left: "9%", right: "9%", bottom: "6%", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "clamp(10px, 1.1vw, 16px)", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>
        <span>{projectName || "CUTLUME / PRODUCT FILM"}</span>
        <span>{String(activeIndex + 1).padStart(2, "0")} / {String(safeScenes.length).padStart(2, "0")}</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 5, background: "rgba(255,255,255,.12)" }}>
        <div style={{ height: "100%", width: `${((activeIndex + localFrame / durationFrames) / safeScenes.length) * 100}%`, background: colors.accent }} />
      </div>
      {isClosing && <div style={{ position: "absolute", top: "7%", right: "9%", border: `1px solid ${colors.accent}88`, color: colors.accent, borderRadius: 999, padding: "0.8em 1.2em", fontSize: "clamp(10px, 1vw, 15px)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Made to launch</div>}
    </div>
  );
}
