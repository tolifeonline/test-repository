let mode = 'percent',
    data = null,
    next = 0;

const $ = id => document.getElementById(id);

let introPlayed = false;
let introAnimation = null;

function days(m) {

    let n = Math.round(m);
    let d = Math.floor(n / 1440);

    n -= d * 1440;

    let h = Math.floor(n / 60);

    return `${d} days ${h} h ${n % 60} min`;
}

function setEarthPosition(angle) {

    let r = angle * Math.PI / 180;
    let rad = 42;

    Object.assign($('earth').style, {
        left: (50 + rad * Math.sin(r)) + '%',
        top: (50 - rad * Math.cos(r)) + '%'
    });
}

function setMode3EarthPosition(angle) {

    if (!mode3Orbit || !mode3Earth) {
        return;
    }

    const rect =
        mode3Orbit.getBoundingClientRect();

    const cx =
        rect.width / 2;

    const cy =
        rect.height / 2;

    const rx =
        rect.width / 2;

    const ry =
        rect.height / 2;

    const radians =
        angle * Math.PI / 180;

    mode3Earth.style.left =
        (cx + rx * Math.sin(radians)) +
        'px';

    mode3Earth.style.top =
        (cy - ry * Math.cos(radians)) +
        'px';
}

function render() {
    if (!data) return;

    // ------------------------------------------
    // New astronomical-progress values
    // ------------------------------------------

    let p = data.combined.orbitalProgressDeg;
    let pc = data.combined.orbitalProgressPercent;

    // ------------------------------------------
    // Opening orbital animation
    // ------------------------------------------

    if (!introPlayed) {

        if (introAnimation !== null) {
            cancelAnimationFrame(introAnimation);
        }

        $('value').innerHTML =
    '<span style="color:#FFC30E">Calculating…</span>';

        setEarthPosition(0);

        let start = performance.now();
        let duration = 1000;

        function animate(now) {

            let t =
                Math.min(
                    (now - start) / duration,
                    1
                );

            // Smooth ease-in / ease-out
            let eased =
                t < 0.5
                    ? 2 * t * t
                    : 1 -
                      Math.pow(
                          -2 * t + 2,
                          2
                      ) / 2;

            setEarthPosition(
                p * eased
            );

            if (t < 1) {

                introAnimation =
                    requestAnimationFrame(
                        animate
                    );

                return;
            }

            // Exact final position
            setEarthPosition(p);

            introPlayed = true;
            introAnimation = null;

            // Render final state
            render();
        }

        introAnimation =
            requestAnimationFrame(animate);

        return;
    }

    // 0° = 12 o'clock
    // 90° = 3 o'clock
    // 180° = 6 o'clock
    // 270° = 9 o'clock

    setEarthPosition(p);

    $('earthLabel').textContent =
        pc.toFixed(3) + '%';


    // ------------------------------------------
    // Main display
    // ------------------------------------------

    if (mode === 'percent') {

        $('value').textContent =
            pc.toFixed(5) + '%';

        $('label').textContent =
            'ORBITAL PROGRESS';

        $('detail').textContent =
            `Orbital position ${p.toFixed(6)}°`;

    } else {

        // This is currently not elapsed calendar time.
        // It represents the equivalent position within
        // one sidereal orbital cycle.

        let equivalentMinutes =
            pc / 100 *
            data.combined.siderealYearDays *
            1440;

        $('value').textContent =
            days(equivalentMinutes);

        $('label').textContent =
            'ORBITAL JOURNEY TIME';

        $('detail').textContent =
            pc.toFixed(5) +
            '% of ' +
            data.combined.siderealYearDays.toFixed(6) +
            ' sidereal days';
    }


    // ------------------------------------------
    // Source values
    // ------------------------------------------

    $('jpl').textContent =
        data.sources.jpl
            ? data.sources.jpl.orbitalProgressDeg.toFixed(6) + '°'
            : 'Unavailable';

    $('inpop').textContent =
        data.sources.inpop
            ? data.sources.inpop.orbitalProgressDeg.toFixed(6) + '°'
            : 'Unavailable';


    // ------------------------------------------
    // Source difference
    // ------------------------------------------

    $('difference').textContent =
        data.comparison.angularDifferenceDeg == null
            ? 'Single source'
            : data.comparison.angularDifferenceDeg.toFixed(6) + '°';


    // ------------------------------------------
    // Epoch
    // ------------------------------------------

    $('updated').textContent =
        'Ephemeris epoch: ' + data.epochUtc;


    // ------------------------------------------
    // Refresh
    // ------------------------------------------

    next = Date.now() + 60000;


    // ------------------------------------------
    // Status
    // ------------------------------------------

    $('status').textContent =
        Object.keys(data.sources).length === 2
            ? '● Two-source cross-check active'
            : '● Single-source fallback active';
			
	updateMode3();
}


async function refresh() {

    try {

        let r = await fetch(
            '/api/earth?t=' + Date.now(),
            {
                cache: 'no-store'
            }
        );

        let d = await r.json();

        if (!r.ok || !d.ok) {
            throw Error(
                d.error || 'Update failed'
            );
        }

        data = d;

        render();

        // Update Mode 2 using the same astronomical data
        updateMode2Position(d);

    } catch (e) {

        $('status').textContent =
            'Data update failed: ' + e.message;
    }
}


// ------------------------------------------
// Mode buttons
// ------------------------------------------

document
    .querySelectorAll('button')
    .forEach(b => {

        b.onclick = () => {

            document
                .querySelectorAll('button')
                .forEach(x =>
                    x.classList.remove('on')
                );

            b.classList.add('on');

            mode = b.dataset.mode;

            render();
        };
    });


// ------------------------------------------
// Refresh countdown
// ------------------------------------------

