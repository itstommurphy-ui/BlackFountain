// INIT
// ══════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// BLACK FOUNTAIN — SAMPLE PROJECT
// "The Cake Man" (GT#9) — Grim Tidings Picture Company
//
// Injected on first load if no projects exist.
// Editable by the user. Can be reset via Settings > Reset Sample Project.
// ══════════════════════════════════════════════════════════════════

const BF_SAMPLE_PROJECT_ID = 'sample-cake-man-gt9';

// ─── Script text (sans title page) ──────────────────────────────

const _CAKE_MAN_SCRIPT = `INT. CAKE SHOP - DAY

The shop is decorated with cakes, flowers and balloons. Some
of the flowers look old, and the balloons are deflating.

CAKE SHOP OWNER lifts a cake onto the counter.

CAKE SHOP OWNER
Aaand, here it is.

The CAKE BUYER's smile turns to concern.

CAKE BUYER
What's this?

CAKE SHOP OWNER
It's your 'Vanilla Sponge Deluxe'
with your message of choice.

CLOSE ON: THE CAKE - it's a shit show. The writing is all
over the place and there's a vague shape in the centre that
looks like it was supposed to be a monkey at one point.

CAKE BUYER
What's the picture? I asked for a
dog.

CAKE SHOP OWNER
Well, er - it is a dog. Look,
there's the ears.

CAKE BUYER
If that's a dog there's something
very, very wrong with it.

CAKE SHOP OWNER
I think it's cute..?

CAKE BUYER
It needs putting down. For it's own
sake.

The Cake shop owner nods, ashamedly.

A beat.

CAKE BUYER (CONT'D)
Can you do me a favour and read
what that says.

CAKE SHOP OWNER
(quick glance)
'Happy Birthday Brian'.

CAKE BUYER
Are you sure?

He nods.

CAKE BUYER (CONT'D)
It says 'Brithday'.

The Cake shop owner has another quick look.

CAKE SHOP OWNER
Happy Birth - brithday. Brian.

CAKE BUYER
'Brain'.

CAKE SHOP OWNER
Happy Brithday Brain. Yeah. Okay,
yeah. Just a little joke.

The Cake buyer stares expectantly at the Cake shop owner.

CAKE BUYER
I'm not paying for this.

CAKE SHOP OWNER
(sigh)
No?

CAKE BUYER
No. It looks like you've made it at
gunpoint.

CLOSE ON: CAKE - it does.

The Cake buyer leaves the shop.

The whole cake is dropped into the bin with a - THUD.

INT. STAFF ROOM - CONTINUOUS

The Cake shop owner walks to the baking counter.

A MAN WITH A GUN leans against the back wall pointing a gun
at the Cake shop owner.

MAN WITH A GUN
(through gritted teeth)
DO ANOTHER ONE.

CAKE SHOP OWNER
Yep, okay! Okay.

END`;

// ─── Breakdown raw text ──────────────────────────────────────────
// Formatted to match Black Fountain's scene-heading parser

const _CAKE_MAN_BREAKDOWN = `INT. CAKE SHOP - DAY

[[CAST]] Cake Shop Owner
[[CAST]] Cake Buyer
[[PROPS]] Badly decorated cake ("Happy Brithday Brain")
[[PROPS]] Counter
[[PROPS]] Bin
[[PROPS]] Balloons (deflating)
[[PROPS]] Wilted flowers
[[WARDROBE]] Cake Shop Owner: apron

The shop is decorated with cakes, flowers and balloons. Some
of the flowers look old, and the balloons are deflating. Cake
Shop Owner presents a disastrous birthday cake. Extended
dialogue scene - two characters across the counter.

INT. STAFF ROOM - CONTINUOUS

[[CAST]] Cake Shop Owner
[[CAST]] Man with a Gun
[[PROPS]] Gun (prop)
[[WARDROBE]] Man with a Gun: balaclava

Cake Shop Owner walks into the back. Man with a Gun is
revealed. Dialogue: "Do another one."`;

// ─── Schedule ────────────────────────────────────────────────────

const _CAKE_MAN_SCHEDULE = [
  {
    id: 'sched-0', type: 'non-shot', time: '10:00',
    description: 'Unit call & set up Shot 1', notes: '', duration: 90
  },
  {
    id: 'sched-1', type: 'shot', time: '11:30',
    setup: 1, shot: 1, shotType: 'CU', intExt: 'INT', timeOfDay: 'DAY',
    location: 'The Cake Shop Counter', description: 'Cake placed onto counter and pushed towards camera',
    cast: ['Dan Fieldsend'], pages: '1/8', duration: 25, notes: ''
  },
  {
    id: 'sched-2', type: 'shot', time: '11:55',
    setup: 2, shot: 2, shotType: 'CU', intExt: 'INT', timeOfDay: 'DAY',
    location: 'The Cake Shop Counter', description: 'Cake Shop Owner – full scene',
    cast: ['Dan Fieldsend', 'Ashlee Brown'], pages: '1 & 5/8', duration: 60, notes: ''
  },
  {
    id: 'sched-3', type: 'shot', time: '12:55',
    setup: 5, shot: 5, shotType: 'MID', intExt: 'INT', timeOfDay: 'DAY',
    location: 'The Cake Shop Counter', description: 'Cake Shop Owner – full scene',
    cast: ['Dan Fieldsend', 'Ashlee Brown'], pages: '1 & 5/8', duration: 60, notes: ''
  },
  {
    id: 'sched-b1', type: 'non-shot', time: '13:55',
    description: 'BREAK – 20 mins', notes: '', duration: 20
  },
  {
    id: 'sched-4', type: 'shot', time: '14:15',
    setup: 3, shot: 3, shotType: 'CU', intExt: 'INT', timeOfDay: 'DAY',
    location: 'The Cake Shop Counter', description: 'Cake Buyer – full scene',
    cast: ['Dan Fieldsend', 'Ashlee Brown'], pages: '1 & 5/8', duration: 60, notes: ''
  },
  {
    id: 'sched-5', type: 'shot', time: '15:15',
    setup: 4, shot: 4, shotType: 'MID', intExt: 'INT', timeOfDay: 'DAY',
    location: 'The Cake Shop Counter', description: 'Cake Buyer – full scene',
    cast: ['Dan Fieldsend', 'Ashlee Brown'], pages: '1 & 5/8', duration: 60, notes: ''
  },
  {
    id: 'sched-6', type: 'shot', time: '16:15',
    setup: 6, shot: 6, shotType: 'WIDE', intExt: 'INT', timeOfDay: 'DAY',
    location: 'The Cake Shop Counter', description: 'Wide from side of counter – full scene',
    cast: ['Dan Fieldsend', 'Ashlee Brown'], pages: '1 & 5/8', duration: 60, notes: ''
  },
  {
    id: 'sched-7', type: 'shot', time: '17:15',
    setup: 7, shot: 7, shotType: 'CU', intExt: 'INT', timeOfDay: 'DAY',
    location: 'The Cake Shop Counter', description: 'On cake – full scene, hands pointing, then clean',
    cast: ['Dan Fieldsend', 'Ashlee Brown'], pages: '1 & 5/8', duration: 60, notes: ''
  },
  {
    id: 'sched-b2', type: 'non-shot', time: '18:15',
    description: 'BREAK – 15 mins', notes: '', duration: 15
  },
  {
    id: 'sched-8', type: 'shot', time: '18:30',
    setup: 8, shot: 8, shotType: 'CU', intExt: 'INT', timeOfDay: 'DAY',
    location: 'The Cake Shop Counter', description: 'Cake drops into bin',
    cast: ['Dan Fieldsend'], pages: '2', duration: 20, notes: ''
  },
  {
    id: 'sched-9', type: 'shot', time: '18:50',
    setup: 9, shot: 9, shotType: 'MID', intExt: 'INT', timeOfDay: 'DAY',
    location: 'The Cake Shop Counter', description: 'Handheld – Cake Shop Owner into staff room, pan to reveal Man with a Gun, dialogue',
    cast: ['Dan Fieldsend', 'Sean Bradshaw'], pages: '2', duration: 50, notes: 'Handheld follow'
  },
  {
    id: 'sched-10', type: 'shot', time: '19:40',
    setup: 10, shot: 10, shotType: 'CU', intExt: 'INT', timeOfDay: 'DAY',
    location: 'The Cake Shop', description: 'Cutaways',
    cast: [], pages: 'ALL', duration: 15, notes: ''
  },
  {
    id: 'sched-w1', type: 'non-shot', time: '19:55',
    description: 'Cast/crew photos', notes: '', duration: 10
  },
  {
    id: 'sched-w2', type: 'non-shot', time: '20:05',
    description: 'UNIT WRAP & PACK DOWN', notes: '', duration: 55
  },
];

