import React, {useEffect, useRef, useMemo, useCallback} from "react";
import "./GlassSurface.css";
import {GlassSurface as BaseGlassSurface} from "@imsvidskiy/glass-surface-react";

/**
 * GlassSurface component - wraps the local @imsvidskiy/glass-surface-react
 *
 * Props:
 * - width: number (optional - omit to let CSS control width)
 * - height: number (optional - omit to let CSS control height)
 * - borderRadius: number (required)
 * - distortionScale: number (required)
 * - displace: number (required)
 * - backgroundOpacity: number (required)
 * - backdrop?: React.ReactElement (optional)
 * - borderWidth?: number (optional)
 * - brightness?: number (optional)
 * - opacity?: number (optional)
 * - blur?: number (optional)
 * - saturation?: number (optional)
 * - redOffset?: number (optional)
 * - greenOffset?: number (optional)
 * - blueOffset?: number (optional)
 * - refraction?: boolean (optional)
 * - renderer?: 'auto' | 'webgl' | 'svg' (optional)
 * - children?: React.ReactNode (optional)
 * - maxTiltAngle?: number (optional, default 20) - maximum tilt in degrees
 * - lerpFactor?: number (optional, default 0.05) - smoothing factor for tilt animation
 * - dynamicDisplaceSrc?: string (optional) - URL for dynamic displacement backdrop
 */
export default function GlassSurface({
    width,
    height,
    borderRadius,
    distortionScale,
    displace,
    backgroundOpacity,
    backdrop,
    borderWidth,
    brightness,
    opacity,
    blur,
    saturation,
    redOffset,
    greenOffset,
    blueOffset,
    refraction = true,
    renderer = "auto",
    children = null,
    dynamicDisplaceSrc,
    style,
    className,
    maxTiltAngle = 20,
    lerpFactor = 0.05,
}) {
    // Memoize backdrop to prevent re-creation on every render
    const finalBackdrop = useMemo(() => {
        if (dynamicDisplaceSrc) {
            return <img src={dynamicDisplaceSrc} width="100%" height="100%" style={{objectFit: "cover"}} />;
        }
        return backdrop;
    }, [dynamicDisplaceSrc, backdrop]);

    // Default to fluid dimensions so CSS controls sizing; base component would otherwise emit 200x80 inline.
    const resolvedWidth = width ?? "100%";
    const resolvedHeight = height ?? "auto";

    const surfaceRef = useRef(null);

    const lerp = useCallback((start, end, amount) => {
        return (1 - amount) * start + amount * end;
    }, []);

    const remap = useCallback((value, oldMax, newMax) => {
        const newValue = ((value + oldMax) * (newMax * 2)) / (oldMax * 2) - newMax;
        return Math.min(Math.max(newValue, -newMax), newMax);
    }, []);

    useEffect(() => {
        // Respect prefers-reduced-motion
        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (prefersReduced) return;

        const card = surfaceRef.current?.querySelector(".glass-surface");
        if (!card) return;

        const handleMouseMove = (event) => {
            const rect = card.getBoundingClientRect();
            const centerX = (rect.left + rect.right) / 2;
            const centerY = (rect.top + rect.bottom) / 2;
            const posX = event.clientX - centerX;
            const posY = event.clientY - centerY;
            // Normalize against the window (not the card) so the tilt tracks the mouse
            // anywhere inside .menu, which fills the whole window.
            const x = remap(posX, window.innerWidth / 2, maxTiltAngle);
            const y = remap(posY, window.innerHeight / 2, maxTiltAngle);
            card.dataset.rotateX = x;
            card.dataset.rotateY = -y;
        };

        const handleMouseLeave = () => {
            card.dataset.rotateX = 0;
            card.dataset.rotateY = 0;
        };

        window.addEventListener("mousemove", handleMouseMove);
        document.documentElement.addEventListener("mouseleave", handleMouseLeave);

        let rafId;
        const update = () => {
            let currentX = parseFloat(card.style.getPropertyValue("--rotateY"));
            let currentY = parseFloat(card.style.getPropertyValue("--rotateX"));
            if (isNaN(currentX)) currentX = 0;
            if (isNaN(currentY)) currentY = 0;
            const targetX = parseFloat(card.dataset.rotateX) || 0;
            const targetY = parseFloat(card.dataset.rotateY) || 0;
            const x = lerp(currentX, targetX, lerpFactor);
            const y = lerp(currentY, targetY, lerpFactor);
            card.style.setProperty("--rotateY", x + "deg");
            card.style.setProperty("--rotateX", y + "deg");
            rafId = requestAnimationFrame(update);
        };
        rafId = requestAnimationFrame(update);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
            cancelAnimationFrame(rafId);
        };
    }, [maxTiltAngle, lerpFactor, remap, lerp]);

    return (
        <div ref={surfaceRef} style={{display: "contents"}}>
            <BaseGlassSurface
                width={resolvedWidth}
                height={resolvedHeight}
                borderRadius={borderRadius}
                distortionScale={distortionScale}
                displace={displace}
                backgroundOpacity={backgroundOpacity}
                backdrop={finalBackdrop}
                borderWidth={borderWidth}
                brightness={brightness}
                opacity={opacity}
                blur={blur}
                saturation={saturation}
                redOffset={redOffset}
                greenOffset={greenOffset}
                blueOffset={blueOffset}
                refraction={refraction}
                renderer={renderer}
                style={style}
                className={className}>
                {children}
            </BaseGlassSurface>
        </div>
    );
}