setInterval(() => {

    $('next').textContent =
        next
            ? 'Next refresh: ' +
              Math.max(
                  0,
                  Math.ceil(
                      (next - Date.now()) / 1000
                  )
              ) +
              's'
            : '—';

}, 1000);


// ------------------------------------------
// Automatic refresh
// ------------------------------------------

setInterval(refresh, 60000);

refresh();

// ==========================================
// INFORMATION DRAWERS
// ==========================================

const topInfo =
    document.getElementById('topInfo');

const bottomInfo =
    document.getElementById('bottomInfo');

const orbit =
    document.getElementById('orbit');


topInfo
    .querySelector('.info-summary')
    .addEventListener('click', () => {

        topInfo.classList.toggle('collapsed');
        topInfo.classList.toggle('expanded');

    });


bottomInfo
    .querySelector('.bottom-summary')
    .addEventListener('click', () => {

        bottomInfo.classList.toggle('collapsed');
        bottomInfo.classList.toggle('expanded');

    });


function collapseInformation(){

    topInfo.classList.remove('expanded');
    topInfo.classList.add('collapsed');

    bottomInfo.classList.remove('expanded');
    bottomInfo.classList.add('collapsed');

}


orbit.addEventListener(
    'click',
    collapseInformation
);


orbit.addEventListener(
    'keydown',
    e => {

        if(
            e.key === 'Enter' ||
            e.key === ' '
        ){

            e.preventDefault();

            collapseInformation();

        }

    }
);


// ==========================================
// SYNOPSIS
// ==========================================

const synopsisOverlay =
    document.getElementById(
        'synopsisOverlay'
    );

const synopsisContent =
    document.getElementById(
        'synopsisContent'
    );

const openSynopsis =
    document.getElementById(
        'openSynopsis'
    );

const closeSynopsis =
    document.getElementById(
        'closeSynopsis'
    );


// ==========================================
// PUBLIC SYNOPSIS DATA
// ==========================================

const orbitalSynopsis = {

    title:
        "Earth Orbital Interpretation of Time",

    version:
        "1.0",

    purpose:
        "A visual way of representing the passage of a year by following Earth's journey around the Sun.",


    parts: [

        {
            id: "concept",

            title: "The Basic Idea",

            text:
                "We normally describe time using clocks and calendars. This visualization adds another perspective: time can also be viewed as Earth's journey through space as it travels around the Sun.",

            points: [
                "Earth is continuously moving around the Sun.",
                "As Earth travels, its position along its orbit changes.",
                "That changing position is used to represent where we are within a yearly cycle.",
                "The result is an orbital interpretation of a year rather than a conventional clock."
            ]
        },


        {
            id: "year_reference",

            title: "Where the Year Begins",

            text:
                "The visualization starts each calendar year from Earth's actual astronomical position on January 1.",

            points: [
                "January 1 at 00:00:00 UTC is used as the starting reference.",
                "Earth's astronomical position at that moment becomes the reference point.",
                "The current Earth position is then compared with that starting position.",
                "The beginning of the visualized journey is defined as 0%."
            ]
        },


        {
            id: "orbital_position",

            title: "Measuring Earth's Journey",

            text:
                "The system compares Earth's position on January 1 with its current position and determines the angular distance Earth has travelled around its orbit.",

            points: [
                "Earth's position is represented by a three-dimensional position vector.",
                "The January 1 vector is the starting reference.",
                "The current vector represents Earth's present position.",
                "Both positions are measured relative to the Sun.",
                "The directed angular movement between them provides the orbital progress."
            ]
        },


        {
            id: "three_dimensional",

            title: "Why Three Dimensions Are Used",

            text:
                "Earth's orbit is not treated simply as a flat two-dimensional circle on a screen.",

            points: [
                "The calculation uses Earth's X, Y and Z position.",
                "This avoids relying only on a two-dimensional screen projection.",
                "The positions are considered relative to a fixed orbital reference plane.",
                "This provides a more consistent representation of Earth's orbital direction."
            ]
        },


        {
            id: "two_sources",

            title: "Two Astronomical Data Sources",

            text:
                "The system obtains Earth's astronomical position from two independent ephemeris sources.",

            points: [
                "JPL Horizons / DE440",
                "IMCCE Miriade / INPOP",
                "Each source provides Earth's heliocentric position.",
                "Using two sources provides an independent cross-check."
            ]
        },


        {
            id: "cross_check",

            title: "Cross-Checking the Results",

            text:
                "The two astronomical calculations are compared to show how closely the independent sources agree.",

            points: [
                "Each source independently calculates orbital progress.",
                "The difference between the two results is displayed.",
                "A small difference indicates close agreement between the two calculations.",
                "If one source is unavailable, the other can still provide the visualization."
            ]
        },


        {
            id: "combining",

            title: "Combining the Results",

            text:
                "When both sources are available, their orbital angles are combined using a circular average.",

            points: [
                "Angles wrap around at 360 degrees.",
                "They therefore cannot always be averaged like ordinary numbers.",
                "A circular mean is used instead.",
                "The resulting angle becomes the displayed combined orbital position."
            ]
        },


        {
            id: "percentage",

            title: "From Degrees to Percentage",

            text:
                "A complete orbital cycle is represented by 360 degrees.",

            formula:
                "orbitalProgressPercent = orbitalProgressDeg / 360 × 100",

            points: [
                "0° = 0%",
                "90° = 25%",
                "180° = 50%",
                "270° = 75%",
                "360° = 100%"
            ]
        },


        {
            id: "clock",

            title: "Why It Looks Like a Clock",

            text:
                "The orbital journey is displayed on a circular clock-like face so that Earth's position can be understood at a glance.",

            points: [
                "0° is displayed at 12 o'clock.",
                "90° is displayed at 3 o'clock.",
                "180° is displayed at 6 o'clock.",
                "270° is displayed at 9 o'clock.",
                "360° returns to 12 o'clock."
            ]
        },


        {
            id: "orbital_speed",

            title: "Orbital Position Is Not Calendar Time",

            text:
                "Earth does not travel around the Sun at exactly the same speed throughout its orbit.",

            points: [
                "Earth's orbit is slightly elliptical.",
                "Earth's orbital speed therefore varies during the year.",
                "50% of the orbital angle does not necessarily correspond to 50% of elapsed calendar time.",
                "The visualization represents orbital position rather than simply elapsed calendar time."
            ]
        },


        {
            id: "not_clock",

            title: "What This Is Not",

            text:
                "The visualization does not replace a conventional clock or calendar.",

            points: [
                "It does not define civil time.",
                "It does not determine the official time of day.",
                "It does not replace UTC or local time.",
                "It provides an astronomical perspective on the yearly cycle."
            ]
        },


        {
            id: "summary",

            title: "In Simple Terms",

            text:
                "This clock-like visualization interprets the progress of a year as Earth's measured journey around the Sun, starting from Earth's astronomical position on January 1 and using independent astronomical ephemerides to determine how far Earth has travelled along its orbit."
        }

    ]

};


