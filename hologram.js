/**
 * hologram.js
 * Dark underlay + continent outlines (Earth) + grid + line glow
 */

export function createHologram(THREE, options = {}) {
    if (!THREE) {
        throw new Error('createHologram requires the existing THREE namespace.');
    }

    const settings = {
        earth: {
            gridColor: 0x65dfff,
            glowColor: 0x168cff,
            continentColor: 0x7cf0ff,      // brighter cyan
            gridOpacity: 0.42,
            glowOpacity: 0.10,
            continentOpacity: 0.85,       // much more visible
            underlayColor: 0x010508,
            ...options.earth
        },
        sun: {
            gridColor: 0xffd18a,
            glowColor: 0xff8a24,
            gridOpacity: 0.38,
            glowOpacity: 0.09,
            underlayColor: 0x080402,
            ...options.sun
        }
    };

    const attached = new Map();

    // Simplified but recognizable major outlines
    // Format: array of [lon, lat] pairs
    const CONTINENT_PATHS = [
        // North America
        [[-168,71],[-160,66],[-145,61],[-130,55],[-120,49],[-110,42],[-100,35],[-95,29],[-90,24],[-85,22],[-80,25],[-75,32],[-70,40],[-65,45],[-60,50],[-55,55],[-50,58],[-40,62],[-30,68],[-20,72],[-10,74],[10,76],[30,74],[50,70],[70,65],[90,60],[110,55],[130,52],[150,55],[170,62],[180,68],[-170,72],[-168,71]],

        // South America
        [[-82,12],[-78,5],[-74,-2],[-71,-12],[-69,-25],[-67,-35],[-65,-45],[-63,-53],[-60,-54],[-55,-50],[-48,-42],[-42,-30],[-36,-15],[-35,-2],[-38,6],[-50,10],[-65,10],[-75,11],[-82,12]],

        // Africa
        [[-17,15],[-12,6],[-5,-2],[5,-15],[15,-25],[22,-33],[28,-34],[34,-28],[36,-15],[35,-2],[30,10],[20,20],[10,25],[0,24],[-10,20],[-17,15]],

        // Europe + western Asia (simplified)
        [[-10,36],[-5,43],[0,48],[8,54],[15,60],[25,68],[40,70],[55,65],[70,58],[85,50],[100,45],[115,40],[125,36]],

        // Australia
        [[113,-22],[120,-28],[130,-35],[138,-36],[145,-30],[149,-20],[147,-14],[140,-14],[130,-18],[120,-16],[113,-22]],

        // Antarctica
        [[-180,-72],[-120,-76],[-60,-75],[0,-72],[60,-74],[120,-76],[180,-72],[-180,-72]]
    ];

    function latLonToVector3(lon, lat, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const y =  radius * Math.cos(phi);
        const z =  radius * Math.sin(phi) * Math.sin(theta);

        return [x, y, z];
    }

    function makeContinentOutlines(radius, color, opacity) {
        const positions = [];

        for (const path of CONTINENT_PATHS) {
            for (let i = 0; i < path.length - 1; i++) {
                const [lon1, lat1] = path[i];
                const [lon2, lat2] = path[i + 1];

                const v1 = latLonToVector3(lon1, lat1, radius);
                const v2 = latLonToVector3(lon2, lat2, radius);

                positions.push(...v1, ...v2);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            toneMapped: false
        });

        const lines = new THREE.LineSegments(geometry, material);
        lines.renderOrder = 3;          // under grid, above underlay
        lines.raycast = () => {};
        return lines;
    }

    function makeGrid(radius, color, opacity, renderOrder = 4) {
        const positions = [];
        const latitudeCount = 12;
        const longitudeCount = 18;
        const segments = 48;

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
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            toneMapped: false
        });

        const lines = new THREE.LineSegments(geometry, material);
        lines.renderOrder = renderOrder;
        lines.raycast = () => {};
        return lines;
    }

    function makeUnderlay(radius, color) {
        const geometry = new THREE.SphereGeometry(radius * 1.004, 32, 24);
        const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
        const underlay = new THREE.Mesh(geometry, material);
        underlay.renderOrder = 1;
        underlay.raycast = () => {};
        return underlay;
    }

    function attach(body, type) {
        if (!body || attached.has(body)) return;

        const config = settings[type];
        if (!config) throw new Error(`Unsupported hologram body: ${type}`);

        const radius = body.geometry?.parameters?.radius;
        if (!Number.isFinite(radius) || radius <= 0) {
            throw new Error(`The ${type} mesh must use SphereGeometry with a valid radius.`);
        }

        const group = new THREE.Group();
        group.name = `${type}Hologram`;
        group.visible = false;

        const underlay = makeUnderlay(radius, config.underlayColor);
        underlay.name = `${type}HologramUnderlay`;

        const children = [underlay];

        let continents = null;
        if (type === 'earth') {
            continents = makeContinentOutlines(
                radius * 1.012,                 // clearly below the grid
                config.continentColor,
                config.continentOpacity
            );
            continents.name = 'earthHologramContinents';
            children.push(continents);
        }

        const grid = makeGrid(radius * 1.018, config.gridColor, config.gridOpacity, 4);
        grid.name = `${type}HologramGrid`;
        children.push(grid);

        const gridGlow = makeGrid(radius * 1.021, config.glowColor, config.glowOpacity, 5);
        gridGlow.name = `${type}HologramGridGlow`;
        children.push(gridGlow);

        group.add(...children);
        body.add(group);

        attached.set(body, { group, underlay, continents, grid, gridGlow, type });
    }

    function attachEarth(earth) { attach(earth, 'earth'); }
    function attachSun(sun)     { attach(sun, 'sun'); }

    function setEnabled(enabled) {
        const visible = Boolean(enabled);
        for (const effect of attached.values()) effect.group.visible = visible;
    }

    function setBodyEnabled(body, enabled) {
        const effect = attached.get(body);
        if (effect) effect.group.visible = Boolean(enabled);
    }

    function dispose() {
        for (const [body, effect] of attached) {
            body.remove(effect.group);
            effect.underlay.geometry.dispose();
            effect.underlay.material.dispose();
            if (effect.continents) {
                effect.continents.geometry.dispose();
                effect.continents.material.dispose();
            }
            effect.grid.geometry.dispose();
            effect.grid.material.dispose();
            effect.gridGlow.geometry.dispose();
            effect.gridGlow.material.dispose();
        }
        attached.clear();
    }

    return { attachEarth, attachSun, setEnabled, setBodyEnabled, dispose };
}