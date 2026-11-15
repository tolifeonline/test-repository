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
            magneticColor: 0xffb52e,
            magneticOpacity: 0.65,
            underlayColor: 0x080402,
            ...options.sun
        }
    };

    const attached = new Map();

    // Simplified but recognizable major outlines
    // Format: array of [lon, lat] pairs

const CONTINENT_PATHS = [

    // ===== North America =====
    [
        [-168, 65], [-160, 60], [-153, 58], [-145, 60],
        [-140, 58], [-135, 55], [-130, 52], [-127, 48],
        [-124, 42], [-117, 33], [-111, 29], [-105, 25],
        [-98, 22], [-92, 18], [-88, 16], [-85, 18],
        [-82, 23], [-80, 27], [-77, 32], [-75, 36],
        [-72, 41], [-68, 45], [-63, 49], [-58, 53],
        [-55, 58], [-60, 63], [-65, 67], [-72, 70],
        [-80, 72], [-90, 73], [-100, 72], [-110, 72],
        [-120, 72], [-130, 70], [-140, 68], [-150, 66],
        [-160, 66], [-168, 65]
    ],

    // ===== Alaska =====
    [
        [-168, 65], [-165, 61], [-160, 59], [-154, 57],
        [-150, 59], [-146, 61], [-141, 60], [-140, 64],
        [-145, 67], [-153, 69], [-160, 69], [-168, 65]
    ],

    // ===== Central America =====
    [
        [-92, 16], [-88, 16], [-85, 14], [-83, 10],
        [-80, 8], [-78, 8], [-77, 11], [-80, 13],
        [-84, 15], [-88, 17], [-92, 16]
    ],

    // ===== Greenland =====
    [
        [-73, 60], [-62, 59], [-48, 60], [-42, 65],
        [-38, 71], [-40, 78], [-48, 82], [-58, 84],
        [-68, 82], [-75, 76], [-72, 69], [-73, 60]
    ],

    // ===== South America =====
    [
        [-81, 12], [-76, 9], [-72, 10], [-68, 11],
        [-62, 10], [-55, 6], [-50, 2], [-47, -5],
        [-43, -13], [-39, -21], [-39, -28], [-45, -35],
        [-50, -42], [-55, -49], [-62, -54], [-68, -55],
        [-72, -50], [-74, -42], [-73, -34], [-71, -25],
        [-72, -15], [-75, -5], [-79, 3], [-81, 12]
    ],

    // ===== Europe =====
    [
        [-10, 36], [-9, 43], [-5, 47], [0, 50],
        [5, 54], [10, 55], [14, 58], [20, 60],
        [25, 65], [30, 70], [25, 71], [20, 69],
        [15, 67], [10, 65], [5, 62], [0, 58],
        [-5, 55], [-8, 50], [-10, 45], [-10, 36]
    ],

    // ===== Africa =====
    [
        [-17, 15], [-16, 10], [-12, 5], [-8, 3],
        [-5, 0], [0, -5], [5, -10], [10, -16],
        [15, -22], [20, -29], [25, -34], [30, -34],
        [34, -30], [38, -22], [40, -15], [42, -5],
        [48, 0], [44, 10], [40, 15], [35, 20],
        [30, 25], [25, 31], [20, 33], [10, 37],
        [0, 36], [-8, 32], [-13, 25], [-17, 15]
    ],

    // ===== Asia =====
    [
        [30, 70], [40, 68], [50, 65], [60, 62],
        [70, 58], [80, 55], [90, 52], [100, 50],
        [110, 48], [120, 45], [130, 43], [135, 47],
        [140, 52], [145, 56], [150, 60], [155, 62],
        [160, 60], [165, 56], [170, 55], [175, 60],
        [180, 65], [170, 70], [160, 72], [150, 70],
        [140, 72], [130, 72], [120, 70], [110, 72],
        [100, 72], [90, 72], [80, 72], [70, 72],
        [60, 73], [50, 72], [40, 72], [30, 70]
    ],

    // ===== Arabian Peninsula =====
    [
        [35, 30], [42, 32], [48, 30], [55, 25],
        [56, 20], [52, 15], [48, 12], [44, 15],
        [40, 20], [35, 25], [35, 30]
    ],

    // ===== India =====
    [
        [68, 24], [72, 28], [78, 31], [85, 28],
        [89, 24], [87, 20], [83, 15], [80, 8],
        [77, 7], [73, 12], [70, 18], [68, 24]
    ],

    // ===== Sri Lanka =====
    [
        [79, 9], [81, 8], [82, 6], [81, 5],
        [79, 7], [79, 9]
    ],

    // ===== Japan =====
    [
        [130, 31], [132, 33], [135, 34], [138, 35],
        [140, 37], [141, 40], [143, 43], [145, 44],
        [145, 41], [142, 38], [140, 35], [137, 34],
        [134, 33], [132, 32], [130, 31]
    ],

    // ===== Korea =====
    [
        [126, 34], [128, 35], [130, 38], [129, 41],
        [126, 42], [124, 40], [125, 37], [126, 34]
    ],

    // ===== Taiwan =====
    [
        [120, 22], [122, 24], [122, 25], [120, 24],
        [120, 22]
    ],

    // ===== Southeast Asia / Indochina =====
    [
        [97, 22], [101, 20], [104, 18], [108, 15],
        [110, 12], [109, 8], [105, 10], [102, 13],
        [99, 17], [97, 22]
    ],

    // ===== Sumatra =====
    [
        [95, 5], [99, 4], [103, 0], [105, -5],
        [102, -6], [99, -2], [97, 1], [95, 5]
    ],

    // ===== Java =====
    [
        [105, -6], [109, -7], [113, -8], [115, -8],
        [112, -9], [108, -8], [105, -6]
    ],

    // ===== Borneo =====
    [
        [109, 7], [114, 7], [118, 4], [119, 0],
        [116, -4], [112, -3], [109, 1], [109, 7]
    ],

    // ===== New Guinea =====
    [
        [131, -2], [136, -2], [141, -3], [145, -6],
        [148, -7], [145, -9], [140, -9], [135, -7],
        [132, -5], [131, -2]
    ],

    // ===== Australia =====
    [
        [113, -22], [115, -18], [120, -16], [125, -14],
        [130, -12], [136, -12], [140, -13], [145, -16],
        [149, -22], [153, -27], [151, -33], [147, -38],
        [141, -39], [135, -35], [130, -34], [125, -34],
        [120, -32], [116, -28], [113, -22]
    ],

    // ===== Madagascar =====
    [
        [49, -12], [50, -16], [50, -21], [48, -25],
        [46, -24], [44, -19], [45, -15], [47, -12],
        [49, -12]
    ],

    // ===== Antarctica =====
    [
        [-180, -72], [-150, -74], [-120, -75],
        [-90, -74], [-60, -73], [-30, -72],
        [0, -72], [30, -73], [60, -74],
        [90, -75], [120, -74], [150, -73],
        [180, -72], [-180, -72]
    ]

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



function makeEarthOceanSurface(THREE, radius) {
    const group = new THREE.Group();

    // Generate a geographic land mask from existing continent paths.
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;

    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';

    for (const path of CONTINENT_PATHS) {
        ctx.beginPath();

        for (let i = 0; i < path.length; i++) {
            const [lon, lat] = path[i];

            const x = ((lon + 180) / 360) * canvas.width;
            const y = ((90 - lat) / 180) * canvas.height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();
        ctx.fill();
    }

    const landMask = new THREE.CanvasTexture(canvas);
    landMask.colorSpace = THREE.NoColorSpace;
    landMask.needsUpdate = true;

    const geometry = new THREE.SphereGeometry(
        radius * 1.010,
        128,
        96
    );

    const material = new THREE.ShaderMaterial({
        uniforms: {
            landMask: { value: landMask }
        },

        transparent: false,
        depthWrite: true,
        depthTest: true,
        toneMapped: false,

        vertexShader: `
            varying vec3 vPosition;
            varying vec2 vUv;

            void main() {
                vPosition = normalize(position);
                vUv = uv;

                gl_Position = projectionMatrix *
                    modelViewMatrix *
                    vec4(position, 1.0);
            }
        `,

        fragmentShader: `
            uniform sampler2D landMask;

            varying vec3 vPosition;
            varying vec2 vUv;

            float hash(vec3 p) {
                p = fract(p * 0.3183099 + 0.1);
                p *= 17.0;

                return fract(
                    p.x * p.y * p.z *
                    (p.x + p.y + p.z)
                );
            }

            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);

                f = f * f * (3.0 - 2.0 * f);

                return mix(
                    mix(
                        mix(hash(i),
                            hash(i + vec3(1,0,0)), f.x),
                        mix(hash(i + vec3(0,1,0)),
                            hash(i + vec3(1,1,0)), f.x),
                        f.y
                    ),
                    mix(
                        mix(hash(i + vec3(0,0,1)),
                            hash(i + vec3(1,0,1)), f.x),
                        mix(hash(i + vec3(0,1,1)),
                            hash(i + vec3(1,1,1)), f.x),
                        f.y
                    ),
                    f.z
                );
            }

            float fbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.5;

                for (int i = 0; i < 5; i++) {
                    value += noise(p) * amplitude;
                    p *= 2.0;
                    amplitude *= 0.5;
                }

                return value;
            }

            void main() {
                // Read geographic land/ocean classification.
                float land = texture2D(landMask, vUv).r;

                // Solid black land.
                if (land > 0.5) {
                    gl_FragColor = vec4(0.001, 0.002, 0.004, 1.0);
                    return;
                }

                // Textured blue ocean.
                vec3 p = normalize(vPosition);

                float broad = fbm(p * 8.0);
                float medium = fbm(p * 32.0);
                float fine = fbm(p * 95.0);

                float textureValue =
                    broad * 0.30 +
                    medium * 0.45 +
                    fine * 0.25;

                vec3 deepBlue = vec3(0.003, 0.025, 0.12);
                vec3 oceanBlue = vec3(0.008, 0.10, 0.32);
                vec3 brightBlue = vec3(0.015, 0.25, 0.52);

                vec3 colour = mix(
                    deepBlue,
                    oceanBlue,
                    smoothstep(0.28, 0.55, textureValue)
                );

                colour = mix(
                    colour,
                    brightBlue,
                    smoothstep(0.48, 0.68, textureValue) * 0.65
                );

                float detail = smoothstep(0.40, 0.70, fine);

                colour *= 0.78 + detail * 0.38;

                gl_FragColor = vec4(colour, 1.0);
            }
        `
    });

    const surface = new THREE.Mesh(geometry, material);

    surface.name = 'earthHologramOceanSurface';
    surface.renderOrder = 2;
    surface.raycast = () => {};

    group.add(surface);

    // Retain reference for proper disposal.
    group.userData.landMaskTexture = landMask;

    return group;
}



function makeMagneticLoops(radius, color, opacity) {
    const group = new THREE.Group();
    group.name = 'sunHologramMagneticField';

    const bundleCount = 18;
    const segments = 72;
    const surfaceRadius = radius * 1.016;

    const positions = [];

    const random = (min, max) =>
        min + Math.random() * (max - min);

    for (let b = 0; b < bundleCount; b++) {

        // Uniform random distribution over the solar sphere.
        const z = random(-1, 1);
        const angle = random(0, Math.PI * 2);
        const radial = Math.sqrt(1 - z * z);

        const normal = new THREE.Vector3(
            radial * Math.cos(angle),
            z,
            radial * Math.sin(angle)
        );

        const randomVector = new THREE.Vector3(
            random(-1, 1),
            random(-1, 1),
            random(-1, 1)
        );

        const tangent = new THREE.Vector3()
            .crossVectors(normal, randomVector);

        if (tangent.lengthSq() < 0.0001) {
            tangent.set(1, 0, 0).cross(normal);
        }

        tangent.normalize();

        const bundleAxis = new THREE.Vector3()
            .crossVectors(normal, tangent)
            .normalize();

        // Different bundles have different sizes and structures.
        const strandCount = Math.floor(random(4, 11));

        const halfSpan = random(0.07, 0.19);

        // Mostly compact loops, with occasional larger arches.
        const height = Math.random() < 0.15
            ? radius * random(0.36, 0.50)
            : radius * random(0.12, 0.34);

        const bundleWidth = random(0.012, 0.035);

        for (let s = 0; s < strandCount; s++) {

            // Irregular individual footpoint positions.
            const startOffset = random(
                -bundleWidth, bundleWidth
            );

            const endOffset = random(
                -bundleWidth, bundleWidth
            );

            const individualSpan =
                halfSpan + random(-0.025, 0.025);

            const startDirection = normal.clone()
                .addScaledVector(
                    tangent,
                    Math.tan(individualSpan)
                )
                .addScaledVector(bundleAxis, startOffset)
                .normalize();

            const endDirection = normal.clone()
                .addScaledVector(
                    tangent,
                    -Math.tan(individualSpan)
                )
                .addScaledVector(bundleAxis, endOffset)
                .normalize();

            const p0 = startDirection
                .multiplyScalar(surfaceRadius);

            const p3 = endDirection
                .multiplyScalar(surfaceRadius);

            // Individual apex direction.
            const apexDirection = p0.clone()
                .add(p3)
                .normalize();

            // Slightly different curvature for every strand.
            const individualHeight = height *
                random(0.72, 1.30);

            const asymmetry = random(-0.055, 0.055) * radius;

            const side = bundleAxis.clone()
                .addScaledVector(
                    apexDirection,
                    -bundleAxis.dot(apexDirection)
                )
                .normalize();

            const p1 = p0.clone()
                .addScaledVector(
                    apexDirection,
                    individualHeight * random(0.65, 1.0)
                )
                .addScaledVector(side, asymmetry);

            const p2 = p3.clone()
                .addScaledVector(
                    apexDirection,
                    individualHeight * random(0.65, 1.0)
                )
                .addScaledVector(side, -asymmetry);

            // Each filament receives its own gentle irregularity.
            const wobble = random(0.002, 0.012) * radius;
            const wobbleFrequency = random(0.8, 1.8);
            const wobblePhase = random(0, Math.PI * 2);

            const points = [];

            for (let i = 0; i <= segments; i++) {

                const t = i / segments;
                const u = 1 - t;

                // Cubic Bézier interpolation.
                const point = p0.clone()
                    .multiplyScalar(u * u * u)
                    .add(
                        p1.clone().multiplyScalar(
                            3 * u * u * t
                        )
                    )
                    .add(
                        p2.clone().multiplyScalar(
                            3 * u * t * t
                        )
                    )
                    .add(
                        p3.clone().multiplyScalar(
                            t * t * t
                        )
                    );

                // Subtle curvature variation along the filament.
                const wave = Math.sin(
                    t * Math.PI * wobbleFrequency +
                    wobblePhase
                ) * Math.sin(Math.PI * t);

                point.addScaledVector(
                    side,
                    wobble * wave
                );

                points.push(point);
            }

            for (let i = 0; i < points.length - 1; i++) {
                positions.push(
                    points[i].x,
                    points[i].y,
                    points[i].z,

                    points[i + 1].x,
                    points[i + 1].y,
                    points[i + 1].z
                );
            }
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
        opacity: opacity * 0.72,
        depthWrite: false,
        toneMapped: false
    });

    const magneticLines = new THREE.LineSegments(
        geometry,
        material
    );

    magneticLines.name = 'sunHologramMagneticFilaments';
    magneticLines.renderOrder = 6;
    magneticLines.raycast = () => {};

    group.add(magneticLines);

    return group;
        }
    


                
            



function makeSolarGranularSurface(THREE, radius) {
    const group = new THREE.Group();

    const geometry = new THREE.SphereGeometry(
        radius * 1.010,
        128,
        96
    );

    const material = new THREE.ShaderMaterial({
        transparent: false,
        depthWrite: true,
        depthTest: true,
        toneMapped: false,

        vertexShader: `
            varying vec3 vPosition;

            void main() {
                vPosition = normalize(position);

                gl_Position = projectionMatrix *
                    modelViewMatrix *
                    vec4(position, 1.0);
            }
        `,

        fragmentShader: `
            varying vec3 vPosition;

            float hash(vec3 p) {
                p = fract(p * 0.3183099 + 0.1);
                p *= 17.0;

                return fract(
                    p.x * p.y * p.z *
                    (p.x + p.y + p.z)
                );
            }

            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);

                f = f * f * (3.0 - 2.0 * f);

                return mix(
                    mix(
                        mix(hash(i),
                            hash(i + vec3(1,0,0)), f.x),
                        mix(hash(i + vec3(0,1,0)),
                            hash(i + vec3(1,1,0)), f.x),
                        f.y
                    ),
                    mix(
                        mix(hash(i + vec3(0,0,1)),
                            hash(i + vec3(1,0,1)), f.x),
                        mix(hash(i + vec3(0,1,1)),
                            hash(i + vec3(1,1,1)), f.x),
                        f.y
                    ),
                    f.z
                );
            }

            float fbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.5;

                for (int i = 0; i < 5; i++) {
                    value += noise(p) * amplitude;
                    p *= 2.0;
                    amplitude *= 0.5;
                }

                return value;
            }

            void main() {
                vec3 p = normalize(vPosition);

                float broad = fbm(p * 12.0);
                float medium = fbm(p * 42.0);
                float fine = fbm(p * 110.0);

                float textureValue =
                    broad * 0.20 +
                    medium * 0.50 +
                    fine * 0.30;

                // Dark golden-yellow palette
                vec3 deepAmber = vec3(0.30, 0.075, 0.004);
                vec3 darkGold  = vec3(0.48, 0.155, 0.008);
                vec3 warmGold  = vec3(0.72, 0.305, 0.018);

                float broadVariation = smoothstep(
                    0.28, 0.55, textureValue
                );

                vec3 colour = mix(
                    deepAmber,
                    darkGold,
                    broadVariation
                );

                colour = mix(
                    colour,
                    warmGold,
                    smoothstep(0.48, 0.66, textureValue) * 0.55
                );

                // Fine dark and bright granular contrast
                float granules = smoothstep(
                    0.43, 0.72, fine
                );

                colour *= 0.78 + granules * 0.42;

                gl_FragColor = vec4(colour, 1.0);
            }
        `
    });

    const surface = new THREE.Mesh(geometry, material);

    surface.name = 'sunHologramGranularSurface';
    surface.renderOrder = 4;
    surface.raycast = () => {};

    group.add(surface);

    return group;
}


function makeSolarAccents(THREE, radius) {
    const group = new THREE.Group();

    const geometry = new THREE.SphereGeometry(
        radius * 1.014,
        96,
        64
    );

    const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,

        vertexShader: `
            varying vec2 vUv;

            void main() {
                vUv = uv;

                gl_Position = projectionMatrix *
                    modelViewMatrix *
                    vec4(position, 1.0);
            }
        `,

        fragmentShader: `
            varying vec2 vUv;

            float hash(vec2 p) {
                return fract(
                    sin(dot(p, vec2(127.1, 311.7))) *
                    43758.5453
                );
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);

                f = f * f * (3.0 - 2.0 * f);

                return mix(
                    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                    mix(hash(i + vec2(0.0, 1.0)),
                        hash(i + vec2(1.0, 1.0)), f.x),
                    f.y
                );
            }

            float fbm(vec2 p) {
                float value = 0.0;
                float amplitude = 0.5;

                for (int i = 0; i < 4; i++) {
                    value += noise(p) * amplitude;
                    p *= 2.0;
                    amplitude *= 0.5;
                }

                return value;
            }

            float solarPatch(
                vec2 uv,
                vec2 centre,
                vec2 size,
                float strength
            ) {
                vec2 d = uv - centre;

                // Wrap horizontally across the sphere's UV seam.
                d.x -= round(d.x);

                // Distort the boundary to avoid circular patches.
                float distortion = fbm(uv * 75.0) * 0.18;

                d.x /= size.x;
                d.y /= size.y;

                float distanceFromCentre = length(d);

                distanceFromCentre +=
                    (fbm(uv * 115.0) - 0.5) * distortion;

                float outer = 1.0 - smoothstep(
                    0.65,
                    1.35,
                    distanceFromCentre
                );

                float core = 1.0 - smoothstep(
                    0.0,
                    0.75,
                    distanceFromCentre
                );

                return (outer * 0.55 + core * 0.75) * strength;
            }

            void main() {
                vec2 uv = vUv;

                float patches = 0.0;

                // Large, bright active regions.
                patches += solarPatch(
                    uv, vec2(0.15, 0.66),
                    vec2(0.045, 0.075), 1.0
                );

                patches += solarPatch(
                    uv, vec2(0.38, 0.35),
                    vec2(0.060, 0.090), 0.85
                );

                patches += solarPatch(
                    uv, vec2(0.65, 0.72),
                    vec2(0.050, 0.065), 0.95
                );

                patches += solarPatch(
                    uv, vec2(0.85, 0.42),
                    vec2(0.035, 0.070), 0.75
                );

                // Smaller secondary regions.
                patches += solarPatch(
                    uv, vec2(0.25, 0.18),
                    vec2(0.025, 0.045), 0.65
                );

                patches += solarPatch(
                    uv, vec2(0.53, 0.53),
                    vec2(0.030, 0.050), 0.70
                );

                patches += solarPatch(
                    uv, vec2(0.75, 0.20),
                    vec2(0.035, 0.040), 0.60
                );

                patches += solarPatch(
                    uv, vec2(0.94, 0.83),
                    vec2(0.025, 0.050), 0.70
                );

                patches = clamp(patches, 0.0, 1.0);

                // Fine surface mottling.
                float detail = fbm(uv * 180.0);
                float variation = 0.75 + detail * 0.5;

                // Amber edges transitioning to bright yellow centres.
                vec3 amber = vec3(1.0, 0.34, 0.025);
                vec3 gold = vec3(1.0, 0.67, 0.08);
                vec3 yellow = vec3(1.0, 0.92, 0.42);

                vec3 colour = mix(
                    amber,
                    gold,
                    smoothstep(0.15, 0.65, patches)
                );

                colour = mix(
                    colour,
                    yellow,
                    smoothstep(0.65, 1.0, patches)
                );

                float alpha = patches * variation * 0.72;

                if (alpha < 0.015) discard;

                gl_FragColor = vec4(
                    colour * variation,
                    alpha
                );
            }
        `
    });

    const surface = new THREE.Mesh(geometry, material);

    surface.name = 'sunHologramSolarAccents';
    surface.renderOrder = 5;
    surface.raycast = () => {};

    group.add(surface);

    return group;
}




    function makeUnderlay(radius, color) {
        const geometry = new THREE.SphereGeometry(radius * 1.006, 32, 24);
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

        let ocean = null;

        let continents = null;
        if (type === 'earth') {
            continents = makeContinentOutlines(
                radius * 1.012,                 // clearly below the grid
                config.continentColor,
                config.continentOpacity
            );
            continents.name = 'earthHologramContinents';
            children.push(continents);
            ocean = makeEarthOceanSurface(THREE, radius);
            group.add(ocean);
        }

        let grid = null;
        let gridGlow = null;

        if (type === 'earth') {
            grid = makeGrid(radius * 1.018, config.gridColor, config.gridOpacity, 4);
            grid.name = 'earthHologramGrid';
            children.push(grid);

            gridGlow = makeGrid(radius * 1.021, config.glowColor, config.glowOpacity, 5);
            gridGlow.name = 'earthHologramGridGlow';
            children.push(gridGlow);
        }

       let magnetic = null;
        let granular = null;
        let accents = null;

        if (type === 'sun') {
            magnetic = makeMagneticLoops(
                radius,
                config.magneticColor,
                config.magneticOpacity
            );

            magnetic.name = 'sunHologramMagneticField';
            children.push(magnetic);

            // Dark granular solar surface
            granular = makeSolarGranularSurface(THREE, radius);
            group.add(granular);

            // Existing yellow active-region patches
            accents = makeSolarAccents(THREE, radius);
            group.add(accents);
        }

        group.add(...children);
        body.add(group);

        attached.set(body, {
        group,
        underlay,
        magnetic,
        granular,
        accents,
        continents,
        ocean,
        grid,
        gridGlow,
        type
    });
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
            if (effect.grid) {
                effect.grid.geometry.dispose();
                effect.grid.material.dispose();
            }

            if (effect.gridGlow) {
                effect.gridGlow.geometry.dispose();
                effect.gridGlow.material.dispose();
            }
            if (effect.magnetic) {
            for (const line of effect.magnetic.children) {
                line.geometry.dispose();
                line.material.dispose();
            }
            }

            if (effect.ocean) {
                for (const mesh of effect.ocean.children) {
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                }

                if (effect.ocean.userData.landMaskTexture) {
                    effect.ocean.userData.landMaskTexture.dispose();
                }
            }

            if (effect.granular) {
                for (const mesh of effect.granular.children) {
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                }
            }
            if (effect.accents) {
                for (const mesh of effect.accents.children) {
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                }
            }
        }
        attached.clear();
    }

    return { attachEarth, attachSun, setEnabled, setBodyEnabled, dispose };
}