// ==========================================
// RENDER SYNOPSIS
// ==========================================

function renderSynopsis(){

    synopsisContent.innerHTML = '';

    orbitalSynopsis.parts.forEach(part => {

        const section =
            document.createElement('section');

        const h3 =
            document.createElement('h3');

        h3.textContent =
            part.title;

        section.appendChild(h3);


        if(part.text){

            const p =
                document.createElement('p');

            p.textContent =
                part.text;

            section.appendChild(p);

        }


        if(part.formula){

            const formula =
                document.createElement('div');

            formula.className =
                'formula';

            formula.textContent =
                part.formula;

            section.appendChild(formula);

        }


        if(part.points){

            const ul =
                document.createElement('ul');

            part.points.forEach(point => {

                const li =
                    document.createElement('li');

                li.textContent =
                    point;

                ul.appendChild(li);

            });

            section.appendChild(ul);

        }


        synopsisContent.appendChild(section);

    });

}


// ==========================================
// OPEN / CLOSE
// ==========================================

openSynopsis.addEventListener(
    'click',
    e => {

        e.stopPropagation();

        renderSynopsis();

        synopsisOverlay.classList.add('open');

        synopsisOverlay.setAttribute(
            'aria-hidden',
            'false'
        );

    }
);


closeSynopsis.addEventListener(
    'click',
    () => {

        synopsisOverlay.classList.remove(
            'open'
        );

        synopsisOverlay.setAttribute(
            'aria-hidden',
            'true'
        );

    }
);


// Click outside the panel to close.

synopsisOverlay.addEventListener(
    'click',
    e => {

        if(
            e.target === synopsisOverlay
        ){

            synopsisOverlay.classList.remove(
                'open'
            );

            synopsisOverlay.setAttribute(
                'aria-hidden',
                'true'
            );

        }

    }
);


// Escape key

document.addEventListener(
    'keydown',
    e => {

        if(e.key === 'Escape'){

            synopsisOverlay.classList.remove(
                'open'
            );

            synopsisOverlay.setAttribute(
                'aria-hidden',
                'true'
            );

        }

    }
);


/* ==========================================
   COSMIC EVENT ALERTS — MODE 1
   Independent of astronomical refresh()
   ========================================== */

const cosmicAlerts = $('cosmicAlerts');
const cosmicFeatured = $('cosmicFeatured');
const cosmicAlertCategory = $('cosmicAlertCategory');
const cosmicAlertStatus = $('cosmicAlertStatus');
const cosmicAlertTitle = $('cosmicAlertTitle');
const cosmicAlertDescription = $('cosmicAlertDescription');
const cosmicAlertSource = $('cosmicAlertSource');
const cosmicAlertLink = $('cosmicAlertLink');

const cosmicAlertList = $('cosmicAlertList');
const cosmicAlertCount = $('cosmicAlertCount');
const cosmicAlertItems = $('cosmicAlertItems');


// ------------------------------------------
// Format an event for display
// ------------------------------------------

function cosmicEventTitle(event) {

    const type = String(
        event.type ||
        event.category ||
        event.kind ||
        event.eventType ||
        ''
    ).toUpperCase();

    const titles = {
        GRAVITATIONAL_WAVE: 'Gravitational-wave alert',
        CORE_COLLAPSE_SUPERNOVA: 'Supernova alert',
        HIGH_ENERGY_TRANSIENT: 'High-energy transient'
    };

    return event.title ||
        titles[type] ||
        'Cosmic event alert';
}


function cosmicEventId(event) {

    return String(
        event.id ||
        event.eventId ||
        event.supereventId ||
        'Unidentified event'
    );
}


function cosmicEventSource(event) {

    const source = event.source;

    if (source && typeof source === 'object') {
        return String(
            source.facility ||
            source.name ||
            'GCN'
        );
    }

    return String(
        event.sourceFacility ||
        event.facility ||
        source ||
        'GCN'
    );
}


function cosmicEventDescription(event) {

    if (event.description || event.summary || event.message) {
        return String(
            event.description ||
            event.summary ||
            event.message
        );
    }

    const classification =
        event.classification;

    if (
        classification &&
        typeof classification === 'object'
    ) {
        const labels = Object.entries(classification)
            .filter(([, value]) =>
                typeof value === 'number' &&
                value > 0
            )
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([name]) => name);

        if (labels.length) {
            return 'Classification: ' + labels.join(', ');
        }
    }

    if (typeof classification === 'string') {
        return 'Classification: ' + classification;
    }

    return 'A qualified astronomical alert has been received.';
}


