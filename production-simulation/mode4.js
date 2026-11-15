/* ==========================================
   MODE 4
   Lightweight Solar System foundation
   Milestone 1
   ========================================== */

import * as THREE from
    'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
	
	
let mode4Running = true;

document.addEventListener(
    'visibilitychange',
    () => {

        mode4Running =
            !document.hidden;
    }
);


/* ------------------------------------------
   Container
   ------------------------------------------ */

const container =
    document.getElementById('mode4Scene');
	
const backToOrbitButton =
    document.getElementById('mode4BackToOrbit');
	


function updateFocusControls() {
	const sunInfo =
    document.getElementById('mode4SunInfo');
	
    if (backToOrbitButton) {
        backToOrbitButton.style.display =
            (earthFocused || sunFocused) ? 'block' : 'none';
    }
	
	if(sunInfo) {
    sunInfo.style.display =
        sunFocused ? 'block' : 'none';
	}

	if (focusEarthButton) {
    focusEarthButton.style.display =
        (!earthFocused && !sunFocused) ? 'block' : 'none';
	}
}

backToOrbitButton?.addEventListener(
    'click',
    returnToOrbit
);


if (!container) {
    throw new Error(
        'Mode 4: #mode4Scene not found'
    );
}


/* ------------------------------------------
   Focus Earth button
   ------------------------------------------ */

const focusEarthButton = document.createElement('button');

focusEarthButton.id = 'mode4FocusEarth';
focusEarthButton.type = 'button';
focusEarthButton.textContent = 'Earth';
focusEarthButton.setAttribute(
    'aria-label',
    'Focus on Earth'
);

Object.assign(focusEarthButton.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    transform: 'translate(-50%, -50%)',
    zIndex: '10',
    display: 'block',
    padding: '6px 9px',
    border: '1px solid rgba(120, 145, 165, 0.45)',
    borderRadius: '5px',
    background: 'rgba(2, 5, 10, 0.72)',
    color: '#aab6c2',
    fontFamily: 'Arial, sans-serif',
    fontSize: '8px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    touchAction: 'manipulation'
});

focusEarthButton.addEventListener('click', () => {
    focusEarth();
});

container.appendChild(focusEarthButton);

function updateFocusEarthButtonPosition() {
    if (earthFocused || sunFocused) {
        focusEarthButton.style.display = 'none';
        return;
    }

    const projected = earth.position.clone();

    earth.getWorldPosition(projected);
    projected.project(camera);

    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;

    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;

    const visible =
        projected.z > -1 &&
        projected.z < 1 &&
        x >= 0 && x <= width &&
        y >= 0 && y <= height;

    focusEarthButton.style.display = visible ? 'block' : 'none';

    if (visible) {
        focusEarthButton.style.left = `${x}px`;
		focusEarthButton.style.top = `${y + (window.matchMedia('(max-width: 650px)').matches ? -36 : 24)}px`;
    }
}


const scene =
    new THREE.Scene();

scene.background =
    new THREE.Color(0x02050a);

const camera =
    new THREE.PerspectiveCamera(
        42,
        1,
        0.1,
        100
    );

camera.position.set(
    0,
    8,
    10
);

camera.lookAt(0, 0, 0);


/* ------------------------------------------
   Earth interaction
   Milestone 5
   ------------------------------------------ */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let earthFocused = false;
let sunFocused = false;
let cameraTransition = false;
let selectedLocation = null;

const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();

let dragActive = false;
let dragged = false;
let pointerStartX = 0;
let pointerStartY = 0;
let previousPointerX = 0;
let previousPointerY = 0;

const tapIndicator =
    document.getElementById('mode4TapIndicator');

const renderer =
    new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance'
    });

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.5)
);

container.appendChild(
    renderer.domElement
);

/* ------------------------------------------
   Mode 4 — Earth location HUD
   ------------------------------------------ */

const locationHUD = document.createElement('div');

locationHUD.id = 'mode4LocationHUD';

Object.assign(locationHUD.style, {
    position: 'absolute',
    left: '18px',
    bottom: '18px',
    zIndex: '10',
    padding: '12px 15px',
    color: '#d8e2ea',
    background: 'rgba(2, 5, 10, 0.78)',
    border: '1px solid rgba(120, 145, 165, 0.3)',
    borderRadius: '6px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '10px',
    lineHeight: '1.7',
    letterSpacing: '0.04em',
    pointerEvents: 'none',
    minWidth: 'auto',
	
});

locationHUD.innerHTML = `
    <div style="
        color:#65bce5;
        font-size:10px;
        letter-spacing:0.14em;
        margin-bottom:5px;
    ">EARTH LOCATION</div>
    <div id="mode4LocationStatus">
        Focus Earth to inspect<br>a location
    </div>
    <div id="mode4LocationLatitude">LAT&nbsp; —</div>
    <div id="mode4LocationLongitude">LON&nbsp; —</div>
`;

container.appendChild(locationHUD);

const satellitePreview = document.createElement('div');
satellitePreview.id = 'mode4SatellitePreview';

Object.assign(satellitePreview.style, {
    position: 'absolute',
    left: '18px',
    bottom: '150px',
    width: '210px',
    height: '130px',
    zIndex: '11',
    display: 'none',
    overflow: 'hidden',
    background: '#02050a',
    border: '1px solid rgba(120, 145, 165, 0.4)',
    borderRadius: '6px',
    pointerEvents: 'auto',
    boxSizing: 'border-box'
});

const satelliteMap = document.createElement('iframe');

satelliteMap.id = 'mode4SatelliteMap';
satelliteMap.title = 'Selected location satellite imagery';

Object.assign(satelliteMap.style, {
    display: 'block',
    width: '100%',
    height: '100%',
    border: '0'
});

satelliteMap.loading = 'lazy';
satelliteMap.allowFullscreen = true;
satelliteMap.referrerPolicy = 'strict-origin-when-cross-origin';

const satelliteExpand = document.createElement('button');

satelliteExpand.id = 'mode4SatelliteExpand';
satelliteExpand.type = 'button';
satelliteExpand.textContent = '⛶';
satelliteExpand.setAttribute(
    'aria-label',
    'Expand satellite imagery'
);

Object.assign(satelliteExpand.style, {
    position: 'absolute',
    top: '5px',
    right: '5px',
    width: '30px',
    height: '30px',
    padding: '0',
    border: '1px solid rgba(180, 200, 215, 0.5)',
    borderRadius: '4px',
    background: 'rgba(2, 5, 10, 0.85)',
    color: '#fff',
    fontSize: '19px',
    cursor: 'pointer',
    zIndex: '2'
});

satellitePreview.appendChild(satelliteMap);
satellitePreview.appendChild(satelliteExpand);
container.appendChild(satellitePreview);


