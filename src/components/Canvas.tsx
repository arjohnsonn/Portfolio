"use client";

import React, { useEffect, useRef } from "react";
import { isMobile } from "../lib/isMobile";

// Define a type for a star
interface Star {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
}

// Export an external function that handles scroll (renamed from handleWheel)
export function handleScroll(customPercent?: number) {
  const element = document.getElementById("landing");
  const canvas = document.getElementById("canvas");
  if (!element || !canvas) return;

  const rect = element.getBoundingClientRect();
  const windowHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const visibleHeight =
    Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
  const visiblePercentage = (visibleHeight / element.offsetHeight) * 100;
  const percent =
    customPercent ||
    Math.max(0, Math.min(50, Math.round(visiblePercentage * 100) / 100));

  if (percent > 25) {
    canvas.classList.add("fade-in");
    canvas.classList.remove("fade-out");
  } else {
    canvas.classList.add("fade-out");
    canvas.classList.remove("fade-in");
  }
}

const CanvasBG: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const starSpeed = 30;
    let stars: Star[] = [];
    const FPS = 60;
    const numStars = !isMobile() ? 150 : 65;
    const mouse = { x: 0, y: 0 };

    function initCanvas() {
      if (!canvas || !ctx) return;
      canvas.width = window.innerWidth * 2;
      canvas.height = window.innerHeight * 2;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(2, 2);

      stars = [];
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: 1,
          vx: Math.floor(Math.random() * starSpeed),
          vy: Math.floor(Math.random() * starSpeed),
        });
      }
    }

    function distance(
      point1: { x: number; y: number },
      point2: { x: number; y: number }
    ) {
      const dx = point2.x - point1.x;
      const dy = point2.y - point1.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.x / 2, s.y / 2, s.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.stroke();
      }

      // Draw connecting lines between stars and the mouse
      ctx.beginPath();
      for (let i = 0; i < stars.length; i++) {
        const starI = stars[i];
        ctx.moveTo(starI.x / 2, starI.y / 2);
        if (distance(mouse, starI) < 350) {
          ctx.lineTo(mouse.x / 2, mouse.y / 2);
        }
        for (let j = 0; j < stars.length; j++) {
          const starII = stars[j];
          if (distance(starI, starII) < 150) {
            ctx.lineTo(starII.x / 2, starII.y / 2);
          }
        }
      }
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "gray";
      ctx.stroke();

      // Apply vignette effect around mouse for non-mobile devices
      if (!isMobile()) {
        const gradient = ctx.createRadialGradient(
          mouse.x / 2,
          mouse.y / 2,
          50,
          mouse.x / 2,
          mouse.y / 2,
          500
        );
        gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
        gradient.addColorStop(1, "rgba(0, 0, 0, .6)");
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
      } else {
        canvas.style.opacity = "0.3";
      }
    }

    function update() {
      if (!canvas || !ctx) return;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.x += s.vx / FPS;
        s.y += s.vy / FPS;

        if (s.x < 0 || s.x > canvas.width) s.vx = -s.vx;
        if (s.y < 0 || s.y > canvas.height) s.vy = -s.vy;
      }
    }

    let animationFrameId: number;
    function tick() {
      draw();
      update();
      animationFrameId = requestAnimationFrame(tick);
    }

    initCanvas();
    tick();

    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        initCanvas();
      }, 100);
    };

    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      if (isMobile()) return;
      mouse.x = e.clientX * 2;
      mouse.y = e.clientY * 2;
    };
    document.body.addEventListener("mousemove", handleMouseMove);

    // Use the exported handleScroll within the component
    window.addEventListener("wheel", () => handleScroll());

    // Fix flicker on initial scroll
    handleScroll(50);
    handleScroll(0);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.body.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("wheel", () => handleScroll());
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} id="canvas" className="fixed -z-10 " />;
};

export { CanvasBG };