function cosmicEventTime(event) {

    const value =
        event.receivedAtUtc ||
        event.receivedAt ||
        event.timeReceivedUtc ||
        event.updatedAtUtc ||
        event.time_created;

    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString();
}


// ------------------------------------------
// Only allow HTTPS links to trusted sources
// ------------------------------------------

function cosmicSafeUrl(event) {

    const candidate =
        event.url ||
        event.sourceUrl ||
        event.urls?.gracedb ||
        '';

    if (!candidate) {
        return null;
    }

    try {

        const url = new URL(candidate);

        const trustedHosts = [
            'gracedb.ligo.org',
            'gracedb-playground.ligo.org',
            'gcn.nasa.gov',
            'gcn.gsfc.nasa.gov'
        ];

        if (
            url.protocol !== 'https:' ||
            !trustedHosts.includes(url.hostname)
        ) {
            return null;
        }

        return url.href;

    } catch {

        return null;
    }
}


// ------------------------------------------
// Create an additional-alert list item
// ------------------------------------------

function createCosmicAlertItem(event) {

    const item = document.createElement('article');
    item.className = 'cosmic-alert-item';

    const title = document.createElement('strong');

    title.textContent =
        cosmicEventTitle(event) +
        ' · ' +
        cosmicEventId(event);

    const description = document.createElement('span');

    const details = [
        cosmicEventSource(event),
        cosmicEventTime(event),
        event.status || event.alertType || ''
    ].filter(Boolean);

    description.textContent = details.join(' · ');

    item.appendChild(title);
    item.appendChild(description);

    const url = cosmicSafeUrl(event);

    if (url) {

        const link = document.createElement('a');

        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'View source';

        link.style.display = 'block';
        link.style.marginTop = '5px';

        item.appendChild(link);
    }

    return item;
}


// ------------------------------------------
// Render the latest event and other events
// ------------------------------------------
// Temporarily brighten cosmic alerts when tapped/clicked.

let cosmicAlertOpacityTimer = null;

if (cosmicAlerts) {

    cosmicAlerts.addEventListener('click', () => {

        // Cancel any previous reset timer.
        clearTimeout(cosmicAlertOpacityTimer);

        // Set full opacity immediately.
        cosmicAlerts.style.opacity = '1';

        // Restore the original opacity after 10 seconds.
        cosmicAlertOpacityTimer = setTimeout(() => {

            cosmicAlerts.style.opacity = '0.3';

            cosmicAlertOpacityTimer = null;

        }, 10000);
    });
}


let lastCosmicAlertSignature = null;


function renderCosmicAlerts(state) {

    if (!cosmicAlerts) {
        return;
    }

    let events = Array.isArray(state?.events)
        ? state.events
        : state?.event
            ? [state.event]
            : [];

    // Defensive filtering: the server should already
    // return only active, qualified notifications.

    events = events.filter(event => {

        if (!event || typeof event !== 'object') {
            return false;
        }

        const status = String(
            event.status ||
            event.alertType ||
            ''
        ).toUpperCase();

        return (
            event.active !== false &&
            !['RETRACTED', 'RETRACTION', 'EXPIRED'].includes(status)
        );
    });

    // The featured alert is the most recently received
    // qualified event, not necessarily the highest priority.

    events.sort((a, b) => {

        const timeA = Date.parse(
            a.receivedAtUtc ||
            a.receivedAt ||
            a.timeReceivedUtc ||
            a.updatedAtUtc ||
            a.time_created ||
            ''
        ) || 0;

        const timeB = Date.parse(
            b.receivedAtUtc ||
            b.receivedAt ||
            b.timeReceivedUtc ||
            b.updatedAtUtc ||
            b.time_created ||
            ''
        ) || 0;

        return timeB - timeA;
    });
	
	
	    // Pulse only when the active alert data changes.

    const signature = JSON.stringify(
        events.map(event => ({
            id: cosmicEventId(event),
            status: event.status || event.alertType || '',
            receivedAt:
                event.receivedAtUtc ||
                event.receivedAt ||
                event.timeReceivedUtc ||
                event.updatedAtUtc ||
                event.time_created ||
                '',
            title: cosmicEventTitle(event),
            description: cosmicEventDescription(event)
        }))
    );

    if (signature !== lastCosmicAlertSignature) {

        lastCosmicAlertSignature = signature;

        // Restart the animation, including when alerts
        // update before the previous animation finishes.

        cosmicAlerts.classList.remove('cosmicAlertPulse');

        void cosmicAlerts.offsetWidth;

        cosmicAlerts.classList.add('cosmicAlertPulse');
    }

    // Hide the entire section when there are no active alerts.

    if (events.length === 0) {

        cosmicAlerts.hidden = true;

        if (cosmicAlertItems) {
            cosmicAlertItems.replaceChildren();
        }

        return;
    }

    cosmicAlerts.hidden = false;

    const featured = events[0];

    // Featured alert

    if (cosmicAlertCategory) {
        cosmicAlertCategory.textContent =
            cosmicEventTitle(featured).toUpperCase();
    }

    if (cosmicAlertStatus) {
        cosmicAlertStatus.textContent =
            String(
                featured.status ||
                featured.alertType ||
                'ACTIVE'
            ).toUpperCase();
    }

    if (cosmicAlertTitle) {
        cosmicAlertTitle.textContent =
            cosmicEventId(featured);
    }

    if (cosmicAlertDescription) {
        cosmicAlertDescription.textContent =
            cosmicEventDescription(featured);
    }

    if (cosmicAlertSource) {

        const received = cosmicEventTime(featured);

        cosmicAlertSource.textContent =
            cosmicEventSource(featured) +
            (received ? ' · ' + received : '');
    }

    if (cosmicAlertLink) {

        const url = cosmicSafeUrl(featured);

        cosmicAlertLink.hidden = !url;

        if (url) {
            cosmicAlertLink.href = url;
        } else {
            cosmicAlertLink.removeAttribute('href');
        }
    }

    // Other ongoing notifications

    const others = events.slice(1);

    if (cosmicAlertCount) {
        cosmicAlertCount.textContent =
            String(others.length);
    }

    if (cosmicAlertList) {
        cosmicAlertList.hidden = others.length === 0;
    }

    if (cosmicAlertItems) {

        cosmicAlertItems.replaceChildren();

        others.forEach(event => {

            cosmicAlertItems.appendChild(
                createCosmicAlertItem(event)
            );
        });
    }
}