function setSatellitePreviewExpanded(expanded) {
    Object.assign(satellitePreview.style, expanded ? {
        position: 'fixed',
        left: '5vw',
        top: '5vh',
        bottom: 'auto',
        width: '90vw',
        height: '90vh',
        zIndex: '1000',
        borderRadius: '10px'
    } : {
        position: 'absolute',
        left: '18px',
        top: 'auto',
        bottom: '150px',
        width: '210px',
        height: '130px',
        zIndex: '11',
        borderRadius: '6px'
    });

    satelliteExpand.textContent = expanded ? '×' : '⛶';

    satelliteExpand.setAttribute(
        'aria-label',
        expanded
            ? 'Collapse satellite imagery'
            : 'Expand satellite imagery'
    );
}

satelliteExpand.addEventListener('click', () => {
    const expanded =
        satellitePreview.dataset.expanded !== 'true';

    satellitePreview.dataset.expanded = String(expanded);
    setSatellitePreviewExpanded(expanded);
});

const MODE4_GOOGLE_MAPS_API_KEY =
    'AIzaSyArmgQYUzlR7znYOjzJ80Qi5-u4qrZf4rI';

function updateMode4SatellitePreview(latitude, longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 || lat > 90 ||
        lon < -180 || lon > 180
    ) return;

	satelliteMap.src =
    'https://www.google.com/maps/embed/v1/view' +
    '?key=' + encodeURIComponent(MODE4_GOOGLE_MAPS_API_KEY) +
    '&center=' + lat + ',' + lon +
    '&zoom=10&maptype=satellite';

    satellitePreview.style.display = 'block';
    satellitePreview.dataset.expanded = 'false';
    setSatellitePreviewExpanded(false);
}


const locationStatus = locationHUD.querySelector(
    '#mode4LocationStatus'
);

const locationLatitude = locationHUD.querySelector(
    '#mode4LocationLatitude'
);

const locationLongitude = locationHUD.querySelector(
    '#mode4LocationLongitude'
);



let countryLookupSequence = 0;

const countryFeaturesPromise = fetch(
    'countries.geojson'
)
    .then(response => {
        if (!response.ok) {
            throw new Error(
                `Country data HTTP ${response.status}`
            );
        }

        return response.json();
    })
    .then(data => data.features);

// Test whether a coordinate lies inside a polygon ring.
function pointInCountryRing(lon, lat, ring) {
    let inside = false;

    for (
        let i = 0, j = ring.length - 1;
        i < ring.length;
        j = i++
    ) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];

        if (
            (yi > lat) !== (yj > lat) &&
            lon < (xj - xi) * (lat - yi) /
                (yj - yi) + xi
        ) {
            inside = !inside;
        }
    }

    return inside;
}

function pointInCountryPolygon(lon, lat, rings) {
    // Must be inside the outer boundary.
    if (!pointInCountryRing(lon, lat, rings[0])) {
        return false;
    }

    // Exclude holes, such as lakes.
    for (let i = 1; i < rings.length; i++) {
        if (pointInCountryRing(lon, lat, rings[i])) {
            return false;
        }
    }

    return true;
}

function findCountryAtCoordinates(lon, lat, features) {
    for (const feature of features) {
        const geometry = feature.geometry;
        if (!geometry) continue;

        const polygons =
            geometry.type === 'Polygon'
                ? [geometry.coordinates]
                : geometry.type === 'MultiPolygon'
                    ? geometry.coordinates
                    : [];

        for (const polygon of polygons) {
            if (pointInCountryPolygon(lon, lat, polygon)) {
                return (
                    feature.properties.ADMIN ||
                    feature.properties.NAME ||
                    feature.properties.name ||
                    null
                );
            }
        }
    }

    return null;
}

// Call this after your existing Earth coordinate calculation.
async function lookupEarthCountry(latitude, longitude) {
    const requestId = ++countryLookupSequence;

    const lat = Number(latitude);
    const lon = Number(longitude);

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 || lat > 90 ||
        lon < -180 || lon > 180
    ) {
        return;
    }

    const coordinates =
        `Lat ${lat.toFixed(4)}°, Lon ${lon.toFixed(4)}°`;

    locationStatus.textContent =
        `Identifying country… · ${coordinates}`;

    try {
        const features = await countryFeaturesPromise;

        // Ignore an older result if another point was selected.
        if (requestId !== countryLookupSequence) return;

        const country = findCountryAtCoordinates(
            lon,
            lat,
            features
        );

        locationStatus.textContent = country
            ? `${country}`
            : `Ocean or country unavailable · ${coordinates}`;

    } catch (error) {
        console.warn('Country data unavailable:', error);

        if (requestId === countryLookupSequence) {
            locationStatus.textContent =
                `Country data unavailable · ${coordinates}`;
        }
    }
}


function updateLocationHUD() {
    if (!selectedLocation) {
        locationLatitude.textContent = 'LAT  —';
        locationLongitude.textContent = 'LON  —';
        return;
    }

    const lat = selectedLocation.latitude;
    const lon = selectedLocation.longitude;

    locationLatitude.textContent =
        `LAT  ${lat >= 0 ? '+' : ''}${lat.toFixed(4)}°`;

    locationLongitude.textContent =
        `LON  ${lon >= 0 ? '+' : ''}${lon.toFixed(4)}°`;
		
	lookupEarthCountry(lat, lon);	
	
	updateMode4SatellitePreview(lat, lon);
}

function verifyEarthCoordinate(
    actualLatitude,
    actualLongitude,
    expectedLatitude,
    expectedLongitude,
    tolerance = 2
) {
    const latitudeError = Math.abs(
        actualLatitude - expectedLatitude
    );

    const longitudeDifference = Math.abs(
        actualLongitude - expectedLongitude
    );

    const longitudeError = Math.min(
        longitudeDifference,
        360 - longitudeDifference
    );

    const passed =
        latitudeError <= tolerance &&
        longitudeError <= tolerance;

    console.info('Earth coordinate calibration:', {
        actualLatitude,
        actualLongitude,
        expectedLatitude,
        expectedLongitude,
        latitudeError,
        longitudeError,
        tolerance,
        passed
    });

    return passed;
}

verifyEarthCoordinate(
    1.35,    // observed latitude: replace with HUD value
    103.82,  // observed longitude: replace with HUD value
    1.35,    // expected latitude
    103.82   // expected longitude
);


function showTapIndicator(hit) {
    if (!hit) return;

    const point = hit.point.clone();
    point.project(camera);

    const rect = renderer.domElement.getBoundingClientRect();

    tapIndicator.style.left =
        `${rect.left + (point.x * 0.5 + 0.5) * rect.width}px`;

    tapIndicator.style.top =
        `${rect.top + (-point.y * 0.5 + 0.5) * rect.height}px`;

    tapIndicator.style.display = 'block';
}


