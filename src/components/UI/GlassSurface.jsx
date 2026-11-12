import React, {useEffect, useRef} from "react";
import "@imsvidskiy/glass-surface/glass-surface.css";
import "./GlassSurface.css";
import {GlassSurface as BaseGlassSurface} from "@imsvidskiy/glass-surface-react";

/**
 * GlassSurface component - wraps @imsvidskiy/glass-surface-react
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
}) {
    const finalBackdrop = dynamicDisplaceSrc ? (
        <img src={dynamicDisplaceSrc} width="100%" height="100%" style={{objectFit: "cover"}} />
    ) : (
        backdrop
    );
    // Default to fluid dimensions so CSS controls sizing; base component would otherwise emit 200x80 inline.
    const resolvedWidth = width ?? "100%";
    const resolvedHeight = height ?? "auto";

    const angle = 20;
    const surfaceRef = useRef(null);

    const lerp = (start, end, amount) => {
        return (1 - amount) * start + amount * end;
    };

    const remap = (value, oldMax, newMax) => {
        const newValue = ((value + oldMax) * (newMax * 2)) / (oldMax * 2) - newMax;
        return Math.min(Math.max(newValue, -newMax), newMax);
    };

    useEffect(() => {
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
            const x = remap(posX, window.innerWidth / 2, angle);
            const y = remap(posY, window.innerHeight / 2, angle);
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
            const x = lerp(currentX, targetX, 0.05);
            const y = lerp(currentY, targetY, 0.05);
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
    }, []);

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