// ------------------------------------------
// Initial state
// ------------------------------------------

async function refreshCosmicAlerts() {

    try {

        const response = await fetch(
            '/api/cosmic?t=' + Date.now(),
            {
                cache: 'no-store'
            }
        );

        const state = await response.json();

        if (!response.ok || state.ok === false) {
            throw new Error(
                state.error || 'Cosmic alert request failed'
            );
        }

        renderCosmicAlerts(state);

    } catch (error) {

        console.warn(
            'Cosmic alerts unavailable:',
            error.message
        );
    }
}


// ------------------------------------------
// Live updates using Server-Sent Events
// ------------------------------------------

let cosmicEventStream = null;

function connectCosmicEventStream() {

    if (!('EventSource' in window)) {

        console.warn(
            'This browser does not support live cosmic alerts.'
        );

        return;
    }

    if (cosmicEventStream) {
        cosmicEventStream.close();
    }

    cosmicEventStream = new EventSource(
        '/api/cosmic/events'
    );

    cosmicEventStream.onmessage = event => {

        try {

            const state = JSON.parse(event.data);

            renderCosmicAlerts(state);

        } catch (error) {

            console.warn(
                'Invalid cosmic alert update:',
                error.message
            );
        }
    };

    cosmicEventStream.onerror = () => {

        // EventSource automatically attempts to reconnect.
        // Avoid creating another connection here.

        console.warn(
            'Cosmic alert stream interrupted; reconnecting.'
        );
    };
}


// Start independently of the Earth ephemeris refresh.

refreshCosmicAlerts();
connectCosmicEventStream();



// =========================================================
// DISPLAY MODES
// Phase 1
//
// IMPORTANT:
// This controls ONLY the UI mode selection.
// It does NOT touch the astronomy API,
// astronomical calculations, polling,
// caching, or rendering.
// =========================================================

const modeSelector =
    document.getElementById('modeSelector');

const modeButtons =
    document.querySelectorAll('.modeButton');


// ---------------------------------------------------------
// Current display mode
// ---------------------------------------------------------

let currentMode = 1;


// ---------------------------------------------------------
// Selector inactivity timer
// ---------------------------------------------------------

let modeSelectorHideTimer = null;

const MODE_SELECTOR_HIDE_DELAY = 5000;



// ---------------------------------------------------------
// Hide selector
// ---------------------------------------------------------

function hideModeSelector() {

    if (!modeSelector) return;

    modeSelector.classList.add('hidden');
}


// ---------------------------------------------------------
// Reset inactivity timer
// ---------------------------------------------------------

function resetModeSelectorTimer() {

    clearTimeout(modeSelectorHideTimer);

    modeSelectorHideTimer =
        setTimeout(
            hideModeSelector,
            MODE_SELECTOR_HIDE_DELAY
        );
}


// ---------------------------------------------------------
// Update active button
// ---------------------------------------------------------

function updateModeButtons() {

    modeButtons.forEach(button => {

        const mode =
            Number(button.dataset.mode);

        button.classList.toggle(
            'active',
            mode === currentMode
        );

    });
}


// ---------------------------------------------------------
// Central mode controller
//
// Phase 1 deliberately does NOT implement Mode 2/3/4.
// They only change the selected mode state.
// ---------------------------------------------------------

function enterMode2Fullscreen() {

    if (document.fullscreenElement) {
        return;
    }

    if (
        document.documentElement.requestFullscreen
    ) {
        document.documentElement
            .requestFullscreen()
            .catch(err => {
                console.log(
                    'Fullscreen request failed:',
                    err.message
                );
            });
    }
}

function exitMode2Fullscreen() {

    if (
        document.fullscreenElement &&
        document.exitFullscreen
    ) {
        document.exitFullscreen()
            .catch(() => {});
    }
}