/* ------------------------------------------
   Solar System group
   ------------------------------------------ */

const solarSystem =
    new THREE.Group();

scene.add(
    solarSystem
);


/* ------------------------------------------
   Sun
   ------------------------------------------ */

const sunGeometry =
    new THREE.SphereGeometry(
        1.35,
        32,
        24
    );


const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff
});

const sunTextureLoader = new THREE.TextureLoader();

sunTextureLoader.load(
    'sunmap3.jpg',
    function (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        sunMaterial.map = texture;
		sunMaterial.color.setScalar(1.2);
        sunMaterial.needsUpdate = true;

        console.info('Mode 4: Sun texture loaded');
    },
    undefined,
    function (error) {
        console.warn(
            'Mode 4: Sun texture unavailable; using plain Sun.',
            error
        );
    }
);


const sun =
    new THREE.Mesh(
        sunGeometry,
        sunMaterial
    );

sun.position.set(
    0,
    0,
    0
);

solarSystem.add(
    sun
);




/* ------------------------------------------
   Subtle Sun glow
   ------------------------------------------ */

const glowGeometry =
    new THREE.SphereGeometry(
        1.58,  // was 1.48
        24,
        16
    );

const glowMaterial =
    new THREE.MeshBasicMaterial({
        color: 0xff7a00,
        transparent: true,
        opacity: 0.06, // was 0.08
        side: THREE.BackSide
    });

const sunGlow =
    new THREE.Mesh(
        glowGeometry,
        glowMaterial
    );

sun.add(
    sunGlow
);


/* ------------------------------------------
   Sun observation views
   ------------------------------------------ */

const solarViews = {
    atmosphere: {
        label: '3D',
        type: 'sphere'
    },
    atmosphere2: {
        label: 'ATMOSPHERIC VIEW · AIA 304 Å',
        url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0304.jpg'
    },
    continuum: {
        label: 'HMI CONTINUUM',
        url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg'
    },
    magnetogram: {
        label: 'HMI MAGNETOGRAM',
        url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIBC.jpg'
    }
};

let activeSolarView = 'atmosphere';

const solarViewUI = document.createElement('div');
solarViewUI.id = 'mode4SolarViewUI';

Object.assign(solarViewUI.style, {
    position: 'absolute',
    top: '104px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 24px)',
    maxWidth: '420px',
    zIndex: '12',
    display: 'none',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box'
});

const solarViewButtons = document.createElement('div');

Object.assign(solarViewButtons.style, {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '5px',
    marginBottom: '8px'
});

solarViewUI.appendChild(solarViewButtons);

const solarViewPanel = document.createElement('div');
solarViewPanel.id = 'mode4SolarViewPanel';

Object.assign(solarViewPanel.style, {
    display: 'none',
    width: '100%',
    padding: '8px',
    boxSizing: 'border-box',
    background: 'rgba(2, 5, 10, 0.92)',
    border: '1px solid rgba(120, 145, 165, 0.4)',
    borderRadius: '6px'
});

const solarViewImage = document.createElement('img');

solarViewImage.alt = 'NASA SDO full-disk solar observation';
solarViewImage.loading = 'lazy';
solarViewImage.decoding = 'async';

Object.assign(solarViewImage.style, {
    display: 'block',
    width: '100%',
    height: 'auto',
    maxHeight: 'min(42vh, 320px)',
    objectFit: 'contain',
    background: '#000'
});

const solarViewCaption = document.createElement('div');

Object.assign(solarViewCaption.style, {
    marginTop: '7px',
    color: '#d8e2ea',
    fontSize: '10px',
    lineHeight: '1.5',
    letterSpacing: '0.08em',
    textAlign: 'center'
});


const solarViewImageFrame = document.createElement('div');
solarViewImageFrame.id = 'mode4SolarImageFrame';

Object.assign(solarViewImageFrame.style, {
    width: '100%',
    height: '73vh',
    maxHeight: '73dvh',
    aspectRatio: 'auto',
    overflow: 'hidden',
    position: 'relative',
    background: '#000',
    cursor: 'crosshair',
    touchAction: 'manipulation'
});

Object.assign(solarViewImage.style, {
    width: '100%',
    height: '100%',
    maxHeight: 'none',
    objectFit: 'contain',
    transform: 'scale(1)',
    transformOrigin: '50% 50%',
    transition: 'transform 0.25s ease',
    cursor: 'crosshair'
});

solarViewImageFrame.appendChild(solarViewImage);

const solarZoomBack = document.createElement('button');
solarZoomBack.type = 'button';
solarZoomBack.textContent = '← Back';

Object.assign(solarZoomBack.style, {
    display: 'none',
    marginTop: '8px',
    padding: '7px 11px',
    border: '1px solid #59636d',
    borderRadius: '5px',
    background: '#080d14',
    color: '#d8e2ea',
    fontSize: '11px',
    cursor: 'pointer',
    touchAction: 'manipulation'
});

solarViewPanel.appendChild(solarViewImageFrame);
solarViewPanel.appendChild(solarZoomBack);
solarViewPanel.appendChild(solarViewCaption);

let solarFeatureZoomed = false;

function resetSolarFeatureZoom() {
    solarFeatureZoomed = false;
    solarViewImage.style.transform = 'scale(1)';
    solarViewImage.style.transformOrigin = '50% 50%';
    solarZoomBack.style.display = 'none';
    solarViewImageFrame.style.cursor = 'crosshair';
}

solarViewImage.addEventListener('click', (event) => {
    if (solarFeatureZoomed) return;

    const rect = solarViewImage.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Ignore clicks outside the displayed image bounds.
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    solarFeatureZoomed = true;

    solarViewImage.style.transformOrigin =
        `${x * 100}% ${y * 100}%`;

    solarViewImage.style.transform = 'scale(5)';
    solarZoomBack.style.display = 'inline-block';
    solarViewImageFrame.style.cursor = 'zoom-out';

    solarViewCaption.textContent =
        solarViews[activeSolarView].label +
        ' · CLOSE-UP (5×)';
});

solarZoomBack.addEventListener('click', resetSolarFeatureZoom);



solarViewUI.appendChild(solarViewPanel);

container.appendChild(solarViewUI);


/* ------------------------------------------
   Background blur for solar image inspection
   ------------------------------------------ */

const solarViewBlur = document.createElement('div');
solarViewBlur.id = 'mode4SolarViewBlur';

Object.assign(solarViewBlur.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '9',
    display: 'none',
    pointerEvents: 'none',
    background: 'rgba(2, 5, 10, 0.18)',
    backdropFilter: 'blur(5px) brightness(0.65)',
    webkitBackdropFilter: 'blur(5px) brightness(0.65)',
    transition: 'opacity 0.2s ease'
});

