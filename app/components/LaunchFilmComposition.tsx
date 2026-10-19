"use client";

import React from "react";
import { Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

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
  productImage?: string;
};

const palette: Record<string, { a: string; b: string; accent: string; glow: string }> = {
  Cinematic: { a: "#080b18", b: "#38428c", accent: "#b8a7ff", glow: "#7c5cff" },
  Minimal: { a: "#101216", b: "#3b4654", accent: "#e6e9ef", glow: "#a6b6c9" },
  Playful: { a: "#21102f", b: "#853e91", accent: "#ffb7e9", glow: "#d65cff" },
  "High energy": { a: "#071a22", b: "#007d87", accent: "#79f4df", glow: "#00cbb1" },
};

export function LaunchFilmComposition({ scenes, mood, projectName, productImage }: LaunchFilmProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const safeScenes = scenes.length ? scenes : [{
    id: "intro", kind: "01 · OPEN", title: "Your next big idea.",
    subtitle: "A better way to work starts here.", duration: 3, motion: "Slow reveal",
  }];
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
  const entrance = interpolate(localFrame, [0, Math.min(20, durationFrames / 2)], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const exit = interpolate(localFrame, [Math.max(0, durationFrames - 12), durationFrames], [1, 0.88], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const colors = palette[mood] ?? palette.Cinematic;
  const isClosing = activeIndex === safeScenes.length - 1;
  const isBeforeAfter = /before|after|change/i.test(scene.title + " " + scene.kind);
  const isProductMoment = /product|spotlight|workflow|scene 02|scene 03/i.test(scene.title + " " + scene.kind);
  const isKinetic = /headline|hook|open|launch/i.test(scene.title + " " + scene.kind);
  const safeTitle = scene.title.trim() || projectName || "Your next big idea.";
  const projectLabel = (projectName || "YOUR PRODUCT").replace(/^https?:\/\//, "").replace(/\/$/, "").toUpperCase();
  const drift = Math.sin(frame / 18) * 8;
  const panelShift = interpolate(entrance, [0, 1], [42, 0]);

  const glass: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,.15)",
    background: "linear-gradient(145deg, rgba(29,31,52,.94), rgba(12,14,26,.92))",
    boxShadow: "0 26px 70px rgba(0,0,0,.38)",
    backdropFilter: "blur(12px)",
  };

  return (
    <div style={{
      width: "100%", height: "100%", overflow: "hidden", position: "relative",
      boxSizing: "border-box", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif",
      background: `radial-gradient(ellipse at 77% 35%, ${colors.b} 0%, transparent 44%), radial-gradient(ellipse at 8% 100%, ${colors.glow}22, transparent 40%), linear-gradient(130deg, ${colors.a}, #080910 78%)`,
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <div style={{ position: "absolute", width: "46%", aspectRatio: "1", borderRadius: "50%", border: `1px solid ${colors.accent}40`, right: "-12%", top: "-28%", transform: `rotate(${frame * .16}deg)` }} />
      <div style={{ position: "absolute", width: "32%", aspectRatio: "1", borderRadius: "50%", border: `1px solid ${colors.accent}26`, right: "-5%", top: "-12%", transform: `rotate(-${frame * .1}deg)` }} />

      <div style={{ position: "absolute", top: "7%", left: "6.5%", right: "6.5%", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 25, height: 25, borderRadius: 8, display: "grid", placeItems: "center", color: colors.accent, border: `1px solid ${colors.accent}80`, background: `${colors.accent}18`, fontSize: 14, fontWeight: 900 }}>✳</div>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".17em" }}>{projectLabel}</span>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.58)", letterSpacing: ".16em" }}>{String(activeIndex + 1).padStart(2, "0")} <span style={{ color: colors.accent }}>/</span> {String(safeScenes.length).padStart(2, "0")}</div>
      </div>

      {isClosing ? (
        <div style={{ position: "absolute", inset: "16% 8% 12%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: entrance, transform: `scale(${.96 + entrance * .04})`, zIndex: 2 }}>
          <div style={{ width: 70, height: 70, borderRadius: 23, display: "grid", placeItems: "center", fontSize: 35, color: colors.accent, border: `1px solid ${colors.accent}90`, background: `linear-gradient(145deg, ${colors.accent}25, rgba(255,255,255,.03))`, boxShadow: `0 0 65px ${colors.glow}45`, marginBottom: 24 }}>✳</div>
          <div style={{ color: colors.accent, fontSize: 13, fontWeight: 800, letterSpacing: ".28em", marginBottom: 18 }}>YOUR NEXT CHAPTER</div>
          <div style={{ fontSize: "clamp(42px, 7.2vw, 92px)", lineHeight: .98, fontWeight: 850, letterSpacing: "-.055em", maxWidth: "86%", overflowWrap: "break-word" }}>{safeTitle}</div>
          <div style={{ marginTop: 20, maxWidth: "64%", fontSize: "clamp(16px, 2vw, 25px)", lineHeight: 1.4, color: "rgba(255,255,255,.72)" }}>{scene.subtitle}</div>
          <div style={{ marginTop: 31, padding: "12px 20px", borderRadius: 999, color: "#080910", background: colors.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>MADE TO LAUNCH ↗</div>
        </div>
      ) : (
        <div style={{ position: "absolute", left: "6.5%", right: "6.5%", top: "19%", bottom: "15%", display: "grid", gridTemplateColumns: "1.04fr .96fr", gap: "4%", alignItems: "center", zIndex: 2 }}>
          <div style={{ opacity: entrance, transform: `translateX(${interpolate(entrance, [0, 1], [30, 0])}px) scale(${exit})`, minWidth: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 10px", border: `1px solid ${colors.accent}55`, background: `${colors.accent}12`, borderRadius: 999, color: colors.accent, fontSize: 9, fontWeight: 800, letterSpacing: ".18em", marginBottom: 19 }}>
              <span style={{ width: 5, height: 5, borderRadius: 9, background: colors.accent, boxShadow: `0 0 12px ${colors.accent}` }} /> {scene.kind || `SCENE ${String(activeIndex + 1).padStart(2, "0")}`}
            </div>
            <div style={{ fontSize: "clamp(35px, 5.2vw, 68px)", fontWeight: 850, lineHeight: .98, letterSpacing: "-.055em", overflowWrap: "break-word", textShadow: "0 10px 50px rgba(0,0,0,.28)" }}>{safeTitle}</div>
            <div style={{ marginTop: 18, maxWidth: "94%", color: "rgba(255,255,255,.72)", fontSize: "clamp(14px, 1.65vw, 22px)", lineHeight: 1.42 }}>{scene.subtitle}</div>
            <div style={{ marginTop: 27, display: "flex", alignItems: "center", gap: 9, color: "rgba(255,255,255,.55)", fontSize: 10, letterSpacing: ".08em" }}>
              <span style={{ width: 24, height: 1, background: colors.accent }} /> BUILT FOR WHAT'S NEXT
            </div>
          </div>

          <div style={{ position: "relative", minWidth: 0, opacity: entrance, transform: `translate(${panelShift}px, ${drift}px) rotateY(-5deg) rotateZ(-1deg)`, perspective: 900 }}>
            {productImage ? (
              <div style={{ ...glass, borderRadius: 17, padding: 8, transform: `scale(${interpolate(entrance, [0, 1], [.94, 1])})`, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 3px 10px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
                  <i style={{ width: 6, height: 6, borderRadius: 9, background: "#ff7f91" }} />
                  <i style={{ width: 6, height: 6, borderRadius: 9, background: "#f5cb7a" }} />
                  <i style={{ width: 6, height: 6, borderRadius: 9, background: "#7ce0b5" }} />
                  <div style={{ marginLeft: 8, color: "rgba(255,255,255,.58)", fontSize: 8, letterSpacing: ".1em" }}>YOUR REAL PRODUCT</div>
                </div>
                <Img src={productImage} alt="" style={{ display: "block", width: "100%", height: "auto", maxHeight: 420, objectFit: "contain", borderRadius: 8, marginTop: 8 }} />
              </div>
            ) : (
            <div style={{ ...glass, borderRadius: 17, padding: 12, transform: `scale(${interpolate(entrance, [0, 1], [.94, 1])})` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 2px 12px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
                <i style={{ width: 6, height: 6, borderRadius: 9, background: "#ff7f91" }} />
                <i style={{ width: 6, height: 6, borderRadius: 9, background: "#f5cb7a" }} />
                <i style={{ width: 6, height: 6, borderRadius: 9, background: "#7ce0b5" }} />
                <div style={{ marginLeft: 9, color: "rgba(255,255,255,.43)", fontSize: 8, letterSpacing: ".1em" }}>WORKSPACE / OVERVIEW</div>
                <div style={{ marginLeft: "auto", width: 21, height: 21, borderRadius: 7, background: `${colors.accent}24`, border: `1px solid ${colors.accent}50` }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "28% 1fr", gap: 10, paddingTop: 12 }}>
                <div style={{ borderRight: "1px solid rgba(255,255,255,.08)", paddingRight: 8 }}>
                  {["Overview", "Projects", "Insights", "Settings"].map((item, i) => <div key={item} style={{ padding: "8px 5px", marginBottom: 4, borderRadius: 5, background: i === 0 ? `${colors.accent}20` : "transparent", color: i === 0 ? colors.accent : "rgba(255,255,255,.42)", fontSize: 7.5 }}>{item}</div>)}
                </div>
                <div>
                  <div style={{ color: "rgba(255,255,255,.52)", fontSize: 8, letterSpacing: ".1em" }}>YOUR MOMENTUM</div>
                  <div style={{ marginTop: 6, fontSize: 21, fontWeight: 800, letterSpacing: "-.04em" }}>Looking good<span style={{ color: colors.accent }}>.</span></div>
                  <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
                    {[["+28%", "rgba(121,224,188,.15)", "#8ce7c3"], ["4.8/5", "rgba(184,167,255,.15)", colors.accent]].map(([value, bg, fg]) => <div key={value} style={{ flex: 1, borderRadius: 7, padding: "8px 7px", background: bg, border: "1px solid rgba(255,255,255,.07)" }}><div style={{ color: fg, fontSize: 13, fontWeight: 800 }}>{value}</div><div style={{ marginTop: 3, color: "rgba(255,255,255,.43)", fontSize: 7 }}>THIS MONTH</div></div>)}
                  </div>
                  <div style={{ ...glass, marginTop: 9, padding: 9, borderRadius: 8, boxShadow: "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,.48)", fontSize: 7 }}><span>ACTIVITY</span><span>LAST 7 DAYS</span></div>
                    <div style={{ display: "flex", alignItems: "end", gap: 5, height: 53, paddingTop: 8 }}>
                      {[27, 43, 31, 57, 39, 47, 65, 52, 72, 58, 86, 68].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "3px 3px 1px 1px", background: i === 10 ? colors.accent : `${colors.accent}${i > 7 ? "99" : "45"}`, transform: `scaleY(${1 + Math.sin(frame / 10 + i) * .06})` }} />)}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 11, padding: "9px 10px", display: "flex", alignItems: "center", gap: 8, borderRadius: 8, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.07)" }}>
                <div style={{ width: 23, height: 23, borderRadius: 7, display: "grid", placeItems: "center", color: colors.accent, background: `${colors.accent}1c`, fontSize: 11 }}>✦</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 8, fontWeight: 700 }}>A little more clarity.</div><div style={{ marginTop: 3, fontSize: 7, color: "rgba(255,255,255,.42)" }}>Your next move, made obvious.</div></div>
                <div style={{ padding: "6px 8px", borderRadius: 5, background: colors.accent, color: "#10101a", fontSize: 7, fontWeight: 800 }}>Explore ↗</div>
              </div>
            </div>
            )}
            <div style={{ position: "absolute", top: "-7%", right: "-4%", width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", color: colors.accent, background: "#16172b", border: `1px solid ${colors.accent}70`, boxShadow: `0 10px 35px ${colors.glow}35`, fontSize: 19, transform: `translateY(${Math.sin(frame / 12) * 5}px) rotate(8deg)` }}>✳</div>
            {isBeforeAfter && <div style={{ position: "absolute", left: "-5%", bottom: "-6%", ...glass, borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 9, letterSpacing: ".1em" }}><span style={{ color: "#ff9ba9" }}>BEFORE</span><span style={{ margin: "0 8px", color: "rgba(255,255,255,.35)" }}>→</span><span style={{ color: "#8ce7c3" }}>AFTER</span></div>}
            {isProductMoment && <div style={{ position: "absolute", right: "-3%", bottom: "-6%", ...glass, borderRadius: 9, padding: "10px 13px", color: colors.accent, fontSize: 9, letterSpacing: ".08em" }}>✦ KEY MOMENT REVEALED</div>}
            {isKinetic && <div style={{ position: "absolute", left: "12%", bottom: "-8%", height: 3, width: `${Math.max(12, entrance * 82)}%`, borderRadius: 5, background: `linear-gradient(90deg, ${colors.accent}, transparent)` }} />}
          </div>
        </div>
      )}

      <div style={{ position: "absolute", left: "6.5%", right: "6.5%", bottom: "6%", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 4, color: "rgba(255,255,255,.45)", fontSize: 8, letterSpacing: ".17em" }}>
        <span>MADE WITH INTENTION</span><span>{projectLabel} · PRODUCT FILM</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "rgba(255,255,255,.12)", zIndex: 5 }}>
        <div style={{ height: "100%", width: `${((activeIndex + localFrame / durationFrames) / safeScenes.length) * 100}%`, background: `linear-gradient(90deg, ${colors.glow}, ${colors.accent})` }} />
      </div>
    </div>
  );
}