// ─── Callsheet ───────────────────────────────────────────────────

const _CAKE_MAN_CALLSHEET = {
  id: 'cs-001',
  title: 'The Cake Man – Call Sheet',
  productionNumber: 'GT#9',
  shootDate: '2023-10-08',
  crewCall: '10:00',
  shootingCall: '11:20',
  estimatedWrap: '21:00',
  director: 'Tom Murphy',
  producer: 'Tom Murphy',
  firstAD: 'Cat Lewis',
  dop: 'Geraint Perry',
  socialMedia: '@GrimTidingsPC',
  weather: { condition: '', rainChance: '', wind: '', humidity: '' },
  locations: [
    {
      name: 'Albion Bakehouse',
      address: '5-7 Atherton Street, Prescot L34 5QN England',
      parking: 'Directly outside if space available. Paid car parks nearby. Do NOT park in church car park opposite.',
      nearestHospital: 'Whiston Hospital, Warrington Rd, Rainhill, Prescot L35 5DR',
    }
  ],
  cast: [
    { actor: 'Ashlee Brown', character: 'Cake Buyer', ref: 'AB', call: '10:45', wrap: '20:05', contact: 'Cat Lewis', notes: '' },
    { actor: 'Dan Fieldsend', character: 'Cake Shop Owner', ref: 'DF', call: '10:45', wrap: '20:05', contact: 'Cat Lewis', notes: '' },
    { actor: 'Sean Bradshaw', character: 'Man with the Gun', ref: 'SB', call: '10:00', wrap: '21:00', contact: 'Tom Murphy', notes: 'Also Sound Recordist' },
  ],
  schedule: _CAKE_MAN_SCHEDULE,
  notes: [
    'The schedule is subject to change and represents our maximum expected time on set.',
    'If we find ourselves ahead of time, we will move to the next shot to shorten the day.',
    'Please make Cat Lewis or Tom Murphy aware if you need an extra break.',
    'Any crew that can help strike the set afterwards would be massively appreciated.',
    'Please direct pre-shoot questions to your point of contact.',
  ],
  createdAt: 1696550400000,
};

// ─── Budget ──────────────────────────────────────────────────────

const _CAKE_MAN_BUDGET = [
  // Cast & Crew Fees
  { id: 'b-01', category: 'Cast & Crew', item: 'Actor travel – Cake Shop Owner (est.)', estimate: 20, actual: null, notes: 'Estimated, not confirmed' },
  { id: 'b-02', category: 'Cast & Crew', item: 'Actor travel – Cake Buyer (est.)', estimate: 20, actual: null, notes: 'Estimated, not confirmed' },
  // Props
  { id: 'b-03', category: 'Props', item: 'Balaclava (Man with a Gun)', estimate: null, actual: 4.99, notes: 'Amazon' },
  // Catering
  { id: 'b-04', category: 'Catering', item: 'Food, water, cakes, fruit', estimate: null, actual: 28.90, notes: '' },
  { id: 'b-05', category: 'Catering', item: 'Subway platter', estimate: null, actual: 24.00, notes: '' },
  // Locations
  { id: 'b-06', category: 'Locations', item: 'Albion Bakehouse location fee', estimate: 0, actual: 0, notes: 'Agreed in kind / goodwill' },
  // Post
  { id: 'b-07', category: 'Post-Production', item: 'Sound mix (TBD)', estimate: null, actual: null, notes: 'TBD' },
];

// ─── Unit (crew) list ────────────────────────────────────────────

const _CAKE_MAN_UNIT = [
  { id: 'u-01', name: 'Tom Murphy', role: 'Producer / Director / Editor / Colourist', department: 'Production', phone: '', email: 'tom@grimtidings.co.uk', confirmed: true },
  { id: 'u-02', name: 'Cat Lewis', role: 'Producer / 1st AD', department: 'Production', phone: '07592658822', email: '', confirmed: true },
  { id: 'u-03', name: 'Geraint Perry', role: 'Director of Photography', department: 'Camera', phone: '', email: 'geraintperry@gmail.com', confirmed: true },
  { id: 'u-04', name: 'Sean Bradshaw', role: 'Sound Recordist (also cast)', department: 'Sound', phone: '', email: 'seanbradshaw92@gmail.com', confirmed: true },
  { id: 'u-05', name: 'Zoe Murphy', role: 'Behind the Scenes', department: 'Production', phone: '', email: '', confirmed: true },
  { id: 'u-06', name: 'TBD', role: 'Sound Mixer (post)', department: 'Post', phone: '', email: '', confirmed: false },
];

// ─── Cast list ───────────────────────────────────────────────────

const _CAKE_MAN_CAST = [
  { id: 'c-01', name: 'Ashlee Brown', character: 'Cake Buyer', type: 'cast', phone: '', email: '', confirmed: true, notes: '' },
  { id: 'c-02', name: 'Dan Fieldsend', character: 'Cake Shop Owner', type: 'cast', phone: '', email: '', confirmed: true, notes: '' },
  { id: 'c-03', name: 'Sean Bradshaw', character: 'Man with a Gun', type: 'cast', phone: '', email: 'seanbradshaw92@gmail.com', confirmed: true, notes: 'Also Sound Recordist' },
];

// ─── Equipment / gear list ───────────────────────────────────────

const _CAKE_MAN_GEAR = [
  // Camera
  { id: 'g-01', category: 'Camera', item: 'Panasonic GH7', quantity: 1, preCheck: false, postCheck: false, notes: '' },
  { id: 'g-02', category: 'Camera', item: 'Glass (lenses)', quantity: 1, preCheck: false, postCheck: false, notes: '' },
  { id: 'g-03', category: 'Camera', item: 'Batteries', quantity: 1, preCheck: false, postCheck: false, notes: '' },
  { id: 'g-04', category: 'Camera', item: 'Accessories', quantity: 1, preCheck: false, postCheck: false, notes: '' },
  // Audio
  { id: 'g-05', category: 'Audio', item: 'Rode VideoMic', quantity: 1, preCheck: false, postCheck: false, notes: '' },
  { id: 'g-06', category: 'Audio', item: 'Tascam DR05X', quantity: 1, preCheck: false, postCheck: false, notes: '' },
  { id: 'g-07', category: 'Audio', item: 'Boom pole', quantity: 1, preCheck: false, postCheck: false, notes: '' },
  { id: 'g-08', category: 'Audio', item: 'Dead cat windshield', quantity: 1, preCheck: false, postCheck: false, notes: '' },
  { id: 'g-09', category: 'Audio', item: 'Batteries (audio)', quantity: 1, preCheck: false, postCheck: false, notes: '' },
  // Grip
  { id: 'g-10', category: 'Grip', item: 'Grip equipment', quantity: 1, preCheck: false, postCheck: false, notes: 'Items not finalised' },
  // Lighting
  { id: 'g-11', category: 'Lighting', item: 'Lighting kit', quantity: 1, preCheck: false, postCheck: false, notes: 'Items not finalised' },
  { id: 'g-12', category: 'Lighting', item: 'Light modifiers', quantity: 1, preCheck: false, postCheck: false, notes: '' },
  // Camera Support
  { id: 'g-13', category: 'Camera Support', item: 'Camera support', quantity: 1, preCheck: false, postCheck: false, notes: 'Items not finalised' },
];

