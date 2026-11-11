/*
 * hologram.js
 * Minimal holographic overlays for Astronomical Time — Mode 4 Orbit View.
 *
 * Usage in mode4.js:
 *   import { createHologram } from './hologram.js';
 *   const hologram = createHologram(THREE);
 *   hologram.attachEarth(earth);
 *   hologram.attachSun(sun);
 *
 * Enable only in Orbit View:
 *   hologram.setEnabled(true);
 *
 * Disable in Earth Focus, Sun Focus, and spacecraft inspection:
 *   hologram.setEnabled(false);
 *
 * The effects are child objects of the existing Earth and Sun meshes.
 * They therefore inherit their parents' transforms without changing
 * orbital positions, rotations, or astronomical calculations.
 */

export function createHologram(THREE, options = {}) {
    if (!THREE) {
        throw new Error('createHologram requires the existing THREE namespace.');
    }

    const settings = {
        earth: {
            surfaceColor: 0x38cfff,
            gridColor: 0x65dfff,
            glowColor: 0x168cff,
            surfaceOpacity: 0.16,
            gridOpacity: 0.34,
            glowOpacity: 0.075,
            ...options.earth
        },
        sun: {
            surfaceColor: 0xffbd55,
            gridColor: 0xffd18a,
            glowColor: 0xff8a24,
            surfaceOpacity: 0.13,
            gridOpacity: 0.30,
            glowOpacity: 0.065,
            ...options.sun
        }
    };

    const attached = new Map();

    function makeGrid(radius, color, opacity) {
        const positions = [];
        const latitudeCount = 12;
        const longitudeCount = 18;
        const segments = 48;

        // Latitude circles, excluding the poles.
        for (let i = 1; i < latitudeCount; i++) {
            const latitude = -Math.PI / 2 + Math.PI * i / latitudeCount;
            const ringRadius = radius * Math.cos(latitude);
            const y = radius * Math.sin(latitude);

            for (let j = 0; j < segments; j++) {
                const a1 = 2 * Math.PI * j / segments;
                const a2 = 2 * Math.PI * (j + 1) / segments;

                positions.push(
                    ringRadius * Math.cos(a1), y, ringRadius * Math.sin(a1),
                    ringRadius * Math.cos(a2), y, ringRadius * Math.sin(a2)
                );
            }
        }

        // Longitude meridians.
        for (let i = 0; i < longitudeCount; i++) {
            const longitude = 2 * Math.PI * i / longitudeCount;

            for (let j = 0; j < segments; j++) {
                const a1 = -Math.PI / 2 + Math.PI * j / segments;
                const a2 = -Math.PI / 2 + Math.PI * (j + 1) / segments;

                positions.push(
                    radius * Math.cos(a1) * Math.cos(longitude),
                    radius * Math.sin(a1),
                    radius * Math.cos(a1) * Math.sin(longitude),

                    radius * Math.cos(a2) * Math.cos(longitude),
                    radius * Math.sin(a2),
                    radius * Math.cos(a2) * Math.sin(longitude)
                );
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        );

        const material = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            toneMapped: false
        });

        const lines = new THREE.LineSegments(geometry, material);
        lines.renderOrder = 3;
        lines.raycast = () => {};

        return lines;
    }

    function makeGlow(radius, color, opacity) {
        const geometry = new THREE.SphereGeometry(
            radius * 1.035,
            24,
            16
        );

        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            side: THREE.BackSide,
            depthWrite: false,
            toneMapped: false
        });

        const glow = new THREE.Mesh(geometry, material);
        glow.renderOrder = 1;
        glow.raycast = () => {};

        return glow;
    }

    function attach(body, type) {
        if (!body || attached.has(body)) return;

        const config = settings[type];
        if (!config) {
            throw new Error(`Unsupported hologram body: ${type}`);
        }

        const radius = body.geometry?.parameters?.radius;
        if (!Number.isFinite(radius) || radius <= 0) {
            throw new Error(
                `The ${type} mesh must use SphereGeometry with a valid radius.`
            );
        }

        const group = new THREE.Group();
        group.name = `${type}Hologram`;
        group.visible = false;

        // A lightly tinted translucent layer preserves the underlying
        // Earth/Sun texture rather than replacing it with a blank sphere.
        const surfaceGeometry = new THREE.SphereGeometry(
            radius * 1.009,
            32,
            24
        );

        const surfaceMaterial = new THREE.MeshBasicMaterial({
            color: config.surfaceColor,
            transparent: true,
            opacity: config.surfaceOpacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });

        const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
        surface.name = `${type}HologramSurface`;
        surface.renderOrder = 2;
        surface.raycast = () => {};

        const glow = makeGlow(
            radius,
            config.glowColor,
            config.glowOpacity
        );
        glow.name = `${type}HologramGlow`;

        const grid = makeGrid(
            radius * 1.018,
            config.gridColor,
            config.gridOpacity
        );
        grid.name = `${type}HologramGrid`;

        group.add(glow, surface, grid);

        // Inherit the original body's position and rotation.
        body.add(group);

        attached.set(body, {
            group,
            surfaceGeometry,
            surfaceMaterial,
            glow,
            grid,
            type
        });
    }

    function attachEarth(earth) {
        attach(earth, 'earth');
    }

    function attachSun(sun) {
        attach(sun, 'sun');
    }

    function setEnabled(enabled) {
        const visible = Boolean(enabled);
        for (const effect of attached.values()) {
            effect.group.visible = visible;
        }
    }

    function setBodyEnabled(body, enabled) {
        const effect = attached.get(body);
        if (effect) effect.group.visible = Boolean(enabled);
    }

    function dispose() {
        for (const [body, effect] of attached) {
            body.remove(effect.group);

            effect.surfaceGeometry.dispose();
            effect.surfaceMaterial.dispose();

            effect.glow.geometry.dispose();
            effect.glow.material.dispose();

            effect.grid.geometry.dispose();
            effect.grid.material.dispose();
        }

        attached.clear();
    }

    return {
        attachEarth,
        attachSun,
        setEnabled,
        setBodyEnabled,
        dispose
    };
}