container.appendChild(solarViewBlur);



/* Build the selector buttons */

Object.entries(solarViews).forEach(([key, view]) => {
    const button = document.createElement('button');

    button.type = 'button';
    button.textContent =
        key === 'atmosphere'
            ? '3D'
            : key === 'atmosphere2'
                ? 'Atmosphere'
                : key === 'continuum'
                    ? 'HMI Continuum'
                    : 'Magnetogram';

    button.dataset.view = key;

    Object.assign(button.style, {
        padding: '7px 9px',
        border: '1px solid #59636d',
        borderRadius: '5px',
        background: 'rgba(2, 5, 10, 0.9)',
        color: '#b8c3cc',
        fontSize: '10px',
        letterSpacing: '0.04em',
        cursor: 'pointer',
        touchAction: 'manipulation'
    });

    button.addEventListener('click', () => {
        selectSolarView(key);
    });

    solarViewButtons.appendChild(button);
});


function selectSolarView(key) {
    const view = solarViews[key];

    if (!view) return;

    activeSolarView = key;
	
	resetSolarFeatureZoom();

	solarViewBlur.style.display =
    key === 'atmosphere' ? 'none' : 'block';

    solarViewButtons.querySelectorAll('button').forEach(button => {
        const selected = button.dataset.view === key;

        button.style.borderColor =
            selected ? '#ff9a45' : '#59636d';

        button.style.color =
            selected ? '#ffb36b' : '#b8c3cc';

        button.setAttribute(
            'aria-pressed',
            String(selected)
        );
    });

    const sunInfo = document.getElementById('mode4SunInfo');

    if (sunInfo) {
        sunInfo.innerHTML =
            'SUN <span>·</span> ' + view.label;
    }

    if (key === 'atmosphere') {
        // Keep the existing TIFF-derived sphere unchanged.
        solarViewPanel.style.display = 'none';
        return;
    }

    solarViewPanel.style.display = 'block';
    solarViewCaption.textContent = view.label;

    // Load each image only when selected.
    if (solarViewImage.dataset.loadedUrl !== view.url) {
        solarViewImage.style.visibility = 'hidden';
        solarViewCaption.innerHTML =
            view.label + ' · <span style="color:#FFC30E">EXTRACTING latest NASA image</span>';

        const image = new Image();

        image.onload = () => {
            solarViewImage.src = image.src;
            solarViewImage.dataset.loadedUrl = view.url;
            solarViewImage.style.visibility = 'visible';
            solarViewCaption.textContent = view.label;
        };

        image.onerror = () => {
            solarViewCaption.textContent =
                view.label + ' · IMAGE UNAVAILABLE';
        };

        image.src = view.url;
    } else {
        solarViewImage.style.visibility = 'visible';
    }
	
	hideTapIndicator();
}


function showSolarViewSelector() {
    solarViewUI.style.display = 'block';

    // Each time Sun focus is entered, start with the
    // existing atmospheric sphere as the selected view.
    selectSolarView('atmosphere');
}


function hideSolarViewSelector() {
    solarViewUI.style.display = 'none';
    solarViewPanel.style.display = 'none';
	solarViewBlur.style.display = 'none';
	resetSolarFeatureZoom();
}



/* ------------------------------------------
   Earth
   ------------------------------------------ */

/*
 * Visual scale is intentionally exaggerated.
 *
 * Real Sun/Earth ratio would make Earth almost
 * invisible at this viewing distance.
 */

const earthGeometry =
    new THREE.SphereGeometry(
        0.22,
        24,
        16
    );
	
	
const earthMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0
    });

const earth =
    new THREE.Mesh(
        earthGeometry,
        earthMaterial
    );
	
// Align the NASA texture so the
// Prime Meridian becomes our reference.

earth.rotation.y = Math.PI;

earth.position.set(
    5.2,
    0,
    0
);

solarSystem.add(
    earth
);



const uv = earthGeometry.attributes.uv;
const position = earthGeometry.attributes.position;

console.info('Earth texture mapping:', {
    firstVertex: {
        x: position.getX(0),
        y: position.getY(0),
        z: position.getZ(0)
    },
    firstUV: {
        u: uv.getX(0),
        v: uv.getY(0)
    },
    textureRotation: earthMaterial.map?.rotation ?? 0,
    textureCenter: earthMaterial.map?.center
});



/* ------------------------------------------
   Earth texture
   Milestone 3
   ------------------------------------------ */

const earthTextureLoader =
    new THREE.TextureLoader();

earthTextureLoader.load(
    'bluemarble-5400.jpg',

    function (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;

        earthMaterial.map = texture;
        earthMaterial.needsUpdate = true;
		
		

console.info('Earth texture orientation test:', {
    imageWidth: texture.image?.width,
    imageHeight: texture.image?.height,
    textureRotation: texture.rotation,
    textureCenter: {
        x: texture.center.x,
        y: texture.center.y
    },
    textureFlipY: texture.flipY,
    earthRotationOffsetDeg:
        THREE.MathUtils.radToDeg(earthRotationOffset)
});

        console.info(
            'Mode 4: Earth texture loaded'
        );
    },

    undefined,

    function (error) {
        console.warn(
            'Mode 4: Earth texture unavailable; using blue fallback.',
            error
        );
    }
);


/* ------------------------------------------
   Earth's simple atmosphere
   ------------------------------------------ */

const earthAtmosphereGeometry =
    new THREE.SphereGeometry(
        0.235,
        20,
        14
    );

const earthAtmosphereMaterial =
    new THREE.MeshBasicMaterial({
        color: 0x4bb7df,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide
    });

const earthAtmosphere =
    new THREE.Mesh(
        earthAtmosphereGeometry,
        earthAtmosphereMaterial
    );

earth.add(
    earthAtmosphere
);


const earthCameraControls = document.createElement('div');
earthCameraControls.id = 'mode4EarthCameraControls';

earthCameraControls.innerHTML = `
    <div class="earthCameraTitle">EARTH VIEW</div>

    <label for="earthCameraDistance">
        Zoom
        <span id="earthCameraDistanceValue">1.00×</span>
    </label>
    <input id="earthCameraDistance"
           type="range" min="0.4" max="2.5"
           step="0.01" value="1">

    <label for="earthCameraLongitude">
        Angle
        <span id="earthCameraLongitudeValue">−90°</span>
    </label>
    <input id="earthCameraLongitude"
           type="range" min="-180" max="180"
           step="1" value="-90">

    <button id="earthCameraReset" type="button">
        Reset
    </button>
`;

container.appendChild(earthCameraControls);