// Gear list with proper structure for production plan
const _CAKE_MAN_GEAR_LIST = [
  {
    id: 'day-1',
    name: 'Day 1',
    categories: [
      {
        name: 'Camera',
        items: [
          { id: 'g-01', name: 'Panasonic GH7', quantity: 1, checked: false },
          { id: 'g-02', name: 'Glass (lenses)', quantity: 1, checked: false },
          { id: 'g-03', name: 'Batteries', quantity: 1, checked: false },
          { id: 'g-04', name: 'Accessories', quantity: 1, checked: false },
        ]
      },
      {
        name: 'Audio',
        items: [
          { id: 'g-05', name: 'Rode VideoMic', quantity: 1, checked: false },
          { id: 'g-06', name: 'Tascam DR05X', quantity: 1, checked: false },
          { id: 'g-07', name: 'Boom pole', quantity: 1, checked: false },
          { id: 'g-08', name: 'Dead cat windshield', quantity: 1, checked: false },
          { id: 'g-09', name: 'Batteries (audio)', quantity: 1, checked: false },
        ]
      },
      {
        name: 'Grip',
        items: [
          { id: 'g-10', name: 'Grip equipment', quantity: 1, checked: false },
        ]
      },
      {
        name: 'Lighting',
        items: [
          { id: 'g-11', name: 'Lighting kit', quantity: 1, checked: false },
          { id: 'g-12', name: 'Light modifiers', quantity: 1, checked: false },
        ]
      },
      {
        name: 'Camera Support',
        items: [
          { id: 'g-13', name: 'Camera support', quantity: 1, checked: false },
        ]
      }
    ]
  }
];

// ─── Locations ───────────────────────────────────────────────────

const _CAKE_MAN_LOCATIONS = [
  {
    id: 'loc-01',
    name: 'Albion Bakehouse',
    address: '5-7 Atherton Street, Prescot L34 5QN',
    type: 'INT',
    status: 'confirmed',
    contactName: 'Nina Halliwell',
    contactPhone: '',
    contactEmail: '',
    releaseSignedBy: 'Nina Halliwell',
    releaseSignedDate: '2023-08-24',
    parkingNotes: 'Directly outside if space available. Paid car parks nearby. Do NOT park in church car park opposite.',
    nearestHospital: 'Whiston Hospital, Warrington Rd, Rainhill, Prescot L35 5DR',
    accessNotes: 'Entrance to the set is located in front of the building.',
    scoutingNotes: 'Recce completed. Green wall serving counter on one side, warm pink/wood seating area on the other. Good natural light from large front windows. Staff room accessed via door at rear. Ceiling pendant lights in place.',
    riskNotes: 'Interior location, single floor. No stunts. Prop firearm (balaclava + toy gun). Low overall risk.',
    files: [],
    createdAt: 1690156800000,
  }
];

// ─── Shots ───────────────────────────────────────────────────────

const _CAKE_MAN_SHOTS = [
  { id: 'sh-01', scene: 1, setup: 1, shot: 1, shotType: 'CU', movement: 'Stationary', location: 'The Cake Shop Counter', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'Cake placed onto counter and pushed towards camera', cast: ['Cake Shop Owner', 'Cake Buyer'], pages: '1/8', setupTime: '15 mins', shootTime: '10 mins', totalTime: '25 mins', notes: '' },
  { id: 'sh-02', scene: 1, setup: 2, shot: 2, shotType: 'CU', movement: 'Stationary', location: 'The Cake Shop Counter', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'CLOSEUP: Cake Shop Owner – full scene', cast: ['Cake Shop Owner', 'Cake Buyer'], pages: '1-2', setupTime: '20 mins', shootTime: '40 mins', totalTime: '1 hour', notes: '' },
  { id: 'sh-03', scene: 1, setup: 3, shot: 3, shotType: 'CU', movement: 'Stationary', location: 'The Cake Shop Counter', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'CLOSEUP: Cake Buyer – full scene', cast: ['Cake Shop Owner', 'Cake Buyer'], pages: '1-2', setupTime: '20 mins', shootTime: '40 mins', totalTime: '1 hour', notes: '' },
  { id: 'sh-04', scene: 1, setup: 4, shot: 4, shotType: 'MS', movement: 'Stationary', location: 'The Cake Shop Counter', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'MID: Cake Buyer – full scene', cast: ['Cake Shop Owner', 'Cake Buyer'], pages: '1-2', setupTime: '20 mins', shootTime: '40 mins', totalTime: '1 hour', notes: '' },
  { id: 'sh-05', scene: 1, setup: 5, shot: 5, shotType: 'MS', movement: 'Stationary', location: 'The Cake Shop Counter', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'MID: Cake Shop Owner – full scene', cast: ['Cake Shop Owner', 'Cake Buyer'], pages: '1-2', setupTime: '20 mins', shootTime: '40 mins', totalTime: '1 hour', notes: '' },
  { id: 'sh-06', scene: 1, setup: 6, shot: 6, shotType: 'WIDE', movement: 'Stationary', location: 'The Cake Shop Counter', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'Wide from side of counter – full scene', cast: ['Cake Shop Owner', 'Cake Buyer'], pages: '1-2', setupTime: '20 mins', shootTime: '40 mins', totalTime: '1 hour', notes: '' },
  { id: 'sh-07', scene: 1, setup: 7, shot: 7, shotType: 'CU', movement: 'Stationary', location: 'The Cake Shop Counter', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'CLOSE: On cake – full scene, hands close (pointing etc), then clean', cast: ['Cake Shop Owner', 'Cake Buyer'], pages: '1-2', setupTime: '20 mins', shootTime: '40 mins', totalTime: '1 hour', notes: '' },
  { id: 'sh-08', scene: 1, setup: 8, shot: 8, shotType: 'CU', movement: 'Stationary', location: 'The Cake Shop Counter', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'CLOSE: Cake drops into a bin', cast: ['Cake Shop Owner'], pages: '2', setupTime: '10 mins', shootTime: '10 mins', totalTime: '20 mins', notes: '' },
  { id: 'sh-09', scene: 1, setup: 9, shot: 9, shotType: 'MS', movement: 'Handheld', location: 'The Cake Shop Counter', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'FOLLOW: Cake Shop Owner into staff room, pan to reveal Man with a Gun – and dialogue', cast: ['Cake Shop Owner', 'Man with a Gun'], pages: '2', setupTime: '30 mins', shootTime: '20 mins', totalTime: '50 mins', notes: 'Handheld follow. Pan slightly to reveal.' },
  { id: 'sh-10', scene: 1, setup: 10, shot: 10, shotType: 'CU', movement: 'Stationary', location: 'The Cake Shop', intExt: 'INT', timeOfDay: 'DAY', sound: false, description: 'Cutaways', cast: [], pages: 'ALL', setupTime: '', shootTime: '', totalTime: '15 mins', notes: '' },
  // Optional / may not need
  { id: 'sh-11', scene: 2, setup: 1, shot: 1, shotType: 'CU', movement: 'Stationary', location: 'The Staff Room', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'Gun clicks behind head of CSO – close on CSO, gun out of focus', cast: ['Cake Shop Owner', 'Man with a Gun'], pages: '2', setupTime: '15 mins', shootTime: '15 mins', totalTime: '30 mins', notes: 'MAY NOT NEED – optional pick-up' },
  { id: 'sh-12', scene: 2, setup: 1, shot: 2, shotType: 'CU', movement: 'Stationary', location: 'The Staff Room', intExt: 'INT', timeOfDay: 'DAY', sound: true, description: 'Same as previous, Man with a Gun\'s head also in shot', cast: ['Cake Shop Owner', 'Man with a Gun'], pages: '2', setupTime: '15 mins', shootTime: '15 mins', totalTime: '30 mins', notes: 'MAY NOT NEED – optional pick-up' },
];