function setMode(mode) {

    if (!Number.isInteger(mode)) {
        return;
    }

    if (mode < 1 || mode > 4) {
        return;
    }

    const previousMode = currentMode;

    currentMode = mode;

    updateModeButtons();


    // ------------------------------------------
    // Always reset Mode 3 and Mode 4 first
    // ------------------------------------------

    if (mode3Display) {
        mode3Display.classList.remove(
            'active'
        );
    }

    if (mode4Display) {
        mode4Display.style.display =
            'none';
    }


    // ------------------------------------------
    // Leave Mode 2 fullscreen when necessary
    // ------------------------------------------

    if (
        previousMode === 2 &&
        currentMode !== 2
    ) {
        exitMode2Fullscreen();
    }


    // ------------------------------------------
    // Mode 2
    // ------------------------------------------

    if (currentMode === 2) {

    document.body.classList.add(
        'mode2Minimal'
    );


    // ------------------------------------------
    // Mode 2 attribution
    // ------------------------------------------

    let mode2Attribution =
        document.getElementById(
            'mode2Attribution'
        );

    if (!mode2Attribution) {

        mode2Attribution =
            document.createElement('div');

        mode2Attribution.id =
            'mode2Attribution';

        mode2Attribution.textContent =
            'Sun image: NASA/GSFC/SDO · Earth image: NASA/GSFC';

        document.body.appendChild(
            mode2Attribution
        );
    }


    // ------------------------------------------
    // Mode 2 lock button
    // ------------------------------------------

    let mode2Lock =
        document.getElementById(
            'mode2Lock'
        );

    if (!mode2Lock) {

        mode2Lock =
            document.createElement('button');

        mode2Lock.id =
            'mode2Lock';

        mode2Lock.type =
            'button';

        mode2Lock.setAttribute(
            'aria-label',
            mode2Locked
                ? 'Unlock Mode 2'
                : 'Lock Mode 2'
        );

        mode2Lock.setAttribute(
            'title',
            mode2Locked
                ? 'Unlock Mode 2'
                : 'Lock Mode 2'
        );

        mode2Lock.textContent =
            mode2Locked
                ? '🔒'
                : '🔓';

        mode2Lock.addEventListener(
            'click',
            event => {

                event.stopPropagation();

                setMode2Lock(
                    !mode2Locked
                );
            }
        );

        document.body.appendChild(
            mode2Lock
        );
    }


    // ------------------------------------------
    // Mode 2
    // ------------------------------------------

    if (mode1Content) {
        mode1Content.style.display =
            'none';
    }

    openMode2();

    enterMode2Fullscreen();
}


    // ------------------------------------------
    // Mode 3
    // ------------------------------------------

    else if (currentMode === 3) {

        document.body.classList.remove(
            'mode2Minimal'
        );

        if (mode1Content) {
            mode1Content.style.display =
                'none';
        }

        closeMode2();

        if (mode3Display) {

            mode3Display.classList.add(
                'active'
            );

            loadMode3Sandbox();

            updateMode3();
        }
    }


    // ------------------------------------------
    // Mode 4
    // ------------------------------------------

    else if (currentMode === 4) {

        document.body.classList.remove(
            'mode2Minimal'
        );

        if (mode1Content) {
            mode1Content.style.display =
                'none';
        }

        closeMode2();

    if (mode4Display) {
        mode4Display.style.display =
            'block';
    }
    }


    // ------------------------------------------
    // Mode 1
    // ------------------------------------------

    else {

        document.body.classList.remove(
            'mode2Minimal'
        );

        if (mode1Content) {
            mode1Content.style.display =
                '';
        }

        closeMode2();
    }


    // ------------------------------------------
    // Selector
    // ------------------------------------------

    showModeSelector();

    console.log(
        'Display mode:',
        currentMode
    );
}


// ---------------------------------------------------------
// Button events
// ---------------------------------------------------------

modeButtons.forEach(button => {

    button.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            const mode =
                Number(button.dataset.mode);

            setMode(mode);
        }
    );

});


// ---------------------------------------------------------
// User activity
// ---------------------------------------------------------

document.addEventListener(
    'mousemove',
    showModeSelector
);

document.addEventListener(
    'touchstart',
    showModeSelector,
    { passive: true }
);

document.addEventListener(
    'pointerdown',
    showModeSelector
);

document.addEventListener(
    'keydown',
    showModeSelector
);

const mode2Display =
    document.getElementById('mode2Display');

const mode2Visual =
    document.getElementById('mode2Visual');

const mode2Earth =
    document.getElementById('mode2Earth');

const mode2ResizeHandle =
    document.getElementById('mode2ResizeHandle');

const mode2Buttons =
    document.querySelectorAll('.mode2Button');
	
const mode1Content =
    document.getElementById('mode1Content');	
	
const mode2ProgressValue =
    document.getElementById(
        'mode2ProgressValue'
    );

const MODE2_SETTINGS_KEY =
    'astronomicalTimeMode2Settings';

const MODE2_DEFAULT = {
    width: 300,
    height: 300,
    left: null,
    top: null
};

const MODE2_LOCK_KEY =
    'astronomicalTimeMode2Locked';

let mode2Locked = false;	

const mode3Display =
    document.getElementById('mode3Display');

const mode3Visual =
    document.getElementById('mode3Visual');

const mode3Orbit =
    document.getElementById('mode3Orbit');

const mode3Earth =
    document.getElementById('mode3Earth');

const mode3ProgressValue =
    document.getElementById(
        'mode3ProgressValue'
    );
	
const mode3Fullscreen =
    document.getElementById(
        'mode3Fullscreen'
    );

if (mode3Fullscreen) {

    mode3Fullscreen.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            if (!document.fullscreenElement) {

                document.documentElement
                    .requestFullscreen()
                    .catch(() => {});

            } else {

                document.exitFullscreen()
                    .catch(() => {});
            }
        }
    );
}

const mode4Display =
        document.getElementById(
            'mode4Display'
        );

// ---------------------------------------------------------
// Initial state
// ---------------------------------------------------------

mode2Locked =
    localStorage.getItem(
        MODE2_LOCK_KEY
    ) === 'true';

if (mode2Locked) {
    setMode(2);
} else {
    setMode(1);
}
resetModeSelectorTimer();



document.addEventListener(
    'fullscreenchange',
    () => {

        if (!mode3Fullscreen) {
            return;
        }

        mode3Fullscreen.textContent =
            document.fullscreenElement
                ? '⛶'
                : '⛶';
    }
);


// =========================================================
// MODE 2
// Phase 2
//
// IMPORTANT:
//
// Mode 2 does NOT fetch astronomical data.
//
// It uses the same data already obtained by app.js.
//
// This is intentionally independent from:
//   /api/earth
//   astronomy.js
//   server.js
//   worker.js
// =========================================================