const earthDistanceInput =
    earthCameraControls.querySelector('#earthCameraDistance');

const earthLongitudeInput =
    earthCameraControls.querySelector('#earthCameraLongitude');

const earthDistanceValue =
    earthCameraControls.querySelector('#earthCameraDistanceValue');

const earthLongitudeValue =
    earthCameraControls.querySelector('#earthCameraLongitudeValue');
	
earthDistanceInput.value = '1';
earthLongitudeInput.value = '-90';

earthDistanceValue.textContent = '1.00×';
earthLongitudeValue.textContent = '−90°';

function applyEarthCameraControls() {
    if (!earthFocused) return;

    const distanceScale = Number(earthDistanceInput.value);
    const longitude = Number(earthLongitudeInput.value);
    const angle = THREE.MathUtils.degToRad(longitude);
    const focusScale = getMode4FocusScale();

    // Preserve the existing default camera elevation and
    // change its horizontal position around Earth's longitude.
    const localOffset = new THREE.Vector3(
        Math.cos(angle) * 0.65 * distanceScale * focusScale,
        0.30 * distanceScale * focusScale,
        -Math.sin(angle) * 0.65 * distanceScale * focusScale
    );

    // Convert the local offset to world coordinates so the
    // camera follows the rotating Earth texture.
    earth.updateWorldMatrix(true, false);

    desiredLookAt.copy(
        earth.getWorldPosition(new THREE.Vector3())
    );

    desiredCameraPosition.copy(
        earth.localToWorld(localOffset)
    );

    cameraTransition = true;

    earthDistanceValue.textContent =
        distanceScale.toFixed(2) + '×';

    earthLongitudeValue.textContent =
        (longitude < 0 ? '−' : '') +
        Math.abs(longitude) + '°';
		
	hideTapIndicator();
}

earthDistanceInput.addEventListener(
    'input', applyEarthCameraControls
);

earthLongitudeInput.addEventListener(
    'input', applyEarthCameraControls
);

document.getElementById('earthCameraReset')
    .addEventListener('click', () => {
        earthDistanceInput.value = '1';
        earthLongitudeInput.value = '-90';
        applyEarthCameraControls();
    });

earthCameraControls.style.display = 'none';


/* ------------------------------------------
   Earth focus and geographic picking
   ------------------------------------------ */

function focusEarth() {
    earthFocused = true;
	sunFocused = false;
    cameraTransition = true;

    earth.updateWorldMatrix(true, false);

    earth.getWorldPosition(cameraTarget);

    // View the globe from a nearby oblique angle.
    desiredLookAt.copy(cameraTarget);

    desiredCameraPosition.copy(cameraTarget)
    .add(
	new THREE.Vector3(
	0,
    0.3 * getMode4FocusScale(),
    0.65 * getMode4FocusScale()
	)
	);

    renderer.domElement.style.cursor =
    'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 16 16%27%3E%3Ccircle cx=%278%27 cy=%278%27 r=%272%27 fill=%27none%27 stroke=%27%23ffffff%27 stroke-width=%271%27/%3E%3Cpath d=%27M8 0V5 M8 11V16 M0 8H5 M11 8H16%27 stroke=%27%2365bce5%27 stroke-width=%271%27/%3E%3C/svg%3E") 8 8, crosshair';
	
	locationStatus.textContent = 'Click Earth to inspect a point';
	
	updateFocusControls();
	
	hideSolarViewSelector();
	
	earthCameraControls.style.display = 'block';
	
	document.getElementById('mode4LocationHUD').style.display = 'block';
	
	hideTapIndicator();
	
	window.EarthLocator?.setFocusMode('earth');
	
	}


function focusSun() {
    earthFocused = false;
    sunFocused = true;

    const sunPosition = sun.getWorldPosition(
        new THREE.Vector3()
    );

    desiredLookAt.copy(sunPosition);

    desiredCameraPosition.copy(sunPosition).add(
        new THREE.Vector3(
			0,
			0.6 * getMode4FocusScale(),
			3.8 * getMode4FocusScale()
		)
    );

    cameraTransition = true;

    renderer.domElement.style.cursor = 'default';
	
	updateFocusControls();
	
	showSolarViewSelector();
	
	earthCameraControls.style.display = 'none';
	
	document.getElementById('mode4LocationHUD').style.display = 'none';
	
	hideTapIndicator();
	
	window.EarthLocator?.setFocusMode('sun');
}


function returnToOrbit() {
    earthFocused = false;
	sunFocused = false;
    cameraTransition = true;
	
	satellitePreview.style.display = 'none';
	satellitePreview.dataset.expanded = 'false';
	setSatellitePreviewExpanded(false);

    const aspect =
    container.clientWidth / container.clientHeight;

	const mobileScale = THREE.MathUtils.clamp(
		2.0 / aspect,
		1,
		3.0
	);

	desiredCameraPosition.set(
		0,
		8 * mobileScale,
		10 * mobileScale
	);
    desiredLookAt.set(0, 0, 0);

    renderer.domElement.style.cursor = 'default';
	
	locationStatus.textContent = 'Orbit view';
	
	sunFocused = false;
	
	updateFocusControls();
	
	hideSolarViewSelector();
	
	earthCameraControls.style.display = 'none';
	
	document.getElementById('mode4LocationHUD').style.display = 'none';
	
	hideTapIndicator();
	
	window.EarthLocator?.clearMarkers();
	
	window.EarthLocator?.setFocusMode('orbit');
}

function updateCameraTransition() {
    if (!cameraTransition) return;

    camera.position.lerp(
        desiredCameraPosition,
        0.055
    );

    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);

    const targetDirection = new THREE.Vector3()
        .subVectors(desiredLookAt, camera.position)
        .normalize();

    currentLookAt.lerp(targetDirection, 0.08).normalize();

    camera.lookAt(
        camera.position.clone().add(currentLookAt)
    );

    if (
        camera.position.distanceTo(desiredCameraPosition) < 0.01
    ) {
        camera.position.copy(desiredCameraPosition);
        camera.lookAt(desiredLookAt);
        cameraTransition = false;
    }
}


function getPointerIntersection(event) {
    const rect = renderer.domElement.getBoundingClientRect();

    pointer.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;

    pointer.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    return raycaster.intersectObjects(
        [sun, earth],
        false
    )[0] || null;
	
}