// ─── Storyboard frames ───────────────────────────────────────────

const _CAKE_MAN_STORYBOARD_FRAMES = [
  {
    id: 'sbf-01', frameNumber: 1,
    sceneKey: 'INT. CAKE SHOP - DAY', sceneHeading: 'INT. CAKE SHOP - DAY',
    shotType: 'Establishing', movement: 'Static', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'A wilted balloon – title shot. THE CAKE MAN.',
    dialogue: '', notes: 'Opening title card shot.', duration: ''
  },
  {
    id: 'sbf-02', frameNumber: 2,
    sceneKey: 'INT. CAKE SHOP - DAY', sceneHeading: 'INT. CAKE SHOP - DAY',
    shotType: 'Close-Up', movement: 'Static', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'Wilted flowers in a vase.',
    dialogue: '', notes: 'Establishing the sad decorations.', duration: ''
  },
  {
    id: 'sbf-03', frameNumber: 3,
    sceneKey: 'INT. CAKE SHOP - DAY', sceneHeading: 'INT. CAKE SHOP - DAY',
    shotType: 'Close-Up', movement: 'Static', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'Cake placed onto counter and pushed to centre.',
    dialogue: 'CAKE SHOP OWNER: "Aaand, here it is."',
    notes: 'Shot 1 on the schedule. CSO slides cake toward camera.', duration: ''
  },
  {
    id: 'sbf-04', frameNumber: 4,
    sceneKey: 'INT. CAKE SHOP - DAY', sceneHeading: 'INT. CAKE SHOP - DAY',
    shotType: 'Close-Up', movement: 'Static', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'Close up – Cake Shop Owner reacts. Full scene dialogue.',
    dialogue: 'CAKE SHOP OWNER: "It\'s your Vanilla Sponge Deluxe..."',
    notes: 'Shot 2 on schedule. Single on CSO.', duration: ''
  },
  {
    id: 'sbf-05', frameNumber: 5,
    sceneKey: 'INT. CAKE SHOP - DAY', sceneHeading: 'INT. CAKE SHOP - DAY',
    shotType: 'Close-Up', movement: 'Static', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'Close up – Cake Buyer reacts. "What\'s this?"',
    dialogue: 'CAKE BUYER: "What\'s this? / If that\'s a dog..."',
    notes: 'Shot 3. Single on Cake Buyer throughout.', duration: ''
  },
  {
    id: 'sbf-06', frameNumber: 6,
    sceneKey: 'INT. CAKE SHOP - DAY', sceneHeading: 'INT. CAKE SHOP - DAY',
    shotType: 'Medium', movement: 'Static', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'Mid – Cake Shop Owner full scene.',
    dialogue: '', notes: 'Shot 5. CSO mid shot.', duration: ''
  },
  {
    id: 'sbf-07', frameNumber: 7,
    sceneKey: 'INT. CAKE SHOP - DAY', sceneHeading: 'INT. CAKE SHOP - DAY',
    shotType: 'Medium', movement: 'Static', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'Mid – Cake Buyer full scene.',
    dialogue: '', notes: 'Shot 4. CB mid shot.', duration: ''
  },
  {
    id: 'sbf-08', frameNumber: 8,
    sceneKey: 'INT. CAKE SHOP - DAY', sceneHeading: 'INT. CAKE SHOP - DAY',
    shotType: 'Wide', movement: 'Static', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'Wide from side of counter – both characters, full scene.',
    dialogue: '', notes: 'Shot 6. Side-on wide establishing both characters.', duration: ''
  },
  {
    id: 'sbf-09', frameNumber: 9,
    sceneKey: 'INT. CAKE SHOP - DAY', sceneHeading: 'INT. CAKE SHOP - DAY',
    shotType: 'Close-Up', movement: 'Static', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'Shot of cake – can see both characters\' hands pointing every now and then. "Happy Brithday Brain."',
    dialogue: '', notes: 'Shot 7. CU on cake with occasional hands intruding.', duration: ''
  },
  {
    id: 'sbf-10', frameNumber: 10,
    sceneKey: 'INT. CAKE SHOP - DAY', sceneHeading: 'INT. CAKE SHOP - DAY',
    shotType: 'Close-Up', movement: 'Static', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'Cake dropped into bin from above.',
    dialogue: '', notes: 'Shot 10 (bin). Overhead looking down into bin.', duration: ''
  },
  {
    id: 'sbf-11', frameNumber: 11,
    sceneKey: 'INT. STAFF ROOM - CONTINUOUS', sceneHeading: 'INT. STAFF ROOM - CONTINUOUS',
    shotType: 'Medium', movement: 'Handheld', lens: '', transition: 'Cut',
    imageDataUrl: null,
    action: 'Follow into back room – camera pans slightly to reveal Man with a Gun.',
    dialogue: 'MAN WITH A GUN: "Do another one."',
    notes: 'Shot 9. Handheld follow. The reveal. Key shot.', duration: ''
  },
];

// ─── Full project object ─────────────────────────────────────────