// ---------------------------------------------------------
// Mode 2 state
// ---------------------------------------------------------

let mode2Dragging = false;

let mode2Resizing = false;

let mode2PointerId = null;

let mode2StartPointerX = 0;
let mode2StartPointerY = 0;

let mode2StartLeft = 0;
let mode2StartTop = 0;

let mode2StartWidth = 300;
let mode2StartHeight = 300;


// ---------------------------------------------------------
// Minimum / maximum size
// ---------------------------------------------------------

const MODE2_MIN_SIZE = 140;
const MODE2_MAX_SIZE = 700;


function openFitsViewer(fitsUrl) {
    const overlay = document.getElementById('fitsViewerOverlay');
    const frame = document.getElementById('fitsViewerFrame');

    frame.src = `/fits-test.html?url=${encodeURIComponent(fitsUrl)}`;

    overlay.classList.add('active');
}

function closeFitsViewer() {
    const overlay = document.getElementById('fitsViewerOverlay');
    const frame = document.getElementById('fitsViewerFrame');

    overlay.classList.remove('active');

    // Stop the viewer and release its resources.
    frame.src = 'about:blank';
}

document.getElementById('closeFitsViewer')
    .addEventListener('click', closeFitsViewer);

// Optional: allow Escape to close the viewer.
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeFitsViewer();
    }
});


// ---------------------------------------------------------
// Show selector
// ---------------------------------------------------------

function showModeSelector(event) {
	
    if (
        event?.target?.closest('#mode3Fullscreen')
    ) {
        return;
    }
	
	if (!modeSelector) return;

    modeSelector.classList.remove('hidden');

    resetModeSelectorTimer();
}


// ---------------------------------------------------------
// Open Mode 2
// ---------------------------------------------------------

function openMode2() {

    if (!mode2Display) return;

    mode2Display.classList.add('active');

    updateMode2Buttons();

    // Immediately show the latest available position
    if (
        data &&
        data.combined &&
        Number.isFinite(
            data.combined.orbitalProgressDeg
        )
    ) {
        updateMode2Position(data);
    }
	
	if (mode2Locked) {
    applyMode2Settings();
}
}


// ---------------------------------------------------------
// Close Mode 2
// ---------------------------------------------------------

function closeMode2() {

    if (!mode2Display) return;

    mode2Display.classList.remove('active');
}


// ---------------------------------------------------------
// Update Mode 2 buttons
// ---------------------------------------------------------

function updateMode2Buttons() {

    mode2Buttons.forEach(button => {

        const mode =
            Number(button.dataset.mode);

        button.classList.toggle(
            'active',
            mode === 2
        );

    });
}


// =========================================================
// EARTH POSITION
// =========================================================
//
// Uses:
//
// combined.orbitalProgressDeg
//
// from the existing /api/earth response.
// =========================================================

function updateMode2Position(data) {

    if (!mode2Earth) return;

    if (!data) return;

    if (
        !data.combined ||
        !Number.isFinite(
            data.combined.orbitalProgressDeg
        )
    ) {
        return;
    }


    const progressDeg =
        data.combined.orbitalProgressDeg;


    /*
     * 0 degrees = 12 o'clock
     *
     * clockwise movement:
     *
     * x = sin(angle)
     * y = -cos(angle)
     */

    const angle =
        progressDeg * Math.PI / 180;


    const radius = 50;


    const x =
        50 + Math.sin(angle) * radius;

    const y =
        50 - Math.cos(angle) * radius;


    mode2Earth.style.left =
        x + '%';

    mode2Earth.style.top =
        y + '%';
		
		
	if (
    mode2ProgressValue &&
    data &&
    data.combined &&
    Number.isFinite(
        data.combined.orbitalProgressPercent
    )
) {

    mode2ProgressValue.textContent =
        data.combined.orbitalProgressPercent
            .toFixed(2) + '%';
}
}

function getMode2Settings() {

    try {

        const saved =
            localStorage.getItem(
                MODE2_SETTINGS_KEY
            );

        if (!saved) {
            return null;
        }

        return JSON.parse(saved);

    } catch (e) {

        return null;
    }
}


function saveMode2Settings() {

    const el =
        document.getElementById(
            'mode2Display'
        );

    if (!el) {
        return;
    }

    const rect =
        el.getBoundingClientRect();

    const settings = {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top
    };

    localStorage.setItem(
        MODE2_SETTINGS_KEY,
        JSON.stringify(settings)
    );
}


function applyMode2Settings() {

    const el =
        document.getElementById(
            'mode2Display'
        );

    if (!el) {
        return;
    }

    const settings =
        getMode2Settings();

    if (!settings) {
        return;
    }

    el.style.width =
        settings.width + 'px';

    el.style.height =
        settings.height + 'px';

    el.style.left =
        settings.left + 'px';

    el.style.top =
        settings.top + 'px';

    el.style.transform =
        'none';
}


function resetMode2Settings() {

    const el =
        document.getElementById(
            'mode2Display'
        );

    if (!el) {
        return;
    }

    localStorage.removeItem(
        MODE2_SETTINGS_KEY
    );

    el.style.width = '';
    el.style.height = '';
    el.style.left = '';
    el.style.top = '';
    el.style.transform = '';
}

function setMode2Lock(locked) {

    mode2Locked = locked;

    localStorage.setItem(
        MODE2_LOCK_KEY,
        locked ? 'true' : 'false'
    );

    const button =
        document.getElementById(
            'mode2Lock'
        );

    if (locked) {

        saveMode2Settings();

        if (button) {
            button.textContent = '🔒';

            button.setAttribute(
                'aria-label',
                'Unlock Mode 2'
            );

            button.setAttribute(
                'title',
                'Unlock Mode 2'
            );
        }

    } else {

        localStorage.removeItem(
            MODE2_SETTINGS_KEY
        );

        if (button) {
            button.textContent = '🔓';

            button.setAttribute(
                'aria-label',
                'Lock Mode 2'
            );

            button.setAttribute(
                'title',
                'Lock Mode 2'
            );
        }

        resetMode2Settings();

        openMode2();
    }
}