function selectEarthLocation(event) {
    const hit = getPointerIntersection(event);
	
	if (!hit) return;
	
	if (window.EarthLocator?.handlePointerClick(event)) {
    return;
	}

      // Convert the surface point into Earth's local coordinates.
    const localPoint = earth.worldToLocal(
        hit.point.clone()
    ).normalize();
	
		console.info('Mode 4 local surface point:', {
		x: localPoint.x,
		y: localPoint.y,
		z: localPoint.z
	});
	
	const rawLongitude = THREE.MathUtils.radToDeg(
    Math.atan2(localPoint.x, localPoint.z)
);

console.info('Mode 4 longitude diagnostic:', {
    rawLongitude,
    currentLongitude: THREE.MathUtils.euclideanModulo(
        rawLongitude + 180,
        360
    ) - 180,
    alternativeLongitude: THREE.MathUtils.euclideanModulo(
        90 - rawLongitude + 180,
        360
    ) - 180
});


console.info('Earth local axes:', {
    x: localPoint.x,
    y: localPoint.y,
    z: localPoint.z,
    longitudeFromXZ: THREE.MathUtils.radToDeg(
        Math.atan2(localPoint.x, localPoint.z)
    ),
    longitudeFromZX: THREE.MathUtils.radToDeg(
        Math.atan2(localPoint.z, localPoint.x)
    )
});

    const latitude = THREE.MathUtils.radToDeg(
        Math.asin(THREE.MathUtils.clamp(localPoint.y, -1, 1))
    );

    /*
     * SphereGeometry's texture longitude depends on its
     * UV orientation. This is the initial coordinate mapping;
     * validate against known texture landmarks before treating
     * the displayed longitude as geographically authoritative.
     */

	const longitude = THREE.MathUtils.euclideanModulo(
		THREE.MathUtils.radToDeg(
			Math.atan2(localPoint.x, localPoint.z)
		) - 90 + 180,
		360
	) - 180;


	selectedLocation = {
		latitude: Number(latitude.toFixed(4)),
		longitude: Number(longitude.toFixed(4))
	};

	updateLocationHUD();

	locationStatus.textContent = 'Surface point selected';

	console.info(
		'Selected Earth surface coordinates:',
		selectedLocation
	);
	
	showTapIndicator(hit);

}


/* ------------------------------------------
   Earth pointer controls
   ------------------------------------------ */

renderer.domElement.style.touchAction = 'none';


renderer.domElement.addEventListener(
    'pointerdown',
    (event) => {
        pointerStartX = previousPointerX = event.clientX;
        pointerStartY = previousPointerY = event.clientY;
        dragged = false;

        const hit = getPointerIntersection(event);

        if (!earthFocused && !sunFocused && hit) {
            if (hit.object === sun) {
                focusSun();
            } else {
                focusEarth();
            }
            return;
        }

        if (earthFocused) {
            dragActive = true;
            renderer.domElement.setPointerCapture(event.pointerId);
            renderer.domElement.style.cursor = 'crosshair';
        }
    }
);


renderer.domElement.addEventListener('pointermove', (event) => {
    if (!dragActive || !earthFocused) return;

    const dx = event.clientX - previousPointerX;
    const dy = event.clientY - previousPointerY;

    if (
        Math.abs(event.clientX - pointerStartX) > 4 ||
        Math.abs(event.clientY - pointerStartY) > 4
    ) {
        dragged = true;
    }

    previousPointerX = event.clientX;
    previousPointerY = event.clientY;

    // Manual Earth rotation disabled for now.
});

function hideTapIndicator() {
    tapIndicator.style.display = 'none';
}

function finishEarthPointer(event) {
    if (!dragActive) return;

    dragActive = false;

    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
    }

    renderer.domElement.style.cursor = 'crosshair';

    if (!dragged && earthFocused) {
        selectEarthLocation(event);
    }
}

renderer.domElement.addEventListener(
    'pointerup',
    finishEarthPointer
);

renderer.domElement.addEventListener(
    'pointercancel',
    (event) => {
        dragActive = false;
        dragged = false;
    }
);

window.addEventListener(
    'keydown',
    (event) => {
		if (event.key === 'Escape' && (earthFocused || sunFocused)) {
			returnToOrbit();
		}
    }
);


/* ------------------------------------------
   Orbit
   ------------------------------------------ */

const orbitRadius =
    5.2;

const orbitSegments =
    128;

const orbitPoints = [];

for (
    let i = 0;
    i <= orbitSegments;
    i++
) {

    const angle =
        (i / orbitSegments) *
        Math.PI * 2;

    orbitPoints.push(
        new THREE.Vector3(
            Math.cos(angle) * orbitRadius,
            0,
            Math.sin(angle) * orbitRadius
        )
    );
}

const orbitGeometry =
    new THREE.BufferGeometry()
        .setFromPoints(
            orbitPoints
        );

const orbitMaterial =
    new THREE.LineBasicMaterial({
        color: 0x303740,
        transparent: true,
        opacity: 0.45
    });

const orbit =
    new THREE.LineLoop(
        orbitGeometry,
        orbitMaterial
    );

solarSystem.add(
    orbit
);



/* ------------------------------------------
   Live orbital data
   Milestone 2
   ------------------------------------------ */

const EARTH_API_URL = '/api/earth';

let currentOrbitAngle = 0;
let startOrbitAngle = 0;
let targetOrbitAngle = 0;

let orbitTransitionStart = performance.now();
let orbitTransitionDuration = 1500;

let hasReceivedOrbitalData = false;
let lastFetchTime = 0;

const ORBIT_UPDATE_MS = 180000; // 3 minutes

function normalizeAngle(angle) {
    return (
        (angle % (Math.PI * 2)) +
        Math.PI * 2
    ) % (Math.PI * 2);
}

function moveEarthToAngle(angle) {
earth.position.set(
    Math.sin(angle) * orbitRadius,
    0,
    -Math.cos(angle) * orbitRadius
);
}

async function updateOrbitalData() {
    try {
        const response = await fetch(
            EARTH_API_URL,
            { cache: 'no-store' }
        );

        if (!response.ok) {
            throw new Error(
                `Astronomy API returned ${response.status}`
            );
        }

        const data = await response.json();

        const orbitalProgressDeg =
            data?.combined?.orbitalProgressDeg;

        if (
            typeof orbitalProgressDeg !== 'number' ||
            !Number.isFinite(orbitalProgressDeg)
        ) {
            throw new Error(
                'Valid combined.orbitalProgressDeg not found'
            );
        }

        const nextAngle =
            normalizeAngle(
                orbitalProgressDeg * Math.PI / 180
            );

        /*
         * Keep the first correction short.
         * Subsequent corrections span the
         * normal three-minute update interval.
         */

        startOrbitAngle = currentOrbitAngle;

        let difference =
            nextAngle - currentOrbitAngle;

        difference =
            ((difference + Math.PI) %
                (Math.PI * 2) +
                Math.PI * 2) %
                (Math.PI * 2) -
            Math.PI;

        targetOrbitAngle =
            currentOrbitAngle + difference;

        orbitTransitionStart = performance.now();

        orbitTransitionDuration =
            hasReceivedOrbitalData
                ? ORBIT_UPDATE_MS
                : 1500;

        hasReceivedOrbitalData = true;
        lastFetchTime = Date.now();

        console.info(
            'Mode 4 orbital data updated',
            orbitalProgressDeg
        );

    } catch (error) {
        console.warn(
            'Mode 4: using last known orbital position.',
            error
        );
    }
}