function _buildSampleProject() {
  const now = Date.now();
  return {
    id: BF_SAMPLE_PROJECT_ID,
    _isSample: true,

    // Core info
    title: 'The Cake Man',
    num: 'GT#9',
    status: 'done',
    director: 'Tom Murphy',
    producer: 'Tom Murphy, Cat Lewis',
    company: 'Grim Tidings Picture Company',
    genre: 'Dark Comedy',
    logline: 'A cake shop owner is forced to produce a terrible cake at gunpoint.',
    synopsis: 'A customer enters a cake shop to collect a birthday cake. The cake is a disaster – misspelled, badly decorated, clearly the work of someone under enormous pressure. After a deadpan exchange the customer leaves without paying, the cake goes in the bin, and we follow the cake shop owner into the back room to discover the reason for the terrible workmanship: a man with a gun demanding he do another one.',
    outline: '',
    notes: 'This is a sample project pre-loaded by Black Fountain to help you explore the app. It\'s based on a real short film produced by Grim Tidings Picture Company in October 2023. Feel free to edit anything – you can always reset it from Settings.',

    // Additional required fields
    directors: ['Tom Murphy'],
    producers: ['Tom Murphy', 'Cat Lewis'],
    contact: '',
    website: '',

    // Dates
    shootDate: '2023-10-08',
    createdAt: 1690156800000,
    updatedAt: now,

    // Content sections (for production plan)
    script: '',
    breakdown: '',
    shotlist: '',
    schedule: '',
    callsheet: '',
    budget: '',
    locations: '',
    gear: '',
    cast: '',
    unit: '',
    storyboard: '',
    moodboard: '',
    risk: '',
    notes: '',

    // Legacy/empty arrays to prevent errors
    contacts: [],

    // Script
    scripts: [
      {
        id: 'script-001',
        name: 'The Cake Man v1.1',
        version: 'v1.1',
        type: 'text/plain',
        size: _CAKE_MAN_SCRIPT.length,
        origExt: 'txt',
        text: _CAKE_MAN_SCRIPT,
        uploadedAt: 1690156800000,
        active: true,
      }
    ],

    // Script breakdown
    scriptBreakdown: null, // legacy — use breakdowns[]
    breakdowns: [
      {
        id: 'bd-001',
        name: 'Main Breakdown',
        version: 'v1',
        rawText: _CAKE_MAN_BREAKDOWN,
        tags: [
          // Scene 1 cast
          { id: 'tag-01', category: 'cast',     start: _CAKE_MAN_BREAKDOWN.indexOf('Cake Shop Owner\n'), end: _CAKE_MAN_BREAKDOWN.indexOf('Cake Shop Owner\n') + 15 },
          { id: 'tag-02', category: 'cast',     start: _CAKE_MAN_BREAKDOWN.indexOf('Cake Buyer\n'),     end: _CAKE_MAN_BREAKDOWN.indexOf('Cake Buyer\n') + 10 },
          // Scene 1 props
          { id: 'tag-03', category: 'props',    start: _CAKE_MAN_BREAKDOWN.indexOf('Badly decorated'), end: _CAKE_MAN_BREAKDOWN.indexOf('Badly decorated') + 40 },
          { id: 'tag-04', category: 'props',    start: _CAKE_MAN_BREAKDOWN.indexOf('Counter'),         end: _CAKE_MAN_BREAKDOWN.indexOf('Counter') + 7 },
          { id: 'tag-05', category: 'props',    start: _CAKE_MAN_BREAKDOWN.indexOf('Bin'),             end: _CAKE_MAN_BREAKDOWN.indexOf('Bin') + 3 },
          { id: 'tag-06', category: 'props',    start: _CAKE_MAN_BREAKDOWN.indexOf('Balloons'),        end: _CAKE_MAN_BREAKDOWN.indexOf('Balloons') + 20 },
          { id: 'tag-07', category: 'props',    start: _CAKE_MAN_BREAKDOWN.indexOf('Wilted flowers'),  end: _CAKE_MAN_BREAKDOWN.indexOf('Wilted flowers') + 13 },
        ],
        scriptId: 'script-001',
        activeBreakdownId: 'bd-001',
        createdAt: 1690156800000,
      }
    ],

    // Cast & extras
    cast: _CAKE_MAN_CAST,
    extras: [],

    // Unit / crew
    unit: _CAKE_MAN_UNIT,

    // Budget
    budget: _CAKE_MAN_BUDGET,

    // Equipment - use both formats for compatibility
    equipment: {},
    gearList: _CAKE_MAN_GEAR_LIST,  // New format with categories for production plan
    gearPool: _CAKE_MAN_GEAR,  // Legacy format for schedule view

    // Schedule
    schedule: _CAKE_MAN_SCHEDULE,

    // Shots
    shots: _CAKE_MAN_SHOTS,

    // Callsheets
    callsheets: [_CAKE_MAN_CALLSHEET],

    // Locations & scouting
    locations: _CAKE_MAN_LOCATIONS,
    scoutingSheets: [],

    // Storyboard
    storyboard: {
      id: 'sb-001',
      frames: _CAKE_MAN_STORYBOARD_FRAMES,
    },

    // Moodboard
    moodboard: { id: 'mb-001', images: [] },

    // Brief / production plan
    brief: {
      concept: 'A darkly comic short about the impossible pressures of small business ownership. Played completely straight.',
      references: 'Inspired by the "Dystopian Realism" house style – ordinary people in slightly-off situations, no winking at the camera.',
      style: 'INT locations only. Natural / available light augmented. Handheld for the staff room reveal. Everything else locked off.',
      tone: 'Deadpan. Uncomfortable. Funny without trying to be funny.',
    },

    // Custom sections
    customSections: [],
  };
}

// ─── Injection logic ─────────────────────────────────────────────

/**
 * Call this from init / startup.
 * Inserts the sample project into the store if:
 *   a) no projects exist yet, OR
 *   b) the sample project is missing and the user hasn't explicitly deleted it
 *
 * Pass force=true from Settings > Reset Sample Project.
 */
function injectSampleProject(force = false) {
  try {
    // Access global store - must ensure it exists
    if (typeof store === 'undefined') {
      console.error('[BF] Store is not defined!');
      return;
    }
    
    // Ensure store has projects array
    if (!store.projects) {
      store.projects = [];
    }
    
    const projects = store.projects;
    const alreadyExists = projects.find(p => p.id === BF_SAMPLE_PROJECT_ID);

    console.log('[BF] injectSampleProject called, force:', force, 'projects count:', projects.length, 'already exists:', !!alreadyExists);

    // If force (reset), remove existing first
    if (alreadyExists && force) {
      const idx = projects.findIndex(p => p.id === BF_SAMPLE_PROJECT_ID);
      if (idx !== -1) projects.splice(idx, 1);
    }

    // Inject if: force=true (reset/load), OR no projects exist at all
    if (force || projects.length === 0) {
      const sample = _buildSampleProject();
      projects.unshift(sample);

      console.log('[BF] Sample project injected:', sample.title, 'status:', sample.status, 'total projects:', projects.length);
      
      // Save and refresh both dashboard and sidebar
      if (typeof saveStore === 'function') saveStore();
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof renderSidebarProjects === 'function') renderSidebarProjects();
      
      // Show feedback when loaded manually
      if (force && typeof showToast === 'function') {
        showToast('Sample project loaded: ' + sample.title, 'success');
      }
      
      // Navigate to dashboard if needed
      if (typeof showView === 'function') {
        showView('dashboard');
      }
    } else if (force && alreadyExists) {
      // Already loaded, just notify
      if (typeof showToast === 'function') {
        showToast('Sample project already loaded', 'info');
      }
    }
  } catch (e) {
    console.warn('[BF] Could not inject sample project:', e);
  }
}

/**
 * Reset the sample project to its original state.
 * Call from Settings.
 */
function resetSampleProject() {
  injectSampleProject(true);
  if (typeof showToast === 'function') showToast('Sample project reset to original', 'success');
  if (typeof renderDashboard === 'function') {
    renderDashboard();
  } else if (typeof showView === 'function') {
    showView('dashboard');
  }
}

// MODAL HELPERS - Ensure these are always available
function openModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) { console.log('overlay NOT FOUND:', id); return; }
  const modal = overlay.querySelector('.modal');
  if (modal) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const heading = modal.querySelector('h2, h3, [class*="modal-title"]');
    if (heading) {
      if (!heading.id) heading.id = id + '-title';
      modal.setAttribute('aria-labelledby', heading.id);
    }
    modal.querySelectorAll('.modal-close').forEach(btn => {
      if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', 'Close');
    });
  }
  overlay.classList.add('open');
  overlay.style.display = 'flex';
  overlay.dataset.justOpened = Date.now();
  setTimeout(() => {
    const first = overlay.querySelector('input:not([type=hidden]), textarea, select, button:not(.modal-close)');
    if (first) first.focus();
    else { const close = overlay.querySelector('.modal-close'); if (close) close.focus(); }
  }, 60);
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    el.style.display = 'none';
  }
}

(function initTooltip() {
  const tip = document.createElement('div');
  tip.id = 'global-tip';
  document.body.appendChild(tip);
  let current = null;
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    if (!el || el.classList.contains('tooltip-info')) return;
    current = el;
    tip.textContent = el.dataset.tip;
    tip.style.display = 'block';
  });
  document.addEventListener('mousemove', e => {
    if (!current) return;
    const x = e.clientX + 14, y = e.clientY - 44;
    tip.style.left = Math.min(x, window.innerWidth - 316) + 'px';
    tip.style.top = Math.max(y, 8) + 'px';
  });
  document.addEventListener('mouseout', e => {
    if (current && !current.contains(e.relatedTarget)) { current = null; tip.style.display = 'none'; }
  });
})();

