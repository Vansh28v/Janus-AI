
"use client";

import { useEffect, useRef, useState } from "react";

const FRAME_COUNT = 190;
const FRAME_FOLDER = "/transformer-frames-new";

export default function TransformerSequence() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;

    if (!section || !canvas) return;

    const context = canvas.getContext("2d");

    if (!context) {
      setError(true);
      setLoading(false);
      return;
    }

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const isReducedMotion = motionPreference.matches;
    const isMobile = window.innerWidth < 768;

    setReducedMotion(isReducedMotion);

    // Load every frame on desktop.
    // Load alternate frames on mobile to reduce memory usage.
    const frameIndices = isReducedMotion
      ? [0]
      : Array.from({ length: FRAME_COUNT }, (_, index) => index)
          .filter((index) => !isMobile || index % 2 === 0);

    const images: HTMLImageElement[] = [];

    let animationFrameId = 0;
    let lastDrawnIndex = -1;
    let disposed = false;
    let framesReady = false;

    // Resize canvas according to display size and device pixel ratio.
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      lastDrawnIndex = -1;
    };

    // Render a frame without stretching or distorting it.
    const drawFrame = (index: number) => {
      if (!images[index] || disposed) return;

      const image = images[index];

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (!width || !height) return;

      context.clearRect(0, 0, width, height);

      const scale = Math.min(
        width / image.width,
        height / image.height
      );

      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;

      const x = (width - drawWidth) / 2;
      const y = (height - drawHeight) / 2;

      context.drawImage(image, x, y, drawWidth, drawHeight);

      lastDrawnIndex = index;
    };

    // Synchronize frame position with scroll progress.
    const updateFromScroll = () => {
      if (disposed || !framesReady || images.length === 0) return;

      if (isReducedMotion) {
        drawFrame(0);
        return;
      }

      const rect = section.getBoundingClientRect();

      const scrollDistance =
        section.offsetHeight - window.innerHeight;

      if (scrollDistance <= 0) {
        drawFrame(0);
        return;
      }

      const progress = Math.max(
        0,
        Math.min(1, -rect.top / scrollDistance)
      );

      const frameIndex = Math.round(
        progress * (images.length - 1)
      );

      if (frameIndex !== lastDrawnIndex) {
        drawFrame(frameIndex);
      }
    };

    // Avoid excessive canvas redraws during scrolling.
    const scheduleUpdate = () => {
      if (animationFrameId || disposed) return;

      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = 0;
        updateFromScroll();
      });
    };

    // Preload all selected images before starting the animation.
    const preloadFrames = async () => {
      try {
        const loadedImages = await Promise.all(
          frameIndices.map((frameNumber) => {
            return new Promise<HTMLImageElement>(
              (resolve, reject) => {
                const image = new Image();

                image.onload = () => resolve(image);

                image.onerror = () => {
                  reject(
                    new Error(
                      `Could not load transformer frame ${frameNumber + 1}`
                    )
                  );
                };

                const filename = `frame_${String(
                  frameNumber + 1
                ).padStart(6, "0")}.png`;

                image.src = `${FRAME_FOLDER}/${filename}`;
              }
            );
          })
        );

        if (disposed) return;

        images.push(...loadedImages);
        framesReady = true;

        resizeCanvas();

        setLoading(false);

        updateFromScroll();
      } catch (err) {
        console.error("Transformer frame loading failed:", err);

        if (!disposed) {
          setError(true);
          setLoading(false);
        }
      }
    };

    const handleResize = () => {
      resizeCanvas();
      scheduleUpdate();
    };

    window.addEventListener("scroll", scheduleUpdate, {
      passive: true,
    });

    window.addEventListener("resize", handleResize);

    resizeCanvas();
    preloadFrames();

    return () => {
      disposed = true;

      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", handleResize);

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      images.forEach((image) => {
        image.src = "";
      });
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="transformer-sequence"
      style={{
        height: reducedMotion ? "100svh" : "400vh",
        width: "100%",
        position: "relative",
        background: "#000000",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100svh",
          width: "100%",
          overflow: "hidden",
          background: "#000000",
        }}
      >
        {/* TRANSFORMER CANVAS */}
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
          }}
        />

        {/* LOADING STATE */}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "14px",
              color: "#E6C98E",
              fontSize: "11px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              background: "#000000",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                border: "2px solid rgba(230,201,142,0.2)",
                borderTopColor: "#E6C98E",
                borderRadius: "50%",
                animation: "transformer-spin 1s linear infinite",
              }}
            />

            Preparing engineering sequence
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#E6C98E",
              background: "#000000",
              fontSize: "14px",
              textAlign: "center",
              padding: "20px",
            }}
          >
            Unable to load transformer frames.
            Check your public folder and frame filenames.
          </div>
        )}

        {/* OVERLAY TEXT */}
        {!loading && !error && (
          <>
            <div
              style={{
                position: "absolute",
                top: "9%",
                left: "7%",
                color: "#D8B777",
                fontSize: "10px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                pointerEvents: "none",
              }}
            >
              ENGINEERING INTELLIGENCE · 01
            </div>

            <div
              style={{
                position: "absolute",
                bottom: "7%",
                left: "7%",
                color: "#C4B18C",
                fontSize: "10px",
                letterSpacing: "2px",
                pointerEvents: "none",
              }}
            >
              POWERING THE INFRASTRUCTURE OF TOMORROW
            </div>

            <div
              style={{
                position: "absolute",
                bottom: "7%",
                right: "7%",
                color: "#D8B777",
                fontSize: "10px",
                letterSpacing: "2px",
                pointerEvents: "none",
              }}
            >
              SCROLL TO EXPLORE ↓
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes transformer-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </section>
  );
}