updateOrbitalData();

setInterval(
    updateOrbitalData,
    ORBIT_UPDATE_MS
);


/* ------------------------------------------
   Stars
   ------------------------------------------ */

const STAR_CATALOG_URL =
    'https://raw.githubusercontent.com/RTF22/Orrery/master/src/data/stars/hyg.json';

const STAR_SPHERE_RADIUS = 45;

let stars = null;

fetch(STAR_CATALOG_URL)
    .then(response => {
        if (!response.ok) {
            throw new Error('Star catalogue failed to load');
        }
        return response.json();
    })
    .then(data => {
        // Inspect the data format before rendering.
        console.log('Star catalogue sample:', data[0] ?? data);

        // Adapt these field names to the catalogue schema.
        const starsData = Array.isArray(data) ? data : data.stars;

        if (!Array.isArray(starsData)) {
            throw new Error('Unrecognized star catalogue format');
        }

        const visibleStars = starsData.filter(star =>
            Number(star.mag ?? star.m) <= 6
        );

        const positions = [];
		const magnitudes = [];
		const colorIndices = [];

		for (const star of visibleStars) {
			const ra = THREE.MathUtils.degToRad(Number(star.ra));
			const dec = THREE.MathUtils.degToRad(Number(star.dec));
			const magnitude = Number(star.mag ?? star.m);

			positions.push(
				STAR_SPHERE_RADIUS * Math.cos(dec) * Math.cos(ra),
				STAR_SPHERE_RADIUS * Math.sin(dec),
				-STAR_SPHERE_RADIUS * Math.cos(dec) * Math.sin(ra)
			);

			magnitudes.push(magnitude);
			colorIndices.push(
			Number.isFinite(Number(star.ci)) ? Number(star.ci) : 0.65
			);
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			'position',
			new THREE.Float32BufferAttribute(positions, 3)
		);
		geometry.setAttribute(
			'magnitude',
			new THREE.Float32BufferAttribute(magnitudes, 1)
		);
		
		geometry.setAttribute(
			'colorIndex',
			new THREE.Float32BufferAttribute(colorIndices, 1)
		);

		const material = new THREE.ShaderMaterial({
			transparent: true,
			depthWrite: false,
		vertexShader: `
			attribute float magnitude;
			attribute float colorIndex;

			varying float vBrightness;
			varying vec3 vStarColor;

			void main() {
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

				float brightness = clamp(
					(6.0 - magnitude) / 6.0,
					0.0,
					1.0
				);

				gl_PointSize = clamp(
					1.0 + (6.0 - magnitude) * 0.65,
					1.0,
					5.0
				);

				// Approximate stellar colour from B-V index.
				float ci = clamp(colorIndex, -0.4, 2.0);

				if (ci < 0.0) {
					vStarColor = mix(
						vec3(0.65, 0.78, 1.0),
						vec3(0.85, 0.90, 1.0),
						(ci + 0.4) / 0.4
					);
				} else if (ci < 0.4) {
					vStarColor = mix(
						vec3(0.85, 0.90, 1.0),
						vec3(1.0, 1.0, 0.92),
						ci / 0.4
					);
				} else if (ci < 1.0) {
					vStarColor = mix(
						vec3(1.0, 1.0, 0.92),
						vec3(1.0, 0.72, 0.42),
						(ci - 0.4) / 0.6
					);
				} else {
					vStarColor = mix(
						vec3(1.0, 0.72, 0.42),
						vec3(1.0, 0.42, 0.28),
						(ci - 1.0) / 1.0
					);
				}

				gl_Position = projectionMatrix * mvPosition;
				vBrightness = brightness;
			}
		`,
		fragmentShader: `
			varying float vBrightness;
			varying vec3 vStarColor;

			void main() {
				vec2 p = gl_PointCoord - vec2(0.5);

				if (length(p) > 0.5) discard;

				float intensity = 0.25 + vBrightness * 0.75;

				gl_FragColor = vec4(
					vStarColor * intensity,
					intensity
				);
			}
		`
		});

		stars = new THREE.Points(geometry, material);
		scene.add(stars);
    })
    .catch(error => {
        console.error('Mode 4 starfield:', error);
    });


/* ------------------------------------------
   Sun lighting
   ------------------------------------------ */

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        0.03
    );

scene.add(ambientLight);


const sunLight =
    new THREE.PointLight(
        0xffffff,
        80,
        0,
        2
    );

sunLight.position.set(0, 0, 0);

scene.add(sunLight);


/*
 * Earth sidereal rotation.
 * One rotation approximately every 23 h 56 min.
 */

const earthRotationRate =
    (2 * Math.PI) / 86164.0905;
	

const clock = new THREE.Clock();

const earthRotationOffset =
    Math.PI - THREE.MathUtils.degToRad(53.5);

const SUN_ROTATION_PERIOD_MS =
    27 * 24 * 60 * 60 * 1000;
/* ------------------------------------------
   Astronomical time helpers
   Milestone 4
   ------------------------------------------ */

function julianDate(date) {

    return (
        date.getTime() / 86400000 +
        2440587.5
    );
}

function greenwichMeanSiderealAngle(date) {

    const jd =
        julianDate(date);

    const d =
        jd - 2451545.0;

    let gmst =
        280.460618375 +
        360.9856473663 * d;

    gmst =
        ((gmst % 360) + 360) % 360;

    return THREE.MathUtils.degToRad(gmst);
}


/* ------------------------------------------
   Animation
   ------------------------------------------ */
let previousSunRotationTime = performance.now();