// Dropdown toggle functionality
document.addEventListener('click', function(e) {
  const toggle = e.target.closest('.dropdown-toggle');
  if (toggle) {
    e.preventDefault();
    const dropdown = toggle.closest('.dropdown');
    const wasOpen = dropdown.classList.contains('open');
    // Close all dropdowns
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
    // Toggle clicked dropdown
    if (!wasOpen) dropdown.classList.add('open');
  } else if (!e.target.closest('.dropdown-menu') && !e.target.closest('input[type="file"]')) {
    // Close dropdowns when clicking outside, but not for file input clicks
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  }
});

loadTheme();

// ══════════════════════════════════════════
// INFRASTRUCTURE INITIALIZATION
// ══════════════════════════════════════════

function _initInfrastructure() {
  // Initialize EventBus listeners
  
  // Listen for data changes and refresh autocomplete
  if (window.EventBus) {
    EventBus.on(EventBus.Events.DATA_CHANGED, () => {
      if (window.AutoComplete) {
        AutoComplete.refreshAll();
      }
      if (window.Data) {
        Data.clearCache();
      }
    });
    
    // Listen for project changes
    EventBus.on(EventBus.Events.PROJECT_SWITCHED, () => {
      if (window.Data) {
        Data.clearCache();
      }
    });
    
    // Listen for data saved events
    EventBus.on(EventBus.Events.DATA_SAVED, () => {
      if (window.Data) {
        Data.clearCache();
      }
    });
  }
  
  // Initialize autocomplete datalists
  if (window.AutoComplete) {
    // Initial refresh after store loads
    setTimeout(() => AutoComplete.refreshAll(), 100);
  }
  
  console.log('[Infrastructure] Initialized EventBus, Data layer, and AutoComplete');
}

async function _startApp() {
  try {
    // Check for previous emergency backup issues first
    if (typeof checkEmergencyBackup === 'function') {
      checkEmergencyBackup();
    }
    
    await loadStore();

    // Inject sample project if none exist
    console.log('[BF] Checking for sample project injection...');
    if (typeof injectSampleProject === 'function') {
      injectSampleProject();
    }

    // Ensure sidebar projects are rendered after store is loaded
    // This is called both here and inside injectSampleProject for redundancy
    if (typeof renderSidebarProjects === 'function') {
      console.log('[BF] Rendering sidebar projects');
      renderSidebarProjects();
    }

    // Apply cloud-loaded preferences immediately
    if (typeof Prefs !== 'undefined' && Prefs.applyAll) {
      Prefs.applyAll();
    }

    // Run silent contact migration to link existing personnel to contacts
    if (typeof ContactAnchor !== 'undefined') {
      ContactAnchor.runSilentMigration();
    }

    // Migrate all scene entities to new format
    if (typeof SceneEntity !== 'undefined') {
      SceneEntity.migrateAll();
    }

    // Apply theme/font preferences from cloud store
    if (typeof loadTheme === 'function') {
      loadTheme();
    }
    
    // Initialize new infrastructure modules
    _initInfrastructure();
    
    initAutoSave();
    // Wait for views to be loaded before showing the appropriate view
    if (window.viewLoader?.preloadAllViews) {
      await window.viewLoader.preloadAllViews();
    }

    // Try to restore the previously active view from localStorage
    let restoredView = null;
    try {
      const savedView = localStorage.getItem('bf_currentView');
      console.log('[ViewRestore] Checking for saved view, found:', savedView);
      if (savedView) {
        restoredView = JSON.parse(savedView);
        console.log('[ViewRestore] Parsed view:', restoredView);
      }
    } catch (e) {
      console.warn('Could not restore view:', e);
    }

    if (restoredView) {
      if (restoredView.type === 'global') {
        // Restore global view (dashboard, contacts, etc.)
        showView(restoredView.name);
        // Also trigger render for the restored view
        if (restoredView.name === 'dashboard') {
          renderDashboard();
        }
      } else if (restoredView.type === 'project') {
        // Restore project view
        const projectExists = store.projects?.some(p => p.id === restoredView.projectId);
        if (projectExists) {
          showProjectView(restoredView.projectId);
          // Restore the specific section if available
          if (restoredView.section) {
            showSection(restoredView.section);
          } else {
            showSection('overview');
          }
        } else {
          // Project no longer exists, fall back to dashboard
          showView('dashboard');
          renderDashboard();
        }
      }
    } else {
      // No saved view, show dashboard as default
      showView('dashboard');
      renderDashboard();
    }
  } catch(e) {
    console.error('[_startApp] init failed:', e);
  } finally {
    document.body.classList.remove('loading');
  }
  const pendingToast = sessionStorage.getItem('_mf_post_reload_toast');
  if (pendingToast) {
    sessionStorage.removeItem('_mf_post_reload_toast');
    try { const { msg, type } = JSON.parse(pendingToast); showToast(msg, type); } catch(e) {}
  }
}
sbInit(_startApp);

// ── Contact modal role sections ───────────────────────────────────────────────
function ecToggleRoleSections() {
  const isCast = document.getElementById('edit-contact-type-cast').checked;
  const isCrew = document.getElementById('edit-contact-type-crew').checked;
  document.getElementById('ec-cast-roles-section').style.display = isCast ? 'block' : 'none';
  document.getElementById('ec-crew-roles-section').style.display = isCrew ? 'block' : 'none';
  // Update project-role inputs to suggest the right kind of roles
  const listId = (isCast && !isCrew) ? 'cast-roles-datalist'
               : (!isCast && isCrew) ? 'roles-datalist'
               : 'all-roles-datalist';
  document.querySelectorAll('#edit-contact-projects-container .contact-role-input').forEach(inp => {
    inp.setAttribute('list', listId);
  });
}

function ecAddRole(type) {
  const inputId = type === 'cast' ? 'ec-cast-role-input' : 'ec-crew-role-input';
  const tagsId  = type === 'cast' ? 'ec-cast-roles-tags'  : 'ec-crew-roles-tags';
  const input = document.getElementById(inputId);
  const val = (input.value || '').trim();
  if (!val) return;
  const container = document.getElementById(tagsId);
  const existing = [...container.querySelectorAll('[data-role]')].map(t => t.dataset.role.toLowerCase());
  if (existing.includes(val.toLowerCase())) { input.value = ''; return; }
  const chip = document.createElement('span');
  chip.dataset.role = val;
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 8px;background:var(--surface3);border-radius:12px;color:var(--text2);margin-bottom:2px;';
  chip.innerHTML = `${val} <span style="cursor:pointer;color:var(--text3);font-size:10px;" onclick="this.closest('[data-role]').remove()">✕</span>`;
  container.appendChild(chip);
  input.value = '';
  input.focus();
}

function ecClearRoles() {
  const c = document.getElementById('ec-cast-roles-tags');
  const r = document.getElementById('ec-crew-roles-tags');
  if (c) c.innerHTML = '';
  if (r) r.innerHTML = '';
  const ci = document.getElementById('ec-cast-role-input');
  const ri = document.getElementById('ec-crew-role-input');
  if (ci) ci.value = '';
  if (ri) ri.value = '';
}

function closeEditContactModal() {
  _mfNewPersonCallback = null;
  document.getElementById('edit-contact-modal-title').textContent = 'Edit Contact';
  closeModal('modal-edit-contact');
}

function ecGetRoles(type) {
  const tagsId = type === 'cast' ? 'ec-cast-roles-tags' : 'ec-crew-roles-tags';
  return [...(document.getElementById(tagsId)?.querySelectorAll('[data-role]') || [])].map(t => t.dataset.role).filter(Boolean);
}