function updateMode3() {

    if (!data) {
        return;
    }

    const p =
        data.combined.orbitalProgressDeg;

    const pc =
        data.combined.orbitalProgressPercent;

    setMode3EarthPosition(p);

    mode3ProgressValue.textContent =
        pc.toFixed(3) + '%';
}

let mode3Designs = [];
let mode3Index = 0;
let mode3Timer = null;

async function loadMode3Sandbox() {

    const frame =
        document.getElementById('mode3SandboxFrame');

    if (!frame) {
        return;
    }

    try {

        const response =
            await fetch('mode3-designs.json');

        if (!response.ok) {
            throw new Error(
                'Failed to load mode3designs.json'
            );
        }

        const data =
            await response.json();

        mode3Designs = data.designs || [];

        if (!mode3Designs.length) {
            throw new Error(
                'No Mode 3 designs found'
            );
        }

        const interval =
            data.interval || 10000;

        function showDesign() {

            frame.src =
                mode3Designs[mode3Index];

            mode3Index++;

            if (
                mode3Index >=
                mode3Designs.length
            ) {
                mode3Index = 0;
            }
        }

        // Stop previous timer
        if (mode3Timer) {
            clearInterval(mode3Timer);
        }

        // Show first design immediately
        showDesign();

        // Rotate designs
        mode3Timer =
            setInterval(
                showDesign,
                interval
            );

    } catch (error) {

        console.error(
            'Mode 3:',
            error
        );

    }
}

// =========================================================
// DRAGGING
// =========================================================

mode2Display.addEventListener(
    'pointerdown',
    event => {

        /*
         * Don't start dragging when interacting
         * with buttons or resize handle.
         */

        if (
            event.target.closest('#mode2Selector') ||
            event.target.closest('#mode2ResizeHandle')
        ) {
            return;
        }


        mode2Dragging = true;

        mode2PointerId =
            event.pointerId;

        mode2StartPointerX =
            event.clientX;

        mode2StartPointerY =
            event.clientY;


        const rect =
            mode2Display.getBoundingClientRect();


        mode2StartLeft =
            rect.left;

        mode2StartTop =
            rect.top;


        mode2Display.setPointerCapture(
            event.pointerId
        );

        event.preventDefault();
    }
);


mode2Display.addEventListener(
    'pointermove',
    event => {

        if (
            !mode2Dragging ||
            event.pointerId !== mode2PointerId
        ) {
            return;
        }


        const dx =
            event.clientX -
            mode2StartPointerX;

        const dy =
            event.clientY -
            mode2StartPointerY;


        mode2Display.style.left =
            (mode2StartLeft + dx) + 'px';

        mode2Display.style.top =
            (mode2StartTop + dy) + 'px';

        /*
         * Remove the centering transform once
         * the user starts dragging.
         */

        mode2Display.style.transform =
            'none';
    }
);


function stopMode2Dragging() {

    mode2Dragging = false;

    mode2PointerId = null;
	
	if (mode2Locked) {
    saveMode2Settings();
}
}


mode2Display.addEventListener(
    'pointerup',
    stopMode2Dragging
);

mode2Display.addEventListener(
    'pointercancel',
    stopMode2Dragging
);


// =========================================================
// RESIZING
// =========================================================

mode2ResizeHandle.addEventListener(
    'pointerdown',
    event => {

        mode2Resizing = true;

        mode2PointerId =
            event.pointerId;

        mode2StartPointerX =
            event.clientX;

        mode2StartPointerY =
            event.clientY;


        const rect =
            mode2Display.getBoundingClientRect();


        mode2StartWidth =
            rect.width;

        mode2StartHeight =
            rect.height;


        mode2ResizeHandle.setPointerCapture(
            event.pointerId
        );

        event.preventDefault();

        event.stopPropagation();
    }
);


mode2ResizeHandle.addEventListener(
    'pointermove',
    event => {

        if (
            !mode2Resizing ||
            event.pointerId !== mode2PointerId
        ) {
            return;
        }


        const dx =
            event.clientX -
            mode2StartPointerX;

        const dy =
            event.clientY -
            mode2StartPointerY;


        /*
         * Keep the object square.
         */

        const delta =
            Math.max(dx, dy);


        let size =
            mode2StartWidth + delta;


        size =
            Math.max(
                MODE2_MIN_SIZE,
                Math.min(
                    MODE2_MAX_SIZE,
                    size
                )
            );


        mode2Display.style.width =
            size + 'px';

        mode2Display.style.height =
            size + 'px';
    }
);


function stopMode2Resizing() {

    mode2Resizing = false;

    mode2PointerId = null;
	
	if (mode2Locked) {
    saveMode2Settings();
}
}


mode2ResizeHandle.addEventListener(
    'pointerup',
    stopMode2Resizing
);

mode2ResizeHandle.addEventListener(
    'pointercancel',
    stopMode2Resizing
);


// =========================================================
// MODE 2 BUTTONS
// =========================================================

mode2Buttons.forEach(button => {

    button.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            const mode =
                Number(button.dataset.mode);


            if (mode === 1) {

                setMode(1);

                return;
            }


            if (mode === 2) {

                setMode(2);

                return;
            }


            if (mode === 3) {

                setMode(3);

                return;
            }


            if (mode === 4) {

                setMode(4);

                return;
            }

        }
    );

});