function animate() {
	
	if (!mode4Running) {

    requestAnimationFrame(
        animate
    );

    return;
	}
	

    requestAnimationFrame(animate);

    const now = performance.now();
	
	sun.rotation.y +=
    (2 * Math.PI / 1200000) *
    (now - previousSunRotationTime);

	previousSunRotationTime = now;
	

    const elapsed =
        now - orbitTransitionStart;

    const progress = Math.min(
        elapsed / orbitTransitionDuration,
        1
    );

    /*
     * Smoothly interpolate orbital position.
     */

    currentOrbitAngle =
        startOrbitAngle +
        (targetOrbitAngle - startOrbitAngle) *
        progress;

    moveEarthToAngle(currentOrbitAngle);

    /*
     * Visual Earth rotation for now.
     * Accurate Earth orientation comes later.
     */


	const gmst =
    greenwichMeanSiderealAngle(
        new Date()
    );

	earth.rotation.y =
    gmst + earthRotationOffset;
	



	const greenwichWorldDirection = new THREE.Vector3(1, 0, 0)
		.applyQuaternion(earth.getWorldQuaternion(
			new THREE.Quaternion()
		))
		.normalize();


		

	earth.updateMatrixWorld(true);

	const greenwichDirection = new THREE.Vector3(
		0, 0, 1
	);

	greenwichDirection.applyQuaternion(
		earth.getWorldQuaternion(
			new THREE.Quaternion()
		)
	);


		/*
		 * Subtle star movement.
		 */

	if (stars) {
		stars.rotation.y += 0.00001;
		}
		updateCameraTransition();

		renderer.render(scene, camera);
		
		updateFocusEarthButtonPosition();
		
		
	if (window.EarthLocator?.isInspectingSpacecraft()) {
		const spacecraftPosition =
			window.EarthLocator.getInspectionWorldPosition(new THREE.Vector3());
		const earthPosition =
			window.EarthLocator.getEarthWorldPosition(new THREE.Vector3());

		if (spacecraftPosition && earthPosition) {
			const radial = spacecraftPosition.clone()
				.sub(earthPosition)
				.normalize();

			desiredLookAt.copy(spacecraftPosition);

			desiredCameraPosition.copy(spacecraftPosition)
				.add(radial.multiplyScalar(0.125))
				.add(new THREE.Vector3(0, 0.035, 0));

			cameraTransition = true;
		}
	}

	window.EarthLocator?.update(now);
	updateCameraTransition();

}


/* ------------------------------------------
   Resize
   ------------------------------------------ */
   
function adjustMode4CameraForViewport() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width <= 0 || height <= 0) return;

    const aspect = width / height;

    const mobileScale = THREE.MathUtils.clamp(
        2.0 / aspect,
        1,
        3.0
    );

    camera.position.set(
        0,
        8 * mobileScale,
        10 * mobileScale
    );

    camera.lookAt(0, 0, 0);
} 

function getMode4FocusScale() {
    const aspect =
        container.clientWidth / container.clientHeight;

    return THREE.MathUtils.clamp(
        1.0 / aspect,
        1,
        2.2
    );
}  

function resizeMode4() {

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width <= 0 || height <= 0) {
        return false;
    }

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 1.5)
    );

    renderer.setSize(width, height, false);
	
	adjustMode4CameraForViewport();

    return true;
}

function initializeMode4Size() {

    if (resizeMode4()) {
        return;
    }

    requestAnimationFrame(
        initializeMode4Size
    );
}

// Mode 4 — discreet expandable credits
const mode4Credits = document.createElement('details');
mode4Credits.id = 'mode4Credits';

const mode4CreditsTitle = document.createElement('summary');
mode4CreditsTitle.textContent = 'ⓘ Credits';

const mode4CreditsContent = document.createElement('div');
mode4CreditsContent.innerHTML = `
    <div><strong>Earth</strong><br>
        NASA Blue Marble: Next Generation,
        NASA Earth Observatory.
        <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/"
           target="_blank" rel="noopener noreferrer">Source</a>
    </div>


	<div>
    <strong>3D Sun texture</strong><br>
    Solar System Scope.
    <a href="https://www.solarsystemscope.com/textures/"
       target="_blank" rel="noopener noreferrer">Source</a>.
    Licensed under
    <a href="https://creativecommons.org/licenses/by/4.0/"
       target="_blank" rel="noopener noreferrer">
        Creative Commons Attribution 4.0 International (CC BY 4.0)
    </a>.
    Texture adapted for 3D rendering in Astronomical Time.
	</div>


    <div><strong>Live solar observations</strong><br>
        NASA Solar Dynamics Observatory (SDO);
        AIA and HMI science teams.
        <a href="https://sdo.gsfc.nasa.gov/data/dataaccess.php"
           target="_blank" rel="noopener noreferrer">Source</a>
    </div>

    <div><strong>3D rendering</strong><br>
        Three.js ·
        <a href="https://threejs.org/" target="_blank"
           rel="noopener noreferrer">Website</a>
    </div>

	<div>
    <strong>Star catalogue</strong><br>
    HYG Database v4.1, compiled by Astronexus from the
    Hipparcos, Yale Bright Star and Gliese catalogues.
    JSON dataset sourced from
    <a href="https://github.com/RTF22/Orrery/blob/master/src/data/stars/hyg.json"
       target="_blank" rel="noopener noreferrer">RTF22/Orrery</a>,
    filtered and adapted for Astronomical Time.
    Original catalogue:
    <a href="https://github.com/astronexus/HYG-Database"
       target="_blank" rel="noopener noreferrer">HYG Database</a>.
    Licensed under
    <a href="https://creativecommons.org/licenses/by-sa/4.0/"
       target="_blank" rel="noopener noreferrer">
        CC BY-SA 4.0
    </a>.
	</div>

    <div class="mode4CreditsNote">
        Orbital graphics and visual effects by Astronomical Time.
        NASA does not endorse this application.
    </div>
`;

mode4Credits.append(mode4CreditsTitle, mode4CreditsContent);
container.appendChild(mode4Credits);


initializeMode4Size();

window.addEventListener(
    'resize',
    resizeMode4
);

// Earth Locator — initialize once the scene objects exist
if (window.EarthLocator) {
    window.EarthLocator.init({
		googleMapsApiKey: MODE4_GOOGLE_MAPS_API_KEY,
		showStreetView: (latitude, longitude) => {
			satelliteMap.src =
				'https://www.google.com/maps/embed/v1/view' +
				'?key=' + encodeURIComponent(MODE4_GOOGLE_MAPS_API_KEY) +
				'&center=' + encodeURIComponent(`${latitude},${longitude}`) +
				'&zoom=15' +
				'&maptype=satellite';

			satellitePreview.style.display = 'block';
		},
        THREE,
        container,
        earth,
        camera,
        renderer,
        raycaster,
        pointer,
		getEarthRotationOffset: () => earthRotationOffset,
		onInspectSpacecraft: () => {
			earthFocused = true;
			sunFocused = false;
			cameraTransition = true;
			renderer.domElement.style.cursor = 'default';
			earthCameraControls.style.display = 'none';
			document.getElementById('mode4LocationHUD').style.display = 'none';
			hideSolarViewSelector();
			hideTapIndicator();
		},
		onExitSpacecraftInspection: () => {
			focusEarth();
		},
        dataUrl: './eoc-earth-locator.json'
    });
}


/* ------------------------------------------
   Start
   ------------------------------------------ */

resizeMode4();

animate();