// ── Role autocomplete ─────────────────────────────────────────────────────────
function refreshRolesDatalist() {
  const roles = new Set();
  store.projects.forEach(p => {
    (p.unit || []).forEach(r => { if (r.role) roles.add(r.role); });
    (p.contacts || []).forEach(c => {
      if ((c.type || '').includes('cast') && !(c.type || '').includes('crew')) return;
      (c.crewRoles || []).forEach(r => { if (r) roles.add(r); });
      (c.roles || []).forEach(r => { if (r && r !== 'Cast' && r !== 'Extra') roles.add(r); });
    });
  });
  (store.contacts || []).forEach(c => {
    if ((c.type || '').includes('cast') && !(c.type || '').includes('crew')) return;
    const crewRoles = c.crewRoles;
    if (Array.isArray(crewRoles)) {
      crewRoles.forEach(r => { if (r) roles.add(r); });
    } else if (crewRoles && typeof crewRoles === 'object') {
      // Handle object format (projectId -> role)
      Object.values(crewRoles).forEach(r => { if (r) roles.add(r); });
    }
    if (c.defaultRole && !(c.type || '').includes('cast')) roles.add(c.defaultRole);
  });
  const crewDefaults = [
    'Director','Assistant Director','1st AD','2nd AD','3rd AD',
    'Director of Photography','Cinematographer','Camera Operator','Focus Puller','1st AC','2nd AC','Clapper Loader','DIT',
    'Gaffer','Best Boy Electric','Electrician','Key Grip','Best Boy Grip','Grip','Dolly Grip',
    'Production Designer','Art Director','Set Decorator','Set Dresser','Props Master','Props Buyer',
    'Costume Designer','Wardrobe Supervisor','Wardrobe Assistant','Make-Up Artist','Hair Stylist','SFX Make-Up',
    'Sound Mixer','Boom Operator','Sound Assistant',
    'Script Supervisor','Continuity',
    'Executive Producer','Producer','Line Producer','Co-Producer','Associate Producer',
    'Production Manager','Production Coordinator','Production Assistant','Runner',
    'Location Manager','Location Scout','Facilities Manager',
    'Casting Director','Casting Associate',
    'Editor','Assistant Editor','Colorist','Colourist','VFX Supervisor','VFX Artist','Motion Graphics',
    'Stunt Coordinator','Stunt Performer','Stunt Double',
    'Composer','Music Supervisor',
    'Unit Publicist','Still Photographer','Behind The Scenes',
    'Catering','Driver','Security'
  ];
  const allCrewRoles = new Set([...roles, ...crewDefaults]);
  const dl = document.getElementById('roles-datalist');
  if (dl) dl.innerHTML = Array.from(allCrewRoles).sort().map(r => `<option value="${r}">`).join('');

  // all-roles-datalist = crew roles + cast roles
  const castDefaults = ['Actor','Actress','Lead Actor','Lead Actress','Supporting Actor','Supporting Actress','Voice Actor','Singer','Vocalist','Musician','Dancer','Performer','Entertainer','Comedian','Stunt Double','Stand-In','Extra','Multi-Role'];
  const allRoles = new Set([...allCrewRoles, ...castDefaults]);
  const dlAll = document.getElementById('all-roles-datalist');
  if (dlAll) dlAll.innerHTML = Array.from(allRoles).sort().map(r => `<option value="${r}">`).join('');
}

// ══════════════════════════════════════════
// CONTEXT MENU
// ══════════════════════════════════════════
let _ctxFns = [];

function _ctxRun(i) {
  _ctxFns[i]?.();
  document.getElementById('ctx-menu').style.display = 'none';
}

function showContextMenu(e, items) {
  e.preventDefault();
  e.stopPropagation();
  _ctxFns = [];
  window._ctxSubmenuData = [];
  window._activeSubmenu = null;
  let fi = 0;
  const menu = document.getElementById('ctx-menu');

  // Hide any open submenu first
  const sub = document.getElementById('ctx-submenu');
  if (sub) sub.style.display = 'none';

  menu.innerHTML = items.map(item => {
    if (!item) return '<div class="ctx-sep"></div>';
    const i = fi++;
    _ctxFns.push(item.fn || (() => {}));
    window._ctxSubmenuData[i] = item.submenu || null;
    const danger  = item.danger ? ' ctx-danger' : '';
    const hasSub  = item.submenu && item.submenu.length;
    let html = `<div class="ctx-item${danger}${hasSub ? ' ctx-has-sub' : ''}" data-ctx-idx="${i}"`;
    if (hasSub) {
      // Use mouseenter for hover — not mousedown
      html += ` onmouseenter="showCtxSubmenu(this,${i})"`;
    } else {
      html += ` onmouseenter="_ctxHideSubmenu()"`;
      html += ` onclick="event.stopPropagation();_ctxRun(${i})"`;
    }
    html += `><span class="ctx-icon">${item.icon||''}</span><span>${item.label}</span>`;
    if (hasSub) html += '<span class="ctx-arrow">▸</span>';
    html += '</div>';
    return html;
  }).join('');

  const rows = items.filter(Boolean).length;
  const menuH = rows * 32 + 12;
  const x = Math.min(e.clientX, window.innerWidth - 220);
  const y = Math.min(e.clientY, window.innerHeight - menuH - 4);
  menu.style.left = Math.max(4, x) + 'px';
  menu.style.top  = Math.max(4, y) + 'px';
  menu.style.display = 'block';
}

function showCtxSubmenu(el, idx) {
  const sub = window._ctxSubmenuData[idx];
  if (!sub || !sub.length) return;

  const subMenu = document.getElementById('ctx-submenu');
  if (!subMenu) return;

  // Build submenu with its own _subFns array so _ctxRun still works
  window._ctxSubFns = [];
  let fi = 0;

  subMenu.innerHTML = sub.map(item => {
    if (!item) return '<div class="ctx-sep"></div>';
    const i = fi++;
    window._ctxSubFns.push(item.fn || (() => {}));
    const danger = item.danger ? ' ctx-danger' : '';
    return `<div class="ctx-item${danger}" onclick="event.stopPropagation();_ctxSubRun(${i})"><span class="ctx-icon">${item.icon||''}</span><span>${item.label}</span></div>`;
  }).join('');

  // Position to the right of the hovered item
  const rect    = el.getBoundingClientRect();
  const menuEl  = document.getElementById('ctx-menu');
  const menuRect= menuEl.getBoundingClientRect();
  const subW    = 200;
  const subH    = sub.length * 32 + 12;

  // Prefer right, fall back to left
  const rightSpace = window.innerWidth - menuRect.right;
  const subLeft = rightSpace >= subW
    ? menuRect.right - 2
    : menuRect.left - subW + 2;

  const subTop = Math.min(rect.top, window.innerHeight - subH - 4);

  subMenu.style.left    = Math.max(4, subLeft) + 'px';
  subMenu.style.top     = Math.max(4, subTop)  + 'px';
  subMenu.style.display = 'block';
  window._activeSubmenu = idx;
}

function _ctxSubRun(i) {
  // Run submenu item function and close everything
  const fn = window._ctxSubFns?.[i];
  document.getElementById('ctx-menu').style.display    = 'none';
  document.getElementById('ctx-submenu').style.display = 'none';
  window._activeSubmenu = null;
  if (typeof fn === 'function') fn();
}

function _ctxHideSubmenu() {
  const sub = document.getElementById('ctx-submenu');
  if (sub) sub.style.display = 'none';
  window._activeSubmenu = null;
}

document.addEventListener('click', (e) => {
  const menu    = document.getElementById('ctx-menu');
  const subMenu = document.getElementById('ctx-submenu');

  const inMenu    = menu?.contains(e.target);
  const inSubMenu = subMenu?.contains(e.target);

  // If click is outside both menu and submenu, close everything
  if (!inMenu && !inSubMenu) {
    if (menu)    menu.style.display    = 'none';
    if (subMenu) subMenu.style.display = 'none';
    window._activeSubmenu = null;
  }

  // Close rp-confirm if click outside it
  const cf = document.getElementById('rp-confirm');
  if (cf && !cf.contains(e.target)) cf.remove();
});

// Keep submenu open when mouse moves between parent item and submenu.
// We need a small bridge — mouse leaving the menu item toward the submenu
// should not close it. The mouseleave on the submenu itself closes it
// only when leaving toward somewhere that isn't the parent menu.
document.addEventListener('mouseover', (e) => {
  const subMenu = document.getElementById('ctx-submenu');
  if (!subMenu || subMenu.style.display === 'none') return;
  const menu = document.getElementById('ctx-menu');
  // If mouse is now over the submenu or still over the main menu, keep it open
  if (subMenu.contains(e.target) || menu?.contains(e.target)) return;
  // Otherwise hide the submenu
  subMenu.style.display = 'none';
  window._activeSubmenu = null;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const m = document.getElementById('ctx-menu'); if (m) m.style.display = 'none'; }
});
document.addEventListener('contextmenu', e => {
  const el = e.target.closest('[data-ctx]');
  if (!el) return;
  e.preventDefault();
  const ctx = el.dataset.ctx;
  const sep = ctx.indexOf(':');
  const type = sep >= 0 ? ctx.slice(0, sep) : ctx;
  const rawArgs = sep >= 0 ? ctx.slice(sep + 1) : '';
  const args = rawArgs.split(':');
  let items = [];

  switch (type) {
    case 'personnel':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editPersonnel(args[0], +args[1]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removePersonnel(args[0], +args[1]) }
      ]; break;
    case 'schedule':
      items = [
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeScheduleRow(+args[0]) }
      ]; break;
    case 'budget': {
      const bLine = currentProject()?.budget[+args[0]];
      const isAtl = bLine?.section === 'atl';
      items = [
        { label: 'Edit', icon: '✎', fn: () => editBudgetLine(+args[0]) },
        { label: 'Duplicate Line', icon: '⧉', fn: () => duplicateBudgetLine(+args[0]) },
        { label: isAtl ? 'Move to BTL' : 'Move to ATL', icon: '↕', fn: () => moveBudgetLineSection(+args[0]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeBudgetLine(+args[0]) }
      ]; break;
    }
    case 'proj-loc': {
      const locIdx  = +args[0];
      const locName = decodeURIComponent(args[1] || '');
      const p       = currentProject();
      const otherLocs = p?.locations?.filter((_, i) => i !== locIdx) || [];

      // Build import submenu:
      // First item = import from outside this project (opens existing modal)
      // Then a separator
      // Then other locations in this project
      const importSubmenu = [
        {
          label: 'From another project or database…',
          icon:  '🌐',
          fn:    () => openImportLocationModal()
        },
        ...(otherLocs.length > 0 ? [null] : []),  // separator only if there are local options
        ...otherLocs.map(l => {
          const actualIdx = p.locations.indexOf(l);
          return {
            label: l.name || 'Unnamed',
            icon:  '📍',
            fn:    () => importLocationFrom(actualIdx, locIdx)
          };
        })
      ];

      items = [
        { label: 'Edit',      icon: '✎', fn: () => editLocation(locIdx) },
        { label: 'Duplicate', icon: '⧉', fn: () => duplicateLocation(locIdx) },
        { label: 'Import from…', icon: '📥', submenu: importSubmenu },
        null,
        { label: 'Open Scouting Sheet',       icon: '🗺', fn: () => openScoutingSheetForLocation(locName) },
        { label: 'Open Tech Scout Checklist', icon: '☑',  fn: () => openTechScoutForLocation(locName) },
        null,
        { label: 'Remove from Project', icon: '🗑', danger: true, fn: () => removeLocation(locIdx) }
      ];
      break;
    }
    case 'shot':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editShot(+args[0]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeShot(+args[0]) }
      ]; break;
    case 'prop':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editPropItem(args[0], +args[1]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removePropItem(args[0], +args[1]) }
      ]; break;
    case 'wardrobe':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editWardrobeItem(+args[0]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeWardrobeItem(+args[0]) }
      ]; break;
    case 'sound':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editSoundEntry(+args[0]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeSoundEntry(+args[0]) }
      ]; break;
    case 'risk':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editRiskRow(+args[0]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeRiskRow(+args[0]) }
      ]; break;
    case 'contact': {
      const cname = decodeURIComponent(rawArgs);
      items = [
        { label: 'Edit', icon: '✎', fn: () => editContact(cname) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeContact(cname) }
      ]; break;
    }
    case 'loc-global': {
      const pid = args[0], lidx = +args[1];
      const _locObj = pid === '_global'
        ? (store.locations||[])[lidx]
        : (store.projects.find(p=>p.id===pid)?.locations||[])[lidx];
      const _locName = _locObj?.name || '';
      items = [
        { label: 'Edit', icon: '✎', fn: () => editLocationGlobal(pid, lidx) },
        { label: 'Move / Copy', icon: '⇄', fn: () => openMoveLocation(pid, lidx) },
        null,
        { label: 'Create Scouting Sheet', icon: '🗺', fn: () => openCreateScoutModal(_locName, 'scout') },
        { label: 'Create Tech Checklist', icon: '☑', fn: () => openCreateScoutModal(_locName, 'tech') },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => deleteLocationGlobal(pid, lidx) }
      ]; break;
    }
    case 'bud-col': {
      const colId = args[0];
      items = [
        { label: 'Hide Column', icon: '👁', fn: () => toggleBudgetColVisibility(colId) },
        null,
        { label: 'Manage Columns', icon: '⚙', fn: () => openBudgetColumnsModal() }
      ]; break;
    }
    case 'col-contact': {
      const colId = args[0];
      items = [
        { label: 'Hide Column', icon: '👁', fn: () => toggleContactColVisibility(colId) },
        null,
        { label: 'Manage Columns', icon: '⚙', fn: () => openContactColumnsModal() }
      ]; break;
    }
    case 'col-location': {
      const colId = args[0];
      items = [
        { label: 'Hide Column', icon: '👁', fn: () => toggleLocationColVisibility(colId) },
        null,
        { label: 'Manage Columns', icon: '⚙', fn: () => openLocationColumnsModal() }
      ]; break;
    }
    case 'file-card': {
      const fid = args[0];
      items = [
        { label: 'Rename', icon: '✏️', fn: () => openManageFile(fid) },
        { label: 'Move to Project', icon: '🔀', fn: () => openMoveFile([fid], null) },
        { label: 'Download', icon: '⬇', fn: () => downloadFile(fid) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => openRemoveFiles([fid], null) }
      ]; break;
    }
    case 'script-file': {
      const sid = args[0];
      items = [
        { label: 'Rename', icon: '✏️', fn: () => openScriptRename(sid) },
        { label: 'Share', icon: '↗', fn: () => shareScriptFile(sid) },
        { label: 'Download', icon: '⬇', fn: () => downloadScriptFile(sid) },
        null,
        { label: 'Remove', icon: '🗑', danger: true, fn: () => removeScriptFile(sid) }
      ]; break;
    }
    case 'custom-file': {
      const csId = args[0], fId = args[1];
      items = [
        { label: 'Rename', icon: '✏️', fn: () => openCustomSectionFileRename(csId, fId) },
        { label: 'Share', icon: '↗', fn: () => shareCustomSectionFile(csId, fId) },
        { label: 'Download', icon: '⬇', fn: () => downloadCustomSectionFile(csId, fId) },
        null,
        { label: 'Remove', icon: '🗑', danger: true, fn: () => removeCustomSectionFile(csId, fId) }
      ]; break;
    }
  }
  if (items.length) showContextMenu(e, items);
});
