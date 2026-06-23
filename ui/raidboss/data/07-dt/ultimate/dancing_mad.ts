import Conditions from '../../../../../resources/conditions';
import Outputs from '../../../../../resources/outputs';
import { callOverlayHandler } from '../../../../../resources/overlay_plugin_api';
import { Responses } from '../../../../../resources/responses';
import Util, { Directions } from '../../../../../resources/util';
import ZoneId from '../../../../../resources/zone_id';
import { RaidbossData } from '../../../../../types/data';
import { PluginCombatantState } from '../../../../../types/event';
import { Job } from '../../../../../types/job';
import { LocaleText, OutputStrings, TriggerSet } from '../../../../../types/trigger';

// TODO: P1 Tele-Portent configuration options

type Phase = 'p1' | 'p2' | 'p3' | 'p4';
const phases: { [id: string]: Phase } = {
  'C24C': 'p2', // Ultimate Embrace, God Kefka
  'C3F7': 'p3', // Aero III Assault (from Kefka), Chaos and Exdeath
  'C2DC': 'p4', // Kefka Says, Kefka with Chaos and Neo Exdeath
};

type ForsakenStrategy = 'steal-fire' | 'kroxy-rinon' | 'none';
type PartySlot = 'MT' | 'ST' | 'H1' | 'H2' | 'D1' | 'D2' | 'D3' | 'D4';
type PathOfLightMarker = 'stack' | 'cone' | 'spread' | 'unknown';
type PathOfLightGroup = '1238' | '4567' | 'unknown';
type PathOfLightAssignment = {
  group: PathOfLightGroup;
  partner: string | undefined;
  partnerSlot: PartySlot | undefined;
  slot: PartySlot | undefined;
};
type PathOfLightTowerOneOutput =
  | 'leftTowerInsideLeft'
  | 'rightTowerInsideRight'
  | 'rightTowerInsideLeft'
  | 'leftTowerInsideUpDown'
  | 'rightTowerOutsideRightStack'
  | 'leftTowerOutsideLeft'
  | 'leftTowerOutsideDownBait'
  | 'unknown';
type PathOfLightTowerTwoOutput =
  | 'leftTowerInsidePairBait'
  | 'rightTowerInsideSpread'
  | 'leftUpBait'
  | 'leftDownBait'
  | 'rightUpBait'
  | 'rightDownBait'
  | 'unknown';
type SlotConfigId =
  | 'partySlotMT'
  | 'partySlotST'
  | 'partySlotH1'
  | 'partySlotH2'
  | 'partySlotD1'
  | 'partySlotD2'
  | 'partySlotD3'
  | 'partySlotD4';

const partySlots: PartySlot[] = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
const slotConfigIds: Record<PartySlot, SlotConfigId> = {
  MT: 'partySlotMT',
  ST: 'partySlotST',
  H1: 'partySlotH1',
  H2: 'partySlotH2',
  D1: 'partySlotD1',
  D2: 'partySlotD2',
  D3: 'partySlotD3',
  D4: 'partySlotD4',
};
const slotRoles: Record<PartySlot, 'tank' | 'healer' | 'dps'> = {
  MT: 'tank',
  ST: 'tank',
  H1: 'healer',
  H2: 'healer',
  D1: 'dps',
  D2: 'dps',
  D3: 'dps',
  D4: 'dps',
};
const pathOfLightPartnerSlots: Record<PartySlot, PartySlot> = {
  MT: 'H1',
  H1: 'MT',
  ST: 'H2',
  H2: 'ST',
  D1: 'D3',
  D3: 'D1',
  D2: 'D4',
  D4: 'D2',
};
const pathOfLightMeleeSlots: PartySlot[] = ['MT', 'ST', 'D1', 'D2'];
const centerX = 100;
const centerY = 100;
const defaultSlotJobPriorities: Record<PartySlot, Job[]> = {
  MT: ['WAR', 'DRK', 'GNB', 'PLD'],
  ST: ['PLD', 'GNB', 'DRK', 'WAR'],
  H1: ['WHM', 'AST', 'SCH', 'SGE'],
  H2: ['SCH', 'SGE', 'WHM', 'AST'],
  D1: ['DRG', 'SAM', 'MNK', 'NIN', 'RPR', 'VPR', 'BRD', 'MCH', 'DNC', 'BLM', 'SMN', 'RDM', 'PCT'],
  D2: ['VPR', 'NIN', 'RPR', 'MNK', 'SAM', 'DRG', 'BRD', 'MCH', 'DNC', 'BLM', 'SMN', 'RDM', 'PCT'],
  D3: ['BRD', 'DNC', 'MCH', 'SMN', 'RDM', 'PCT', 'BLM', 'VPR', 'NIN', 'RPR', 'MNK', 'SAM', 'DRG'],
  D4: ['PCT', 'BLM', 'SMN', 'RDM', 'BRD', 'DNC', 'MCH', 'VPR', 'NIN', 'RPR', 'MNK', 'SAM', 'DRG'],
};
const defaultSlotJobPriorityText: Record<PartySlot, string> = {
  MT: '战士|黑骑|绝枪|骑士',
  ST: '骑士|绝枪|黑骑|战士',
  H1: '白魔|占星|学者|贤者',
  H2: '学者|贤者|白魔|占星',
  D1: '龙骑|武士|武僧|忍者|镰刀|蝰蛇|诗人|机工|舞者|黑魔|召唤|赤魔|绘灵',
  D2: '蝰蛇|忍者|镰刀|武僧|武士|龙骑|诗人|机工|舞者|黑魔|召唤|赤魔|绘灵',
  D3: '诗人|舞者|机工|召唤|赤魔|绘灵|黑魔|蝰蛇|忍者|镰刀|武僧|武士|龙骑',
  D4: '绘灵|黑魔|召唤|赤魔|诗人|舞者|机工|蝰蛇|忍者|镰刀|武僧|武士|龙骑',
};

const jobAliases: { [jobName: string]: Job } = {
  PLD: 'PLD',
  骑士: 'PLD',
  圣骑: 'PLD',
  WAR: 'WAR',
  战士: 'WAR',
  DRK: 'DRK',
  黑骑: 'DRK',
  暗骑: 'DRK',
  黑暗骑士: 'DRK',
  暗黑骑士: 'DRK',
  GNB: 'GNB',
  绝枪: 'GNB',
  枪刃: 'GNB',
  绝枪战士: 'GNB',
  WHM: 'WHM',
  白魔: 'WHM',
  白魔法师: 'WHM',
  SCH: 'SCH',
  学者: 'SCH',
  AST: 'AST',
  占星: 'AST',
  占星术士: 'AST',
  SGE: 'SGE',
  贤者: 'SGE',
  MNK: 'MNK',
  武僧: 'MNK',
  DRG: 'DRG',
  龙骑: 'DRG',
  龙骑士: 'DRG',
  NIN: 'NIN',
  忍者: 'NIN',
  SAM: 'SAM',
  武士: 'SAM',
  RPR: 'RPR',
  镰刀: 'RPR',
  钐镰客: 'RPR',
  VPR: 'VPR',
  蝰蛇: 'VPR',
  蝰蛇剑士: 'VPR',
  蝰蛇战士: 'VPR',
  魁蛇战士: 'VPR',
  BRD: 'BRD',
  诗人: 'BRD',
  吟游诗人: 'BRD',
  MCH: 'MCH',
  机工: 'MCH',
  机工士: 'MCH',
  DNC: 'DNC',
  舞者: 'DNC',
  BLM: 'BLM',
  黑魔: 'BLM',
  黑魔法师: 'BLM',
  SMN: 'SMN',
  召唤: 'SMN',
  召唤师: 'SMN',
  RDM: 'RDM',
  赤魔: 'RDM',
  赤魔法师: 'RDM',
  PCT: 'PCT',
  绘灵: 'PCT',
  绘灵法师: 'PCT',
  画家: 'PCT',
};

export interface Data extends RaidbossData {
  readonly triggerSetConfig: {
    forsaken: ForsakenStrategy;
    boa: 'lb3' | 'sg3k' | 'none';
    accretion: 'line' | 'role';
    blackhole: 'kefka' | 'none';
    partySlotMT: string;
    partySlotST: string;
    partySlotH1: string;
    partySlotH2: string;
    partySlotD1: string;
    partySlotD2: string;
    partySlotD3: string;
    partySlotD4: string;
  };
  // General
  phase: Phase | 'unknown';
  // Phase 1
  actorPositions: { [id: string]: { x: number; y: number; heading: number } };
  gravenImageCount: number;
  blueTowerIds: string[];
  purpleTowerIds: string[];
  yellowTowerIds: string[];
  eyeTowerIds: string[];
  fakeEyeTowerIds: string[];
  gravenImageTether?:
    | 'pulse'
    | 'gravitas'
    | 'vitrophyre'
    | 'indulgent'
    | 'idyllic'
    | 'unknown';
  fireMarker?: string;
  isFireTrue?: boolean;
  isIceTrue?: boolean;
  isThunderTrue?: boolean;
  waveCannonTargets: string[];
  doubleTroubleTrapTargets: string[];
  myTelePortent1?: 'up' | 'down' | 'right' | 'left';
  myTelePortent2?: 'up' | 'down' | 'right' | 'left';
  // Phase 2
  pathOfLightCounter: number;
  pathOfLightStackPlayers: string[];
  pathOfLightConePlayers: string[];
  pathOfLightSpreadPlayers: string[];
  pathOfLightMarkerByPlayer: { [name: string]: PathOfLightMarker };
  pathOfLightAssignmentByPlayer: { [name: string]: PathOfLightAssignment };
  myPathOfLightAssignment?: PathOfLightAssignment;
  pathOfLightStackCombatants: PluginCombatantState[];
  pathOfLightConeCombatants: PluginCombatantState[];
  myPathOfLights: PathOfLightMarker[];
  partySlotByPlayer: { [name: string]: PartySlot };
  partySlotAssignments: Partial<Record<PartySlot, string>>;
  myPartySlot?: PartySlot;
  trineDirNums: number[];
  // Phase 3
  isFireShort?: boolean;
  windCrystalNext: boolean;
  myElement?: 'fire' | 'water';
  myWind?: 'head' | 'tail';
  fireElementPlayers: string[];
  waterElementPlayers: string[];
  fireCrystalDirNum?: number;
  waterCrystalDirNum?: number;
  windCrystalDirNum?: number;
  firstBlaster: number[];
  firstBlasterDirNum?: number;
  blasterRotation?: number;
  inLine: { [name: string]: number };
  firstAccretion?: string;
  secondAccretion?: string;
  hadAccretion: boolean;
  blackHoleIdDirNums: { [id: string]: number };
  kefkaTeleportDirNum?: number;
  nothingnessCount: number;
  blackHoleTetherDirNums: number[];
}

const headMarkerData = {
  // Phase 1 Boss
  'fakeFire': '02A1',
  'trueFire': '02A2',
  'fakeIce': '02A3',
  'trueIce': '02A4',
  'fakeThunder': '02A5',
  'trueThunder': '02A6',
  // Phase 1 Players
  'tankbuster': '00DA', // Revolting Ruin III tankbuster
  'dorito': '007F', // spread (real) or stack (fake)
  'stack': '0080', // spread (fake) or stack (real)
  // Phase 1 Tethers
  'imageTether': '002D',
  // Phase 2
  'sharedBuster': '0103', // Ultimate Embrace shared tankbuster
  'stackPath': '02CB', // Path of Light tower causes BAC0 Spelldriver (3-person stack)
  'conePath': '02CD', // Path of Light tower causes BAC2 Spellwave (cone targeting nearest player)
  'spreadPath': '02CC', // Path of Light tower causes BAC1 Spellscatter (small aoe on the player)
  // Phase 3 Tethers
  'exdeathTether': '0040', // Exdeath pulls energy from Graven Image with BB12 Thunder III
  // Phase 3 Players
  '1': '0150',
  '2': '0151',
  '3': '0152',
  '4': '0153',
  '5': '01B5',
  '6': '01B6',
  '7': '01B7',
  '8': '01B8',
} as const;

const pathOfLightMarkerById: { [id: string]: PathOfLightMarker } = {
  [headMarkerData['stackPath']]: 'stack',
  [headMarkerData['conePath']]: 'cone',
  [headMarkerData['spreadPath']]: 'spread',
};

const parseJobPriority = (raw: string): Job[] => {
  const ret: Job[] = [];
  const seen = new Set<Job>();
  for (const token of raw.split(/[|,，、/／\s]+/u)) {
    const job = jobAliases[token.trim().toUpperCase()] ?? jobAliases[token.trim()];
    if (job === undefined || seen.has(job))
      continue;
    ret.push(job);
    seen.add(job);
  }
  return ret;
};

const buildSlotJobPriority = (data: Data, slot: PartySlot): Job[] => {
  const configured = parseJobPriority(data.triggerSetConfig[slotConfigIds[slot]]);
  const seen = new Set(configured);
  const defaultJobs = defaultSlotJobPriorities[slot].filter((job) => !seen.has(job));
  return [...configured, ...defaultJobs];
};

const assignPartySlots = (data: Data): void => {
  const remaining = [...data.party.partyNames];
  const assigned = new Set<string>();
  const slotByPlayer: { [name: string]: PartySlot } = {};
  const assignments: Partial<Record<PartySlot, string>> = {};

  const takePlayer = (slot: PartySlot, name: string): void => {
    assignments[slot] = name;
    slotByPlayer[name] = slot;
    assigned.add(name);
  };

  for (const slot of partySlots) {
    const jobs = buildSlotJobPriority(data, slot);
    const role = slotRoles[slot];
    const player = jobs
      .map((job) =>
        remaining.find((name) =>
          !assigned.has(name) && data.party.jobName(name) === job && data.party.isRole(name, role)
        )
      )
      .find((name) => name !== undefined);

    if (player !== undefined)
      takePlayer(slot, player);
  }

  for (const slot of partySlots) {
    if (assignments[slot] !== undefined)
      continue;

    const role = slotRoles[slot];
    const player = remaining.find((name) => !assigned.has(name) && data.party.isRole(name, role));
    if (player !== undefined)
      takePlayer(slot, player);
  }

  data.partySlotByPlayer = slotByPlayer;
  data.partySlotAssignments = assignments;
  data.myPartySlot = slotByPlayer[data.me];
};

const getPathOfLightMarker = (
  data: Data,
  player: string | undefined,
): PathOfLightMarker => {
  if (player === undefined)
    return 'unknown';
  return data.pathOfLightMarkerByPlayer[player] ?? 'unknown';
};

const getPathOfLightAssignment = (
  data: Data,
  player: string,
): PathOfLightAssignment => {
  const slot = data.partySlotByPlayer[player];
  const partnerSlot = slot === undefined ? undefined : pathOfLightPartnerSlots[slot];
  const partner = partnerSlot === undefined ? undefined : data.partySlotAssignments[partnerSlot];
  const base = {
    partner,
    partnerSlot,
    slot,
  };

  if (slot === undefined || partnerSlot === undefined || partner === undefined)
    return { ...base, group: 'unknown' };

  const myMarker = getPathOfLightMarker(data, player);
  const partnerMarker = getPathOfLightMarker(data, partner);
  if (myMarker === 'unknown' || partnerMarker === 'unknown')
    return { ...base, group: 'unknown' };

  if (
    (myMarker === 'stack' && partnerMarker !== 'stack') ||
    (myMarker !== 'stack' && partnerMarker === 'stack')
  )
    return { ...base, group: '1238' };

  if (
    (myMarker === 'cone' && partnerMarker === 'cone') ||
    (myMarker === 'spread' && partnerMarker === 'spread')
  )
    return { ...base, group: '4567' };

  return { ...base, group: 'unknown' };
};

const updatePathOfLightAssignments = (data: Data): void => {
  if (data.partySlotByPlayer[data.me] === undefined)
    assignPartySlots(data);

  data.pathOfLightAssignmentByPlayer = {};
  for (const player of data.party.partyNames)
    data.pathOfLightAssignmentByPlayer[player] = getPathOfLightAssignment(
      data,
      player,
    );
  data.myPathOfLightAssignment = data.pathOfLightAssignmentByPlayer[data.me];
};

const isPathOfLightMeleeSlot = (slot: PartySlot | undefined): boolean => {
  return slot !== undefined && pathOfLightMeleeSlots.includes(slot);
};

const getStealFireTowerOneOutput = (
  data: Data,
  assignment: PathOfLightAssignment | undefined,
): PathOfLightTowerOneOutput => {
  if (assignment === undefined)
    return 'unknown';

  const myMarker = getPathOfLightMarker(data, data.me);
  const partnerMarker = getPathOfLightMarker(data, assignment.partner);
  if (myMarker === 'stack' && partnerMarker === 'cone')
    return 'leftTowerInsideLeft';
  if (myMarker === 'stack' && partnerMarker === 'spread')
    return 'rightTowerInsideRight';
  if (myMarker === 'spread' && partnerMarker === 'stack')
    return 'rightTowerInsideLeft';
  if (myMarker === 'cone' && partnerMarker === 'stack')
    return 'leftTowerInsideUpDown';
  if (myMarker === 'spread' && partnerMarker === 'spread')
    return 'rightTowerOutsideRightStack';
  if (myMarker === 'cone' && partnerMarker === 'cone')
    return isPathOfLightMeleeSlot(assignment.slot)
      ? 'leftTowerOutsideLeft'
      : 'leftTowerOutsideDownBait';
  return 'unknown';
};

const getStealFireTowerTwoOutput = (
  marker: PathOfLightMarker,
): PathOfLightTowerTwoOutput => {
  if (marker === 'cone')
    return 'leftTowerInsidePairBait';
  if (marker === 'spread')
    return 'rightTowerInsideSpread';
  return 'unknown';
};

const getStealFireTowerTwoBaitOutput = (
  slot: PartySlot | undefined,
): PathOfLightTowerTwoOutput => {
  switch (slot) {
    case 'MT':
    case 'ST':
      return 'leftUpBait';
    case 'H1':
    case 'H2':
      return 'leftDownBait';
    case 'D1':
    case 'D2':
      return 'rightUpBait';
    case 'D3':
    case 'D4':
      return 'rightDownBait';
    default:
      return 'unknown';
  }
};

const getPathOfLightStackPlayersForMyGroup = (data: Data): string[] => {
  const group = data.myPathOfLightAssignment?.group;
  if (group === undefined || group === 'unknown')
    return [];

  return data.pathOfLightStackPlayers.filter((player) =>
    data.pathOfLightAssignmentByPlayer[player]?.group === group);
};

const getPathOfLightConePlayersForMyGroup = (data: Data): string[] => {
  const group = data.myPathOfLightAssignment?.group;
  if (group === undefined || group === 'unknown')
    return [];

  return data.pathOfLightConePlayers.filter((player) =>
    data.pathOfLightAssignmentByPlayer[player]?.group === group);
};

const getPathOfLightConePlayersForRelative = (data: Data): string[] => {
  const groupConePlayers = getPathOfLightConePlayersForMyGroup(data);
  if (groupConePlayers.length === 2)
    return groupConePlayers;
  if (data.pathOfLightConePlayers.length === 2)
    return data.pathOfLightConePlayers;
  return groupConePlayers;
};

const collectPathOfLightStackCombatants = async (data: Data): Promise<void> => {
  data.pathOfLightStackCombatants = [];
  const stackPlayers = getPathOfLightStackPlayersForMyGroup(data);
  if (!stackPlayers.includes(data.me))
    return;

  const otherStack = stackPlayers.find((player) => player !== data.me);
  if (otherStack === undefined)
    return;

  data.pathOfLightStackCombatants = (await callOverlayHandler({
    call: 'getCombatants',
    names: [data.me, otherStack],
  })).combatants;
};

const collectPathOfLightConeCombatants = async (data: Data): Promise<void> => {
  data.pathOfLightConeCombatants = [];
  const conePlayers = getPathOfLightConePlayersForRelative(data);
  if (conePlayers.length !== 2 || !conePlayers.includes(data.me))
    return;

  data.pathOfLightConeCombatants = (await callOverlayHandler({
    call: 'getCombatants',
    names: conePlayers,
  })).combatants;
};

const getStealFireTowerOneConeRelativeOutput = (
  data: Data,
): PathOfLightTowerOneOutput => {
  const conePlayers = getPathOfLightConePlayersForRelative(data);
  if (conePlayers.length !== 2 || !conePlayers.includes(data.me))
    return 'unknown';

  const otherCone = conePlayers.find((player) => player !== data.me);
  if (otherCone === undefined)
    return 'unknown';

  const myCombatant = data.pathOfLightConeCombatants.find(
    (combatant) => combatant.Name === data.me,
  );
  const otherCombatant = data.pathOfLightConeCombatants.find(
    (combatant) => combatant.Name === otherCone,
  );
  if (myCombatant === undefined || otherCombatant === undefined)
    return 'unknown';

  const myX = myCombatant.PosX - centerX;
  const myY = myCombatant.PosY - centerY;
  const otherX = otherCombatant.PosX - centerX;
  const otherY = otherCombatant.PosY - centerY;
  const cross = myX * otherY - myY * otherX;

  if (Math.abs(cross) < 0.001)
    return 'unknown';
  return cross > 0 ? 'leftTowerOutsideLeft' : 'leftTowerOutsideDownBait';
};

const getStealFireTowerOneOutputWithConeRelative = (
  data: Data,
  assignment: PathOfLightAssignment | undefined,
): PathOfLightTowerOneOutput => {
  const marker = getPathOfLightMarker(data, data.me);
  if (marker === 'cone')
    return getStealFireTowerOneConeRelativeOutput(data);
  if (marker === 'spread')
    return 'rightTowerOutsideRightStack';

  return getStealFireTowerOneOutput(data, assignment);
};

const getStealFireOddTowerStackOutput = (
  data: Data,
): PathOfLightTowerOneOutput => {
  const stackPlayers = getPathOfLightStackPlayersForMyGroup(data);
  const otherStack = stackPlayers.find((player) => player !== data.me);
  if (otherStack === undefined)
    return 'unknown';

  const myCombatant = data.pathOfLightStackCombatants.find(
    (combatant) => combatant.Name === data.me,
  );
  const otherCombatant = data.pathOfLightStackCombatants.find(
    (combatant) => combatant.Name === otherStack,
  );
  if (myCombatant === undefined || otherCombatant === undefined)
    return 'unknown';

  const myX = myCombatant.PosX - centerX;
  const myY = myCombatant.PosY - centerY;
  const otherX = otherCombatant.PosX - centerX;
  const otherY = otherCombatant.PosY - centerY;
  const cross = myX * otherY - myY * otherX;

  if (Math.abs(cross) < 0.001)
    return 'unknown';
  return cross > 0 ? 'leftTowerInsideLeft' : 'rightTowerInsideRight';
};

const getStealFireOddTowerOutput = (
  data: Data,
): PathOfLightTowerOneOutput => {
  const marker = getPathOfLightMarker(data, data.me);
  if (marker === 'stack')
    return getStealFireOddTowerStackOutput(data);
  if (marker === 'cone')
    return 'leftTowerInsideUpDown';
  if (marker === 'spread')
    return 'rightTowerInsideLeft';
  return 'unknown';
};

const mysteryMagicOutputStrings: OutputStrings = {
  puddle: {
    en: 'Bait Puddle',
    de: 'Fläche ködern',
    fr: 'Déposez',
    ja: 'AOE誘導',
    cn: '诱导AOE',
    ko: '장판 유도',
    tc: '誘導AOE',
  },
  spread: Outputs.spread,
  middle: Outputs.goIntoMiddle,
  stack: {
    en: 'Stack',
    de: 'Stacken',
    fr: 'Packez-vous',
    ja: 'スタック',
    cn: '集合',
    ko: '집합',
    tc: '集合',
  },
  trueThunder: {
    en: 'Avoid Tell',
    cn: '安全区内',
  },
  fakeThunder: {
    en: 'In Line',
    cn: '危险区内',
  },
  trueIce: {
    en: 'Avoid Tell',
    cn: '安全区',
  },
  fakeIce: {
    en: 'In Cone',
    cn: '危险区',
  },
  trueIcePuddle: {
    en: '${mech1} + ${mech2} => ${mech3}',
    cn: '${mech1} + ${mech2} => ${mech3}',
  },
  fakeIcePuddle: {
    en: '${mech1} + ${mech2} => ${mech3}',
    cn: '${mech1} + ${mech2} => ${mech3}',
  },
  stackTrueIce: {
    en: '${mech} + ${ice}',
    cn: '${ice} + ${mech}',
  },
  stackFakeIce: {
    en: '${mech} + ${ice}',
    cn: '${ice} + ${mech}',
  },
  spreadTrueIce: {
    en: '${mech} + ${ice}',
    cn: '${ice} + ${mech}',
  },
  spreadFakeIce: {
    en: '${mech} + ${ice}',
    cn: '${ice} + ${mech}',
  },
  trueIceTrueThunder: {
    en: 'Avoid Tells',
    cn: '进安全区',
  },
  fakeIceTrueThunder: {
    en: 'Cone (only)',
    cn: '进扇形',
  },
  trueIceFakeThunder: {
    en: 'Line (only)',
    cn: '进直线',
  },
  fakeIceFakeThunder: {
    en: 'Cone + Line',
    cn: '进交叉区',
  },
  stackTrueThunder: {
    en: '${mech} + ${thunder}',
    cn: '${thunder}${mech}',
  },
  stackFakeThunder: {
    en: '${mech} + ${thunder}',
    cn: '${thunder}${mech}',
  },
  spreadTrueThunder: {
    en: '${mech} + ${thunder}',
    cn: '${thunder}${mech}',
  },
  spreadFakeThunder: {
    en: '${mech} + ${thunder}',
    cn: '${thunder}${mech}',
  },
};

const trapOutputStrings: OutputStrings = {
  knockbackFrom: {
    en: 'Knockback from ${players}',
    cn: '从 ${players} 处击退',
  },
  knockbackFromLater: {
    en: 'Knockback from ${players} (later)',
    cn: '稍后从 ${players} 处击退',
  },
};

const getDoubleTroubleTrapTargetsForRole = (data: Data): string[] => {
  const isDpsGroup = data.role === 'dps';
  return data.doubleTroubleTrapTargets.filter((player) => data.party.isDPS(player) === isDpsGroup);
};

const getDoubleTroubleTrapTargetNames = (data: Data) => {
  return getDoubleTroubleTrapTargetsForRole(data).map((player) => {
    if (player === data.me)
      return 'YOU';
    return data.party.member(player);
  });
};

const forsakenOutputStrings: OutputStrings = {
  tower: Outputs.getTowers,
  leftTower: {
    en: 'Left Tower',
    cn: '左塔',
  },
  rightTower: {
    en: 'Right Tower',
    cn: '右塔',
  },
  leftTowerInsideLeft: {
    en: 'Left Tower, Inside Left',
    cn: '左塔内左侧分摊',
  },
  rightTowerInsideRight: {
    en: 'Right Tower, Inside Right',
    cn: '右塔内右侧分摊',
  },
  rightTowerInsideLeft: {
    en: 'Right Tower, Inside Left',
    cn: '右塔内左侧钢铁',
  },
  leftTowerInsideUpDown: {
    en: 'Left Tower, Inside Up/Down',
    cn: '左塔内下侧扇形',
  },
  rightTowerOutsideRightStack: {
    en: 'Right Tower, Outside Right Stack',
    cn: '右塔外右侧分摊',
  },
  leftTowerOutsideLeft: {
    en: 'Left Tower, Outside Left',
    cn: '左塔外左侧分摊',
  },
  leftTowerOutsideDownBait: {
    en: 'Left Tower, Outside Down Bait',
    cn: '左塔外下引导',
  },
  leftTowerInsidePairBait: {
    en: 'Left Tower, Inside Pair Bait',
    cn: '左塔内对射',
  },
  rightTowerInsideSpread: {
    en: 'Right Tower, Inside Spread',
    cn: '右塔内互相分散',
  },
  leftUpBait: {
    en: 'Upper Left Bait',
    cn: '场中引导',
  },
  leftDownBait: {
    en: 'Lower Left Bait',
    cn: '场中引导',
  },
  rightUpBait: {
    en: 'Upper Right Bait',
    cn: '场中引导',
  },
  rightDownBait: {
    en: 'Lower Right Bait',
    cn: '场中引导',
  },
  stackOnYou: Outputs.stackOnYou,
  cone: {
    en: 'Cone on YOU',
    cn: '扇形点你',
  },
  spread: {
    en: 'AOE on YOU',
    cn: '小圈点你',
  },
  stackOnYouTower: {
    en: '${tower} + ${marker}',
    cn: '${tower} + ${marker}',
  },
  stackOnPlayer: {
    en: 'Stack is on ${player}',
    cn: '分摊在 ${player}',
  },
  stacksOnPlayers: {
    en: 'Stacks on ${players}',
    cn: '分摊：${players}',
  },
  markerOnYouStacksOnPlayers: {
    en: '${marker} + ${stacks}',
    cn: '${marker} + ${stacks}',
  },
  markerOnYouTower: {
    en: '${marker} + ${tower}',
    cn: '${marker} + ${tower}',
  },
  leftStack: {
    en: 'Left Stack/Cone',
    cn: '左侧分摊/扇形',
  },
  rightStack: {
    en: 'Right Stack',
    cn: '右侧分摊',
  },
  groupBTowers: {
    en: 'Group B Towers',
    cn: 'B组踩塔',
  },
  unknown: Outputs.unknown,
};

const boaOutputStrings: OutputStrings = {
  ...Directions.outputStringsIntercardDir,
  in: Outputs.in,
  out: Outputs.out,
  moveExdeathAndChaosThenMech: {
    en: 'Move ${exdeath} Middle / ${chaos} to ${dir} => ${mech}',
    cn: '${exdeath}中间 / ${chaos}去${dir} => ${mech}',
  },
  moveExdeathThenMech: {
    en: 'Move ${exdeath} to ${long} => ${mech}',
    cn: '${exdeath}去${long} => ${mech}',
  },
  crystals: {
    en: '${short} => ${long} => ${wind} (later)',
    cn: '${short} => ${long} => ${wind}（稍后）',
  },
  shortLongCrystals: {
    en: '${short} => ${long}',
    cn: '${short} => ${long}',
  },
  crystalsMech: {
    en: '${crystals}; ${mech}',
    cn: '${crystals}; ${mech}',
  },
  fire: {
    en: 'Fire ${dir}',
    cn: '火 ${dir}',
  },
  water: {
    en: 'Water ${dir}',
    cn: '水 ${dir}',
  },
  wind: {
    en: 'Wind ${dir}',
    cn: '风 ${dir}',
  },
  tail: {
    en: 'Face ${name}',
    cn: '面对 ${name}',
  },
  head: Outputs.lookAwayFromTarget,
  you: {
    en: 'YOU',
    cn: '你',
  },
  baitFireDonut: {
    en: 'Bait Fire Donut',
    cn: '引导火月环',
  },
  baitWaterAoe: {
    en: 'Bait Water AOE',
    cn: '引导水钢铁',
  },
  baitCrystal: {
    en: 'Bait ${crystal} ${inout}',
    cn: '引导${crystal} ${inout}',
  },
  fireOnPlayersCrystalDirNum: {
    en: '${spread}/${dir} => ${bait}',
    cn: '${spread}/${dir} => ${bait}',
  },
  fireOnPlayers: {
    en: 'Spread on ${players}',
    cn: '火分散：${players}',
  },
  waterOnPlayersCrystalDirNum: {
    en: '${donut}/${dir} => ${bait}',
    cn: '${donut}/${dir} => ${bait}',
  },
  waterOnPlayers: {
    en: 'Donut on ${players}',
    cn: '水月环：${players}',
  },
  mechThenMech: {
    en: '${mech1} => ${mech2}',
    cn: '${mech1} => ${mech2}',
  },
  getMiddleNearPlayer: {
    en: 'Get Middle Near ${player}',
    cn: '去中间靠近 ${player}',
  },
  getHitByDonut: Outputs.goIntoMiddle,
  knockbackToDir: {
    en: 'Knockback to ${dir} ${facing}',
    cn: '击退到${dir} ${facing}',
  },
  beNearWind: {
    en: 'Be Near ${dir}',
    cn: '靠近${dir}',
  },
  stackPartner: Outputs.stackPartner,
  donutLater: {
    en: 'Donut (later)',
    cn: '稍后月环',
  },
  roleStacks: {
    en: 'Role Stacks',
    cn: '职能分摊',
  },
  beNearExdeath: {
    en: 'Be Near ${name}',
    cn: '靠近 ${name}',
  },
  baitJump: {
    en: 'Bait Jump',
    cn: '引导跳',
  },
};

const getCWOrderFromN = (
  n: number,
  dirNums: number[],
): number[] => {
  const getCWDistance = (start: number, end: number): number => {
    const diff = end - start;
    return diff < 0 ? diff + 4 : diff;
  };

  return [...dirNums].sort((a, b) => {
    return getCWDistance(n, a) - getCWDistance(n, b);
  });
};

const blackHoleOutputStrings: OutputStrings = {
  ...Directions.outputStringsCardinalDir,
  num: {
    en: '${num}: ',
    cn: '${num}: ',
  },
  takeDirTetherClockwise: {
    en: '${num} Take ${dir} Tether Clockwise',
    cn: '${num} 拿${dir}线顺时针',
  },
  keepTether: {
    en: 'Keep Tether',
    cn: '保持连线',
  },
  passTether: {
    en: 'Pass Tether',
    cn: '传线',
  },
  oneBlackHole: {
    en: '${num}${dir}',
    cn: '${num}${dir}',
  },
  twoBlackHoles: {
    en: '${num}${dir1}/${dir2}',
    cn: '${num}${dir1}/${dir2}',
  },
  threeBlackHoles: {
    en: '${num}${dir1}/${dir2}/${dir3}',
    cn: '${num}${dir1}/${dir2}/${dir3}',
  },
};

const sortTrineDirNumsByAPointCounterclockwise = (dirNums: number[]): number[] => {
  // A marker is north/12 o'clock. Direction numbers increase clockwise.
  return [...dirNums].sort((a, b) => ((16 - a) % 16) - ((16 - b) % 16));
};

const trineDirNumToOutputKey = (dirNum: number | undefined): string => {
  if (dirNum === undefined)
    return 'unknown';
  return Directions.output16Dir[dirNum] ?? 'unknown';
};

const triggerSet: TriggerSet<Data> = {
  id: 'DancingMadUltimate',
  zoneId: ZoneId.DancingMadUltimate,
  config: [
    {
      id: 'forsaken',
      comment: {
        en:
          `Kroxy-Rinon 3/4/1: <a href="https://pastebin.com/7fs57PyQ" target="_blank">Kefka Bin</a>`,
      },
      name: {
        en: 'P2 Forsaken Strategy',
        cn: 'P2 遗弃末世打法',
      },
      type: 'select',
      options: {
        en: {
          'Steal Fire 2222: fixed pairs MT/H1, ST/H2, D1/D3, D2/D4.': 'steal-fire',
          'Group soak order: AAABBBBA. Cones + Support Stack Left and Spread + DPS Stack Right, relative towers to facing in.':
            'kroxy-rinon',
          'Generic calls.': 'none',
        },
        cn: {
          '盗火 2222：MTH1 / STH2 / D1D3 / D2D4 固定搭档': 'steal-fire',
          'Kroxy-Rinon 3/4/1：AAABBBBA 踩塔顺序': 'kroxy-rinon',
          '通用播报': 'none',
        },
      },
      default: 'steal-fire',
    },
    {
      id: 'partySlotMT',
      name: {
        en: 'DMU MT job priority',
        cn: 'DMU MT 职业优先级',
      },
      type: 'string',
      default: defaultSlotJobPriorityText.MT,
    },
    {
      id: 'partySlotST',
      name: {
        en: 'DMU ST job priority',
        cn: 'DMU ST 职业优先级',
      },
      type: 'string',
      default: defaultSlotJobPriorityText.ST,
    },
    {
      id: 'partySlotH1',
      name: {
        en: 'DMU H1 job priority',
        cn: 'DMU H1 职业优先级',
      },
      type: 'string',
      default: defaultSlotJobPriorityText.H1,
    },
    {
      id: 'partySlotH2',
      name: {
        en: 'DMU H2 job priority',
        cn: 'DMU H2 职业优先级',
      },
      type: 'string',
      default: defaultSlotJobPriorityText.H2,
    },
    {
      id: 'partySlotD1',
      name: {
        en: 'DMU D1 job priority',
        cn: 'DMU D1 职业优先级',
      },
      type: 'string',
      default: defaultSlotJobPriorityText.D1,
    },
    {
      id: 'partySlotD2',
      name: {
        en: 'DMU D2 job priority',
        cn: 'DMU D2 职业优先级',
      },
      type: 'string',
      default: defaultSlotJobPriorityText.D2,
    },
    {
      id: 'partySlotD3',
      name: {
        en: 'DMU D3 job priority',
        cn: 'DMU D3 职业优先级',
      },
      type: 'string',
      default: defaultSlotJobPriorityText.D3,
    },
    {
      id: 'partySlotD4',
      name: {
        en: 'DMU D4 job priority',
        cn: 'DMU D4 职业优先级',
      },
      type: 'string',
      default: defaultSlotJobPriorityText.D4,
    },
    {
      id: 'boa',
      comment: {
        en:
          `Tank LB3: Ranged players bait Short => Long Crystal, party resolves debuffs at Wind Crystal. Role stack the wind baits after Vacuum Wave<br />
        Entropy/Dynamic Fluid Bait (Default): Follows SG3K Raidplan: Entropy/Fluid bait their crystals and get hit by crystal's aoe<br />
        None: Only calls debuffs and locations`,
      },
      name: {
        en: 'P3 Bowels of Agony Strategy',
        cn: 'P3 苦痛脏腑打法',
      },
      type: 'select',
      options: {
        en: {
          'Tank LB3': 'lb3',
          'Entropy/Dynamic Fluid Bait': 'sg3k',
          'Generic Calls': 'none',
        },
        cn: {
          '坦克LB3': 'lb3',
          '火水点名引导': 'sg3k',
          '通用播报': 'none',
        },
      },
      default: 'sg3k',
    },
    {
      id: 'accretion',
      comment: {
        en: 'Order in which players will be told to heal for resolving Accretion debuffs',
        cn: '混沌的泥土需要奶满时的播报顺序',
      },
      name: {
        en: 'P3 Accretion Heal Order',
        cn: 'P3 混沌的泥土奶满顺序',
      },
      type: 'select',
      options: {
        en: {
          'First In Line => Second In Line': 'line',
          'Healer => DPS': 'role',
        },
        cn: {
          '一档 => 二档': 'line',
          '治疗 => DPS': 'role',
        },
      },
      default: 'role',
    },
    {
      id: 'blackhole',
      comment: {
        en: 'Kefkabin: #1 DPS, #1 Support, #1 Accretion, #2 DPS, #2 Support, #2 Accretion, #3 DPS, #3 Support',
        cn: 'Kefkabin：1DPS、1TH、1泥土、2DPS、2TH、2泥土、3DPS、3TH',
      },
      name: {
        en: 'P3 Black Hole Order',
        cn: 'P3 黑洞顺序',
      },
      type: 'select',
      options: {
        en: {
          'Kefkabin': 'kefka',
          'Generic Calls': 'none',
        },
        cn: {
          'Kefkabin': 'kefka',
          '通用播报': 'none',
        },
      },
      default: 'none',
    },
  ],
  timelineFile: 'dancing_mad.txt',
  initData: () => {
    return {
      phase: 'p1',
      // Phase 1
      actorPositions: {},
      gravenImageCount: 0,
      blueTowerIds: [],
      purpleTowerIds: [],
      yellowTowerIds: [],
      eyeTowerIds: [],
      fakeEyeTowerIds: [],
      waveCannonTargets: [],
      doubleTroubleTrapTargets: [],
      // Phase 2
      pathOfLightCounter: 1,
      myPathOfLights: [],
      pathOfLightStackPlayers: [],
      pathOfLightConePlayers: [],
      pathOfLightSpreadPlayers: [],
      pathOfLightMarkerByPlayer: {},
      pathOfLightAssignmentByPlayer: {},
      pathOfLightStackCombatants: [],
      pathOfLightConeCombatants: [],
      partySlotByPlayer: {},
      partySlotAssignments: {},
      trineDirNums: [],
      // Phase 3
      windCrystalNext: false,
      fireElementPlayers: [],
      waterElementPlayers: [],
      firstBlaster: [],
      inLine: {},
      hadAccretion: false,
      blackHoleIdDirNums: {},
      nothingnessCount: 0,
      blackHoleTetherDirNums: [],
    };
  },
  triggers: [
    {
      id: 'DMU Phase Tracker',
      type: 'StartsUsing',
      netRegex: { id: Object.keys(phases) },
      run: (data, matches) => data.phase = phases[matches.id] ?? 'unknown',
    },
    {
      id: 'DMU Party Slot Assignment',
      type: 'InCombat',
      netRegex: { inGameCombat: '1', isGameChanged: '1', capture: false },
      run: (data) => assignPartySlots(data),
    },
    {
      id: 'DMU ActorSetPos Tracker',
      // Only in use for P1 Graven Image tethers
      type: 'ActorSetPos',
      netRegex: { id: '4[0-9A-Fa-f]{7}', capture: true },
      run: (data, matches) =>
        data.actorPositions[matches.id] = {
          x: parseFloat(matches.x),
          y: parseFloat(matches.y),
          heading: parseFloat(matches.heading),
        },
    },
    {
      id: 'DMU P1 Revolting Ruin III',
      // Tankbuster targets highest enmity then second highest enmity
      // A tank swap can happen to have MT take both hits
      type: 'HeadMarker',
      netRegex: { id: headMarkerData['tankbuster'], capture: true },
      alertText: (data, matches, output) => {
        const target = matches.target;
        if (target === data.me)
          return output.cleaveOnYou!();

        if (data.role === 'tank')
          return output.cleaveSwap!({
            player: data.party.member(target),
          });

        if (data.role === 'healer')
          return output.cleaveOnPlayer!({
            player: data.party.member(target),
          });

        return output.avoidCleaves!();
      },
      outputStrings: {
        in: Outputs.in,
        out: Outputs.out,
        cleaveOnYou: Outputs.tankCleaveOnYou,
        avoidCleaves: Outputs.avoidTankCleaves,
        cleaveOnPlayer: {
          en: 'Tank Cleave on ${player}',
          cn: '坦克顺劈点 ${player}',
        },
        cleaveSwap: { // Defaulting to same output as cleaveOnPlayer
          en: 'Tank Cleave on ${player}',
          cn: '坦克顺劈点 ${player}',
        },
      },
    },
    {
      id: 'DMU P1 Graven Image Counter',
      // Used for timing of tether triggers
      type: 'StartsUsing',
      netRegex: { id: 'BCF2', source: 'Kefka', capture: false },
      run: (data) => data.gravenImageCount = data.gravenImageCount + 1,
    },
    {
      id: 'DMU P1 Graven Image Tether Collect',
      // 271 ActorSetPos lines indicate where the tether is coming from
      // 261 CombatantMemory lines may also indicate this
      // Graven Image 1:
      // (100, 56, 18.5) Center Tether, Will be target of BAA9 Pulse Wave (knockback)
      // Graven Image 2:
      // (102.5, 27, 22.5) Center Tether, Will be target of BAAC Gravitas (puddles)
      // (126, 41.5, 7) Right Tether, Will be target of BAB0 Vitrophyre (rocks)
      // Graven Image 3:
      // (95, 25, 27) Left Tether, Will be target of BAB5 Indulgent Will which causes 503 Confused
      // (107, 43, 8.5) Right tether, Will be target of BAB6 Idyllic Will which causes 131E Sleep
      type: 'Tether',
      netRegex: { id: headMarkerData['imageTether'], capture: true },
      condition: Conditions.targetIsYou(),
      delaySeconds: 0.1, // Actor position data can come after tether in log
      run: (data, matches) => {
        const actor = data.actorPositions[matches.sourceId];
        if (actor === undefined) {
          data.gravenImageTether = 'unknown';
          return;
        }

        const x = actor.x;
        // Graven Image 1: Pulse Wave target
        if (x < 101 && x > 99)
          data.gravenImageTether = 'pulse';
        else if (x < 103 && x > 101) // Graven Image 2: Gravitas target
          data.gravenImageTether = 'gravitas';
        else if (x > 125) // Graven Image 2: Vitrophyre target
          data.gravenImageTether = 'vitrophyre';
        else if (x < 100) // Graven Image 3: Indulgent Will target
          data.gravenImageTether = 'indulgent';
        else if (x < 108 && x > 106) // Graven Image 3: Idyllic Will target
          data.gravenImageTether = 'idyllic';
        else
          data.gravenImageTether = 'unknown';
      },
    },
    {
      id: 'DMU P1 Pulse Wave Tethers',
      type: 'Tether',
      netRegex: { id: headMarkerData['imageTether'], capture: true },
      condition: (data, matches) => {
        return data.me === matches.target && data.gravenImageCount === 1;
      },
      delaySeconds: 0.1, // Actor position data can come after tether in log
      durationSeconds: 7,
      infoText: (data, matches, output) => {
        const actor = data.actorPositions[matches.sourceId];
        if (actor === undefined)
          return output.tetherOnYou!();

        const x = actor.x;
        // Graven Image 1: Pulse Wave target
        if (x < 101 && x > 99)
          return output.pulse!();
        return output.tetherOnYou!();
      },
      outputStrings: {
        tetherOnYou: {
          en: 'Tether on YOU',
          de: 'Verbindung auf DIR',
          fr: 'Lien sur VOUS',
          ja: '線ついた',
          cn: '连线点名',
          ko: '선 대상자 지정됨',
          tc: '連線點名',
        },
        pulse: Outputs.knockback, // Cannot be immuned, happens within 6s of tether
      },
    },
    {
      id: 'DMU P1 Mystery Magic Collect',
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['trueFire'],
          headMarkerData['trueIce'],
          headMarkerData['trueThunder'],
          headMarkerData['fakeFire'],
          headMarkerData['fakeIce'],
          headMarkerData['fakeThunder'],
        ],
        capture: true,
      },
      run: (data, matches) => {
        switch (matches.id) {
          case headMarkerData['trueFire']:
            data.isFireTrue = true;
            return;
          case headMarkerData['fakeFire']:
            data.isFireTrue = false;
            return;
          case headMarkerData['trueIce']:
            data.isIceTrue = true;
            return;
          case headMarkerData['fakeIce']:
            data.isIceTrue = false;
            return;
          case headMarkerData['trueThunder']:
            data.isThunderTrue = true;
            return;
          case headMarkerData['fakeThunder']:
            data.isThunderTrue = false;
            return;
        }
      },
    },
    {
      id: 'DMU P1 Fire Head Marker Collect',
      type: 'HeadMarker',
      netRegex: { id: [headMarkerData['dorito'], headMarkerData['stack']], capture: true },
      suppressSeconds: 2,
      run: (data, matches) => data.fireMarker = matches.id,
    },
    {
      id: 'DMU P1 Mystery Magic Ice and Fire',
      // Set 1: Only Ice and Fire should be set
      type: 'StartsUsing',
      netRegex: { id: 'BA94', source: 'Kefka', capture: false },
      condition: (data) => {
        return data.isIceTrue !== undefined && data.isFireTrue !== undefined;
      },
      infoText: (data, _matches, output) => {
        const fireMarker = data.fireMarker;
        if (
          (fireMarker === headMarkerData['dorito'] && data.isFireTrue) ||
          (fireMarker === headMarkerData['stack'] && !data.isFireTrue)
        )
          return data.isIceTrue
            ? output.spreadTrueIce!({ mech: output.spread!(), ice: output.trueIce!() })
            : output.spreadFakeIce!({ mech: output.spread!(), ice: output.fakeIce!() });

        if (
          (fireMarker === headMarkerData['dorito'] && !data.isFireTrue) ||
          (fireMarker === headMarkerData['stack'] && data.isFireTrue)
        ) {
          return data.isIceTrue
            ? output.stackTrueIce!({ mech: output.stack!(), ice: output.trueIce!() })
            : output.stackFakeIce!({ mech: output.stack!(), ice: output.fakeIce!() });
        }
      },
      outputStrings: mysteryMagicOutputStrings,
    },
    {
      id: 'DMU P1 Graven Image Tether Cleanup',
      // Clear on Ability:
      // BAA9 Pulse Wave
      // BAAC Gravitas
      // BAB0 vitrophyre
      // BAB5 Indulgent Will
      // BAB6 Idyllic Will
      type: 'Ability',
      netRegex: {
        id: ['BAA9', 'BAAC', 'BAB0', 'BAB5', 'BAB6'],
        source: 'Graven Image',
        capture: true,
      },
      suppressSeconds: 1,
      run: (data, matches) => {
        // Player could die and this ability then not target them
        // Need intelligent way to remove once related ability has executed
        // Clear data if ability matches our tether
        const abilityMap = {
          'pulse': 'BAAC',
          'gravitas': 'BAA9',
          'vitrophyre': 'BAB0',
          'indulgent': 'BAB5',
          'idyllic': 'BAB6',
          'unknown': 'unknown',
        };
        const tether = data.gravenImageTether ?? 'unknown';
        const tetherAbilityId = abilityMap[tether];
        if (tetherAbilityId === matches.id || tether === 'unknown')
          delete data.gravenImageTether;
      },
    },
    {
      id: 'DMU P1 Graven Image Collect',
      // Tower entity actions
      // The CombatantMemory Add lines are added prior to combat
      // OverlayPlugin can retrieve the matching BNpcID
      // However, these entities seem to always spawn in the same order and the
      // first tower is the highest ID and the towers are in sequential order
      // These are the BNpcID values:
      // 1EBFBB (2015163) => Wave Cannon entity (blue)
      // 1EBFBC (2015164) => Gravitational Wave entity (purple)
      // 1EBFBD (2015165) => Intemperate Will entity (yellow)
      // 1EBFBE (2015166) => Indolent Will entity (eye)
      // 1EBFBF (2015167) => Ave Maria entity (fake eye)
      // There are two of each, they are added at start of fight
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: true },
      preRun: (data, matches) => {
        const id = parseInt(matches.id, 16);
        const blueTowers = [id, id - 1]; // First tower is blue and highest ID
        const purpleTowers = [id - 2, id - 4]; // Next are in pair with yellow
        const yellowTowers = [id - 3, id - 5];
        const eyeTowers = [id - 7, id - 9]; // Next are in paire with fake
        const fakeEyeTowers = [id - 6, id - 8];

        const toStringId = (id: number): string => {
          return id.toString(16).toUpperCase();
        };
        data.blueTowerIds = blueTowers.map((id) => toStringId(id));
        data.purpleTowerIds = purpleTowers.map((id) => toStringId(id));
        data.yellowTowerIds = yellowTowers.map((id) => toStringId(id));
        data.eyeTowerIds = eyeTowers.map((id) => toStringId(id));
        data.fakeEyeTowerIds = fakeEyeTowers.map((id) => toStringId(id));
      },
      suppressSeconds: 99999,
    },
    {
      id: 'DMU P1 Wave Cannon Collect',
      // Collect players hit by Wave Cannon to tell who soaks tower followup and who avoids tower
      type: 'Ability',
      netRegex: { id: 'BAA8', source: 'Graven Image', capture: true },
      run: (data, matches) => data.waveCannonTargets.push(matches.target),
    },
    {
      id: 'DMU P1 Double-trouble Trap Collect',
      // Times are 5s, 68s, and 49s
      type: 'GainsEffect',
      netRegex: { effectId: '13D6', capture: true },
      run: (data, matches) => data.doubleTroubleTrapTargets.push(matches.target),
    },
    {
      id: 'DMU P1 Wave Cannon Explosion Towers',
      // Wave Cannon gives a vulnerability which causes death to BAAA Explosion soaks
      // Sacraficing a player who clipped to prevent party 90% damage down from
      // BAAB Unmitigated Explosion seems ideal, although different clients may
      // get different order
      // Suprisingly the Unmitigated Explosion doesn't deal damage
      type: 'Ability',
      netRegex: { id: 'BAA8', source: 'Graven Image', capture: false },
      delaySeconds: 0.1,
      suppressSeconds: 1,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = {
          soak: {
            en: 'Soak tower',
            de: 'Türme nehmen',
            fr: 'Prenez une tour',
            ja: '塔踏み',
            cn: '踩塔击飞',
            ko: '기둥 들어가기',
            tc: '踩塔擊飛',
          },
          avoid: {
            en: 'Avoid towers',
            de: 'Türme vermeiden',
            fr: 'Évitez les tours',
            ja: '塔回避',
            cn: '远离塔',
            ko: '기둥 피하기',
            tc: '遠離塔',
          },
          extra: {
            en: 'Extra Tower',
            cn: '补塔',
          },
        };
        const avoidedCannon = data.waveCannonTargets.indexOf(data.me) !== -1;

        // Option for player to soak the tower for p1 prog?
        if (avoidedCannon && data.waveCannonTargets.length > 4)
          return { infoText: output.extra!() };

        // Avoid the tower
        if (avoidedCannon)
          return { alertText: output.avoid!() };

        // Player didn't get hit, they will need to soak a tower
        return { alertTest: output.soak!() };
      },
    },
    {
      id: 'DMU P1 Double-trouble Trap 1',
      type: 'GainsEffect',
      netRegex: { effectId: '13D6', capture: true },
      condition: (_data, matches) => parseFloat(matches.duration) < 6,
      delaySeconds: 0.1,
      suppressSeconds: 1,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = trapOutputStrings;

        const players = getDoubleTroubleTrapTargetNames(data);
        if (players.length === 0)
          return;

        const severity = getDoubleTroubleTrapTargetsForRole(data).includes(data.me)
          ? 'alertText'
          : 'infoText';
        const msg = players?.join(', ');
        return { [severity]: output.knockbackFrom!({ players: msg }) };
      },
    },
    {
      id: 'DMU P1 Double-trouble Trap Cleanup',
      // Players dying will also trigger this
      type: 'LosesEffect',
      netRegex: { effectId: '13D6', capture: true },
      run: (data, matches) => {
        data.doubleTroubleTrapTargets = data.doubleTroubleTrapTargets.filter(
          (target) => target !== matches.target,
        );
      },
    },
    {
      id: 'DMU P1 Double-trouble Trap 2 Early',
      type: 'GainsEffect',
      netRegex: { effectId: '13D6', capture: true },
      delaySeconds: 0.1,
      suppressSeconds: 1,
      infoText: (data, matches, output) => {
        // Ignore first set and third set
        if (parseFloat(matches.duration) < 67)
          return;

        // Check if players died
        if (data.doubleTroubleTrapTargets[0] === undefined)
          return;

        const players = getDoubleTroubleTrapTargetNames(data);
        if (players.length === 0)
          return;

        const msg = players?.join(', ');
        return output.knockbackFromLater!({ players: msg });
      },
      outputStrings: trapOutputStrings,
    },
    {
      id: 'DMU P1 Mystery Magic Ice and Thunder',
      // Set 2: Only Ice and Thunder should be set
      type: 'StartsUsing',
      netRegex: { id: 'BA94', source: 'Kefka', capture: false },
      condition: (data) => {
        return data.isIceTrue !== undefined && data.isThunderTrue !== undefined;
      },
      infoText: (data, _matches, output) => {
        if (data.isThunderTrue) {
          return data.isIceTrue
            ? output.trueIceTrueThunder!()
            : output.fakeIceTrueThunder!();
        }
        return data.isIceTrue
          ? output.trueIceFakeThunder!()
          : output.fakeIceFakeThunder!();
      },
      outputStrings: mysteryMagicOutputStrings,
    },
    {
      id: 'DMU P1 Light of Judgment',
      type: 'StartsUsing',
      netRegex: { id: 'C622', source: 'Kefka', capture: false },
      response: Responses.bigAoe(),
    },
    {
      id: 'DMU P1 Hyperdrive',
      // This hits three times
      // Occurs 3.1s after C622 Light of Judgment, which is a 5s cast
      type: 'StartsUsing',
      netRegex: { id: 'C622', source: 'Kefka', capture: true },
      delaySeconds: (_data, matches) => parseFloat(matches.castTime) - 2, // Result in ~5.1s warning
      response: Responses.tankBuster(),
    },
    {
      id: 'DMU P1 Mystery Magic Ice, and Gravitas and Vitrophyre Tethers 1',
      // Occurs between Set 2 and Set 3
      // BA95 Blizzard Blowout III cast
      type: 'StartsUsing',
      netRegex: { id: 'BA95', source: 'Kefka', capture: false },
      condition: (data) => {
        if (
          data.isIceTrue !== undefined &&
          data.isThunderTrue === undefined &&
          data.isFireTrue === undefined
        )
          return true;
        return false;
      },
      infoText: (data, _matches, output) => {
        return data.isIceTrue
          ? output.trueIcePuddle!({
            mech1: output.trueIce!(),
            mech2: output.puddle!(),
            mech3: output.spread!(),
          })
          : output.fakeIcePuddle!({
            mech1: output.fakeIce!(),
            mech2: output.puddle!(),
            mech3: output.spread!(),
          });
      },
      outputStrings: mysteryMagicOutputStrings,
    },
    {
      id: 'DMU P1 Vitrophyre',
      // Trigger on BAAC Gravitas, ~4s to get away
      type: 'Ability',
      netRegex: { id: 'BAAC', source: 'Graven Image', capture: false },
      suppressSeconds: 1,
      alertText: (data, _matches, output) => {
        if (data.gravenImageTether === 'vitrophyre')
          return output.spread!();
        return output.avoidTethers!();
      },
      outputStrings: {
        avoidTethers: {
          en: 'Avoid Tethered Players',
          cn: '远离连线玩家',
        },
        spread: {
          en: 'Spread (avoid puddles)',
          cn: '散开（避开毒圈）',
        },
      },
    },
    {
      id: 'DMU P1 Double-trouble Trap 3 Early',
      type: 'GainsEffect',
      netRegex: { effectId: '13D6', capture: true },
      delaySeconds: 0.1,
      suppressSeconds: 1,
      infoText: (data, matches, output) => {
        const duration = parseFloat(matches.duration);
        // Only capture 3rd set
        if (duration < 48 || duration > 50)
          return;

        // Check if players died
        if (data.doubleTroubleTrapTargets[0] === undefined)
          return;

        const players = getDoubleTroubleTrapTargetNames(data);
        if (players.length === 0)
          return;

        const msg = players?.join(', ');
        return output.knockbackFromLater!({ players: msg });
      },
      outputStrings: trapOutputStrings,
    },
    {
      id: 'DMU P1 Impertinent Will',
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: true },
      condition: (data, matches) => data.yellowTowerIds.includes(matches.id),
      alertText: (_data, _matches, output) => output.goWest!(),
      outputStrings: {
        goWest: Outputs.getLeftAndWest,
      },
    },
    {
      id: 'DMU P1 Gravitational Wave',
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: true },
      condition: (data, matches) => data.purpleTowerIds.includes(matches.id),
      alertText: (_data, _matches, output) => output.goEast!(),
      outputStrings: {
        goEast: Outputs.getRightAndEast,
      },
    },
    {
      id: 'DMU P1 Gravitas and Vitrophyre Tethers 2',
      type: 'Tether',
      netRegex: { id: headMarkerData['imageTether'], capture: true },
      condition: (data, matches) => {
        return data.me === matches.target &&
          data.isIceTrue !== undefined &&
          data.isThunderTrue === undefined &&
          data.isFireTrue === undefined;
      },
      delaySeconds: 2,
      durationSeconds: 6,
      infoText: (data, matches, output) => {
        const actor = data.actorPositions[matches.sourceId];
        if (actor === undefined)
          return output.tetherOnYou!();

        const x = actor.x;
        if (x < 103 && x > 101) // Graven Image 2: Gravitas target
          return output.gravitas!({
            mech1: output.puddle!(),
            mech2: output.spread!(),
          });
        if (x > 125) // Graven Image 2: Vitrophyre target
          return output.vitrophyre!({
            mech1: output.puddle!(),
            mech2: output.spread!(),
          });
        return output.tetherOnYou!();
      },
      outputStrings: {
        puddle: {
          en: 'Bait Puddle',
          de: 'Fläche ködern',
          fr: 'Déposez',
          ja: 'AOE誘導',
          cn: '诱导AOE',
          ko: '장판 유도',
          tc: '誘導AOE',
        },
        middle: Outputs.goIntoMiddle,
        spread: Outputs.spread,
        tetherOnYou: {
          en: 'Tether on YOU',
          de: 'Verbindung auf DIR',
          fr: 'Lien sur VOUS',
          ja: '線ついた',
          cn: '连线点名',
          ko: '선 대상자 지정됨',
          tc: '連線點名',
        },
        gravitas: {
          en: '${mech1} => ${mech2}',
          cn: '${mech1} => ${mech2}',
        },
        vitrophyre: {
          en: '${mech1} => ${mech2}',
          cn: '${mech1} => ${mech2}',
        },
        indulgent: {
          en: 'Confuse Tether on YOU',
          cn: '混乱连线点名',
        },
        idyllic: {
          en: 'Sleep Tether on YOU',
          cn: '睡眠连线点名',
        },
      },
    },
    {
      id: 'DMU P1 Double-trouble Trap 2',
      type: 'GainsEffect',
      netRegex: { effectId: '13D6', capture: true },
      condition: (_data, matches) => parseFloat(matches.duration) > 67,
      delaySeconds: (_data, matches) => parseFloat(matches.duration) - 5,
      suppressSeconds: 1,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = trapOutputStrings;

        // Check if players died
        if (data.doubleTroubleTrapTargets[0] === undefined)
          return;

        const players = getDoubleTroubleTrapTargetNames(data);
        if (players.length === 0)
          return;

        const severity = getDoubleTroubleTrapTargetsForRole(data).includes(data.me)
          ? 'alertText'
          : 'infoText';
        const msg = players?.join(', ');
        return { [severity]: output.knockbackFrom!({ players: msg }) };
      },
    },
    {
      id: 'DMU P1 Double-trouble Trap 3',
      type: 'GainsEffect',
      netRegex: { effectId: '13D6', capture: true },
      condition: (_data, matches) => {
        const duration = parseFloat(matches.duration);
        return duration > 48 && duration < 50;
      },
      delaySeconds: (_data, matches) => parseFloat(matches.duration) - 5,
      suppressSeconds: 1,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = trapOutputStrings;

        // Check if players died
        if (data.doubleTroubleTrapTargets[0] === undefined)
          return;

        const players = getDoubleTroubleTrapTargetNames(data);
        if (players.length === 0)
          return;

        const severity = getDoubleTroubleTrapTargetsForRole(data).includes(data.me)
          ? 'alertText'
          : 'infoText';
        const msg = players?.join(', ');
        return { [severity]: output.knockbackFrom!({ players: msg }) };
      },
    },
    {
      id: 'DMU P1 Tele-Portent Collect',
      // Debuffs distributed to 8 players:
      // Players with 2 of the same are always:
      // 130F Left  (7s) + 130F Left  (10s)
      // 130E Right (7s) + 130E Right (10s)
      // 130D Down  (7s) + 130D Down  (10s)
      // 130C Up    (7s) + 130C Up    (10s)
      //
      // The remaining players may have differing patterns:
      // Pattern 1:
      // 130D Down  (7s) + 13DA Left  (10s)
      // 13D9 Right (7s) + 130C Up    (10s)
      // 13D8 Down  (7s) + 130E Right (10s)
      // 130F Left  (7s) + 13D7 Up    (10s)
      //
      // Pattern 2:
      // 130D Down  (7s) + 13DA Left  (10s)
      // 13D9 Right (7s) + 130C Up    (10s)
      // 130E Right (7s) + 13D8 Down  (10s)
      // 13D7 Up    (7s) + 130F Left  (10s)
      //
      // Pattern 3:
      // 130D Down  (7s) + 13DA Left  (10s)
      // 13D9 Right (7s) + 130C Up    (10s)
      // 130E Right (7s) + 13D8 Down  (10s)
      // 130F Left  (7s) + 13D7 Up    (10s)
      //
      // Pattern 4:
      // 13DA Left  (7s) + 130D Down  (10s)
      // 130C Up    (7s) + 13D9 Right (10s)
      // 130E Right (7s) + 13D8 Down  (10s)
      // 130F Left  (7s) + 13D7 Up    (10s)
      //
      // Possibly More?
      // Varying strategies to resolve
      // Players with the same arrows will get a 6s 503 Confused which causes them to target nearest players
      // Players with different arrows will cause a 6s 131E Sleep aoe
      type: 'GainsEffect',
      netRegex: {
        effectId: [
          '130C', // Up
          '130D', // Down
          '130E', // Right
          '130F', // Left
          '13D7', // Up
          '13D8', // Down
          '13D9', // Right
          '13DA', // Left
        ],
        capture: true,
      },
      condition: Conditions.targetIsYou(),
      run: (data, matches) => {
        const effectMap: { [effectId: string]: typeof data.myTelePortent1 } = {
          '130C': 'up',
          '130D': 'down',
          '130E': 'right',
          '130F': 'left',
          '13D7': 'up',
          '13D8': 'down',
          '13D9': 'right',
          '13DA': 'left',
        };
        const duration = parseFloat(matches.duration);
        if (duration < 8) {
          data.myTelePortent1 = effectMap[matches.effectId];
          return;
        }
        data.myTelePortent2 = effectMap[matches.effectId];
      },
    },
    {
      id: 'DMU P1 Tele-Portents',
      type: 'GainsEffect',
      netRegex: {
        effectId: [
          '130C', // Up
          '130D', // Down
          '130E', // Right
          '130F', // Left
          '13D7', // Up
          '13D8', // Down
          '13D9', // Right
          '13DA', // Left
        ],
        capture: true,
      },
      condition: Conditions.targetIsYou(),
      durationSeconds: 7,
      infoText: (data, _matches, output) => {
        if (data.myTelePortent1 === undefined || data.myTelePortent2 === undefined)
          return;
        const portents = data.myTelePortent1 + data.myTelePortent2;
        return output[portents]!();
      },
      outputStrings: {
        upup: {
          en: 'Up Portents',
          cn: '上',
        },
        downdown: {
          en: 'Down Portents',
          cn: '下',
        },
        rightright: {
          en: 'Right Portents',
          cn: '右',
        },
        leftleft: {
          en: 'Left Portents',
          cn: '左',
        },
        downleft: {
          en: 'Down => Left Portent',
          cn: '左下角边',
        },
        downright: {
          en: 'Down => Right Portent',
          cn: '右下边角',
        },
        rightup: {
          en: 'Right => Up Portent',
          cn: '右上边角',
        },
        rightdown: {
          en: 'Right => Down Portent',
          cn: '右下角边',
        },
        leftup: {
          en: 'Left => Up Portent',
          cn: '左上角边',
        },
        leftdown: {
          en: 'Left => Down Portent',
          cn: '左下边角',
        },
        upright: {
          en: 'Up => Right Portent',
          cn: '右上角边',
        },
        upleft: {
          en: 'Up => Left Portent',
          cn: '左上边角',
        },
      },
    },
    {
      id: 'DMU P1 Tele-Portent 2',
      // Not enough time to have lengthy TTS, but could configure this to give direction instead of move
      type: 'LosesEffect',
      netRegex: {
        effectId: [
          '130C', // Up
          '130D', // Down
          '130E', // Right
          '130F', // Left
          '13D7', // Up
          '13D8', // Down
          '13D9', // Right
          '13DA', // Left
        ],
        capture: true,
      },
      condition: (data, matches) => {
        if (data.me === matches.target)
          if (data.myTelePortent1 !== undefined)
            return true;
        return false;
      },
      durationSeconds: 3,
      response: Responses.moveAway('alert'),
    },
    {
      id: 'DMU P1 Tele-Portent Cleanup',
      type: 'LosesEffect',
      netRegex: {
        effectId: [
          '130C', // Up
          '130D', // Down
          '130E', // Right
          '130F', // Left
          '13D7', // Up
          '13D8', // Down
          '13D9', // Right
          '13DA', // Left
        ],
        capture: true,
      },
      condition: Conditions.targetIsYou(),
      suppressSeconds: 1,
      run: (data) => {
        delete data.myTelePortent1;
        delete data.myTelePortent2;
      },
    },
    {
      id: 'DMU P1 Ave Maria',
      // BAB3 Ave Maria
      // The animation is visible ~9.89s before cast goes off, however
      // When animation becomes visible, the players will be asleep or
      // confused for another ~3.4s. Once the debuff ends the players have
      // ~6.4s to turn character
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: true },
      condition: (data, matches) => data.fakeEyeTowerIds.includes(matches.id),
      durationSeconds: 9.5,
      countdownSeconds: 3.4, // Estimated time debuff would expire
      infoText: (_data, _matches, output) => output.lookAt!(),
      outputStrings: {
        lookAt: {
          en: 'Look At Statue',
          de: 'Statue anschauen',
          fr: 'Regardez la statue',
          ja: '像を見る！',
          cn: '面对神像',
          ko: '시선 바라보기',
          tc: '面對神像',
        },
      },
    },
    {
      id: 'DMU P1 Indolent Will',
      // BAB4 Indolent Will
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: true },
      condition: (data, matches) => data.eyeTowerIds.includes(matches.id),
      durationSeconds: 9.5,
      countdownSeconds: 3.4, // Estimated time debuff would expire
      infoText: (_data, _matches, output) => output.lookAway!(),
      outputStrings: {
        lookAway: {
          en: 'Look Away From Statue',
          de: 'Von Statue wegschauen',
          fr: 'Ne regardez pas la statue',
          ja: '塔を見ない！',
          cn: '背对神像',
          ko: '시선 피하기',
          tc: '背對神像',
        },
      },
    },
    {
      id: 'DMU P1 Mystery Magic Fire and Thunder',
      // Set 3: Only Fire and Thunder should be set
      type: 'StartsUsing',
      netRegex: { id: 'BA94', source: 'Kefka', capture: false },
      condition: (data) => {
        return data.isFireTrue !== undefined && data.isThunderTrue !== undefined;
      },
      infoText: (data, _matches, output) => {
        const fireMarker = data.fireMarker;
        if (
          (fireMarker === headMarkerData['dorito'] && data.isFireTrue) ||
          (fireMarker === headMarkerData['stack'] && !data.isFireTrue)
        )
          return data.isThunderTrue
            ? output.spreadTrueThunder!({
              mech: output.spread!(),
              thunder: output.trueThunder!(),
            })
            : output.spreadFakeThunder!({
              mech: output.spread!(),
              thunder: output.fakeThunder!(),
            });

        if (
          (fireMarker === headMarkerData['dorito'] && !data.isFireTrue) ||
          (fireMarker === headMarkerData['stack'] && data.isFireTrue)
        ) {
          return data.isThunderTrue
            ? output.stackTrueThunder!({
              mech: output.stack!(),
              thunder: output.trueThunder!(),
            })
            : output.stackFakeThunder!({
              mech: output.stack!(),
              thunder: output.fakeThunder!(),
            });
        }
      },
      outputStrings: mysteryMagicOutputStrings,
    },
    {
      id: 'DMU P1 Mystery Magic Cleanup',
      // C622 Light of Judgment to reset for the Graven Image 2
      type: 'StartsUsing',
      netRegex: { id: ['BA94', 'C622'], source: 'Kefka', capture: false },
      run: (data) => {
        delete data.isFireTrue;
        delete data.isIceTrue;
        delete data.isThunderTrue;
        delete data.fireMarker;
      },
    },
    {
      id: 'DMU P2 Ultimate Embrace',
      type: 'StartsUsing',
      netRegex: { id: 'C24C', source: 'Kefka', capture: true },
      response: Responses.sharedTankBuster(),
    },
    {
      id: 'DMU P2 Forsaken',
      // 7s cast
      type: 'StartsUsing',
      netRegex: { id: 'BABC', source: 'Kefka', capture: false },
      durationSeconds: 6.7,
      response: Responses.bigAoe('alert'),
    },
    {
      id: 'DMU P2 Path of Light Headmarker Tracker',
      // When standing in Path of Light tower, causes BAC0 Spelldriver (3-person stack)
      // When standing in Path of Light tower, causes BAC2 Spellwave (cone targetting nearest player)
      // When standing in Path of Light tower, causes BAC1 Spellscatter (small aoe on the player)
      // Headmarkers update ~2.5s prior to 13DB Spell's Trouble debuff count decrementing
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['stackPath'],
          headMarkerData['conePath'],
          headMarkerData['spreadPath'],
        ],
        capture: true,
      },
      run: (data, matches) => {
        const id = matches.id;
        const target = matches.target;
        const marker = pathOfLightMarkerById[id];
        if (marker === undefined)
          return;

        // Storing self for simple lookups later
        // This can also be used to track how many towers have been soaked
        // and what was soaked before to handle who baits where on evens
        if (data.me === target)
          data.myPathOfLights.push(marker);

        // Clear previous Headmarker if set
        data.pathOfLightStackPlayers = data.pathOfLightStackPlayers.filter((t) => t !== target);
        data.pathOfLightConePlayers = data.pathOfLightConePlayers.filter((t) => t !== target);
        data.pathOfLightSpreadPlayers = data.pathOfLightSpreadPlayers.filter((t) => t !== target);
        data.pathOfLightMarkerByPlayer[target] = marker;

        if (marker === 'stack')
          data.pathOfLightStackPlayers.push(target);
        else if (marker === 'cone')
          data.pathOfLightConePlayers.push(target);
        else
          data.pathOfLightSpreadPlayers.push(target);
      },
    },
    {
      id: 'DMU P2 Path of Light Towers 1',
      // First Tower:
      // 2 Soak markers
      // 3 Cone markers (same role)
      // 3 Spread markers (same role)
      // If not marked for soak, check role of soak marked players, if matches
      // player, add to output. Player will then know if they need to soak
      // Unfortunately we do not know partners until the first tower is taken
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['stackPath'],
          headMarkerData['conePath'],
          headMarkerData['spreadPath'],
        ],
        capture: true,
      },
      condition: (data, matches) => {
        return data.me === matches.target && data.pathOfLightCounter === 1;
      },
      delaySeconds: 0.1, // Delay for party headmarker collect
      durationSeconds: 9,
      infoText: (data, _matches, output) => {
        updatePathOfLightAssignments(data);
        const call = getStealFireTowerOneOutput(data, data.myPathOfLightAssignment);
        return output[call]!();
      },
      outputStrings: forsakenOutputStrings,
    },
    {
      id: 'DMU P2 Path of Light Counter',
      // Used to track which step of the paths we are own
      // 4 Players soak Odd Towers, 4 Players soak Even Towers
      // Headmarkers get applied to those hit ~0.5s after
      type: 'Ability',
      netRegex: { id: 'BABE', source: 'Kefka', capture: false },
      suppressSeconds: 1,
      run: (data) => data.pathOfLightCounter = data.pathOfLightCounter + 1,
    },
    {
      id: 'DMU P2 Path of Light Tower 2 1238',
      // This set should not contain stack markers
      // If stacks exist, they came from first set
      // 2 Cones and 2 Spreads will soak towers
      //
      // Headmarkers come out ~2s before Future's/Past's End
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['stackPath'],
          headMarkerData['conePath'],
          headMarkerData['spreadPath'],
        ],
        capture: true,
      },
      condition: (data, matches) => data.me === matches.target && data.pathOfLightCounter === 2,
      delaySeconds: 0.1, // Delay for party headmarker collect
      durationSeconds: 9,
      infoText: (data, matches, output) => {
        const assignment = data.myPathOfLightAssignment;
        if (assignment?.group !== '1238') {
          if (assignment?.group === 'unknown')
            return output.unknown!();
          return;
        }

        const marker = pathOfLightMarkerById[matches.id];
        if (marker === undefined)
          return output.unknown!();
        const call = getStealFireTowerTwoOutput(marker);
        return output[call]!();
      },
      outputStrings: {
        leftTowerInsidePairBait: forsakenOutputStrings.leftTowerInsidePairBait!,
        rightTowerInsideSpread: forsakenOutputStrings.rightTowerInsideSpread!,
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'DMU P2 Path of Light Tower 2 4567',
      // 4567 keeps the first headmarker here.
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['stackPath'],
          headMarkerData['conePath'],
          headMarkerData['spreadPath'],
        ],
        capture: false,
      },
      condition: (data) => data.pathOfLightCounter === 2,
      delaySeconds: 0.1, // Delay for party headmarker collect
      durationSeconds: 9,
      suppressSeconds: 1,
      infoText: (data, _matches, output) => {
        const assignment = data.myPathOfLightAssignment;
        if (assignment?.group === '4567') {
          const call = getStealFireTowerTwoBaitOutput(assignment.slot);
          return output[call]!();
        }
        if (assignment?.group === 'unknown')
          return output.unknown!();
      },
      outputStrings: {
        leftUpBait: forsakenOutputStrings.leftUpBait!,
        leftDownBait: forsakenOutputStrings.leftDownBait!,
        rightUpBait: forsakenOutputStrings.rightUpBait!,
        rightDownBait: forsakenOutputStrings.rightDownBait!,
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'DMU P2 Future\'s End/Past\'s End Baits',
      // There are four end casts
      // 10s apart
      // BAD2 and BAD3 are the castbar, damage doesn't go out until later
      // TODO: Get Tower Locations
      type: 'Ability',
      netRegex: { id: ['BAD2', 'BAD3'], source: 'Kefka', capture: true },
      delaySeconds: 1.2, // Time until headmarker damage
      alertText: (_data, matches, output) => {
        return matches.id === 'BAD2' ? output.future!() : output.past!();
      },
      outputStrings: {
        future: {
          en: 'Bait Ending opposite Towers',
          cn: '正面引导',
        },
        past: {
          en: 'Bait Ending between Towers',
          cn: '背面引导',
        },
      },
    },
    {
      id: 'DMU P2 Path of Light Tower 3 1238',
      // BADC All Things Ending (Future)
      // BADD All Things Ending (Past)
      // There should be two stacks, a cone and an aoe
      type: 'StartsUsing',
      netRegex: { id: ['BADC', 'BADD'], source: 'Kefka', capture: false },
      condition: (data) =>
        data.pathOfLightCounter === 3 && data.myPathOfLightAssignment?.group === '1238',
      suppressSeconds: 1,
      promise: collectPathOfLightStackCombatants,
      alertText: (data, _matches, output) => {
        const call = getStealFireOddTowerOutput(data);
        return output[call]!();
      },
      outputStrings: forsakenOutputStrings,
    },
    {
      id: 'DMU P2 Path of Light Tower 3 4567',
      // 4567 keeps the previous headmarker here.
      type: 'StartsUsing',
      netRegex: { id: ['BADC', 'BADD'], source: 'Kefka', capture: false },
      condition: (data) =>
        data.pathOfLightCounter === 3 && data.myPathOfLightAssignment?.group === '4567',
      suppressSeconds: 1,
      alertText: (data, _matches, output) => {
        const call = getStealFireTowerOneOutput(data, data.myPathOfLightAssignment);
        return output[call]!();
      },
      outputStrings: forsakenOutputStrings,
    },
    {
      id: 'DMU P2 Path of Light Tower 4 4567',
      // 1238 receives new headmarkers here; 4567 keeps the previous headmarker.
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['stackPath'],
          headMarkerData['conePath'],
          headMarkerData['spreadPath'],
        ],
        capture: false,
      },
      condition: (data) =>
        data.pathOfLightCounter === 4 && data.myPathOfLightAssignment?.group === '4567',
      delaySeconds: 0.1, // Delay for party headmarker collect
      durationSeconds: 9,
      suppressSeconds: 1,
      infoText: (data, _matches, output) => {
        const marker = getPathOfLightMarker(data, data.me);
        const call = getStealFireTowerTwoOutput(marker);
        return output[call]!();
      },
      outputStrings: {
        leftTowerInsidePairBait: forsakenOutputStrings.leftTowerInsidePairBait!,
        rightTowerInsideSpread: forsakenOutputStrings.rightTowerInsideSpread!,
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'DMU P2 Path of Light Tower 4 1238',
      // 1238 keeps the previous headmarker here.
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['stackPath'],
          headMarkerData['conePath'],
          headMarkerData['spreadPath'],
        ],
        capture: false,
      },
      condition: (data) => data.pathOfLightCounter === 4,
      delaySeconds: 0.1, // Delay for party headmarker collect
      durationSeconds: 9,
      suppressSeconds: 1,
      infoText: (data, _matches, output) => {
        const assignment = data.myPathOfLightAssignment;
        if (assignment?.group === '1238') {
          const call = getStealFireTowerTwoBaitOutput(assignment.slot);
          return output[call]!();
        }
        if (assignment?.group === 'unknown')
          return output.unknown!();
      },
      outputStrings: {
        leftUpBait: forsakenOutputStrings.leftUpBait!,
        leftDownBait: forsakenOutputStrings.leftDownBait!,
        rightUpBait: forsakenOutputStrings.rightUpBait!,
        rightDownBait: forsakenOutputStrings.rightDownBait!,
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'DMU P2 Path of Light Tower 5 4567',
      // BADC All Things Ending (Future)
      // BADD All Things Ending (Past)
      // There should be two stacks, a cone and an aoe
      type: 'StartsUsing',
      netRegex: { id: ['BADC', 'BADD'], source: 'Kefka', capture: false },
      condition: (data) =>
        data.pathOfLightCounter === 5 && data.myPathOfLightAssignment?.group === '4567',
      suppressSeconds: 1,
      promise: collectPathOfLightStackCombatants,
      alertText: (data, _matches, output) => {
        const call = getStealFireOddTowerOutput(data);
        return output[call]!();
      },
      outputStrings: forsakenOutputStrings,
    },
    {
      id: 'DMU P2 Path of Light Tower 5 1238',
      // 1238 keeps the previous headmarker here.
      type: 'StartsUsing',
      netRegex: { id: ['BADC', 'BADD'], source: 'Kefka', capture: false },
      condition: (data) =>
        data.pathOfLightCounter === 5 && data.myPathOfLightAssignment?.group === '1238',
      suppressSeconds: 1,
      promise: collectPathOfLightConeCombatants,
      alertText: (data, _matches, output) => {
        const call = getStealFireTowerOneOutputWithConeRelative(
          data,
          data.myPathOfLightAssignment,
        );
        return output[call]!();
      },
      outputStrings: forsakenOutputStrings,
    },
    {
      id: 'DMU P2 Path of Light Tower 6 4567',
      // This set should not contain stack markers
      // If stacks exist, they came from first set
      // 2 Cones and 2 Spreads will soak towers
      //
      // Headmarkers come out ~2s before Future's/Past's End
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['stackPath'],
          headMarkerData['conePath'],
          headMarkerData['spreadPath'],
        ],
        capture: true,
      },
      condition: (data, matches) => data.me === matches.target && data.pathOfLightCounter === 6,
      delaySeconds: 0.1, // Delay for party headmarker collect
      durationSeconds: 9,
      infoText: (data, matches, output) => {
        const assignment = data.myPathOfLightAssignment;
        if (assignment?.group !== '4567') {
          if (assignment?.group === 'unknown')
            return output.unknown!();
          return;
        }

        const marker = pathOfLightMarkerById[matches.id];
        if (marker === undefined)
          return output.unknown!();
        const call = getStealFireTowerTwoOutput(marker);
        return output[call]!();
      },
      outputStrings: {
        leftTowerInsidePairBait: forsakenOutputStrings.leftTowerInsidePairBait!,
        rightTowerInsideSpread: forsakenOutputStrings.rightTowerInsideSpread!,
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'DMU P2 Path of Light Tower 6 1238',
      // 1238 keeps the previous headmarker here.
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['stackPath'],
          headMarkerData['conePath'],
          headMarkerData['spreadPath'],
        ],
        capture: false,
      },
      condition: (data) => data.pathOfLightCounter === 6,
      delaySeconds: 0.1, // Delay for party headmarker collect
      durationSeconds: 9,
      suppressSeconds: 1,
      infoText: (data, _matches, output) => {
        const assignment = data.myPathOfLightAssignment;
        if (assignment?.group === '1238') {
          const call = getStealFireTowerTwoBaitOutput(assignment.slot);
          return output[call]!();
        }
        if (assignment?.group === 'unknown')
          return output.unknown!();
      },
      outputStrings: {
        leftUpBait: forsakenOutputStrings.leftUpBait!,
        leftDownBait: forsakenOutputStrings.leftDownBait!,
        rightUpBait: forsakenOutputStrings.rightUpBait!,
        rightDownBait: forsakenOutputStrings.rightDownBait!,
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'DMU P2 Path of Light Tower 7 4567',
      // BADC All Things Ending (Future)
      // BADD All Things Ending (Past)
      // 4567 uses the latest headmarker here.
      type: 'StartsUsing',
      netRegex: { id: ['BADC', 'BADD'], source: 'Kefka', capture: false },
      condition: (data) =>
        data.pathOfLightCounter === 7 && data.myPathOfLightAssignment?.group === '4567',
      suppressSeconds: 1,
      promise: collectPathOfLightStackCombatants,
      alertText: (data, _matches, output) => {
        const call = getStealFireOddTowerOutput(data);
        return output[call]!();
      },
      outputStrings: forsakenOutputStrings,
    },
    {
      id: 'DMU P2 Path of Light Tower 7 1238',
      // 1238 keeps the previous headmarker here.
      type: 'StartsUsing',
      netRegex: { id: ['BADC', 'BADD'], source: 'Kefka', capture: false },
      condition: (data) =>
        data.pathOfLightCounter === 7 && data.myPathOfLightAssignment?.group === '1238',
      suppressSeconds: 1,
      promise: collectPathOfLightConeCombatants,
      alertText: (data, _matches, output) => {
        const call = getStealFireTowerOneOutputWithConeRelative(
          data,
          data.myPathOfLightAssignment,
        );
        return output[call]!();
      },
      outputStrings: forsakenOutputStrings,
    },
    {
      id: 'DMU P2 Path of Light Tower 8 1238',
      // 1238 uses the latest headmarker from after tower 3.
      type: 'Ability',
      netRegex: { id: 'BABE', source: 'Kefka', capture: false },
      condition: (data) =>
        data.pathOfLightCounter === 8 && data.myPathOfLightAssignment?.group === '1238',
      delaySeconds: 0.3,
      durationSeconds: 9,
      suppressSeconds: 1,
      infoText: (data, _matches, output) => {
        const marker = getPathOfLightMarker(data, data.me);
        const call = getStealFireTowerTwoOutput(marker);
        return output[call]!();
      },
      outputStrings: {
        leftTowerInsidePairBait: forsakenOutputStrings.leftTowerInsidePairBait!,
        rightTowerInsideSpread: forsakenOutputStrings.rightTowerInsideSpread!,
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'DMU P2 Path of Light Tower 8 4567',
      // 4567 keeps the previous headmarker here.
      type: 'Ability',
      netRegex: { id: 'BABE', source: 'Kefka', capture: false },
      condition: (data) =>
        data.pathOfLightCounter === 8 && data.myPathOfLightAssignment?.group === '4567',
      delaySeconds: 0.3,
      durationSeconds: 9,
      suppressSeconds: 1,
      infoText: (data, _matches, output) => {
        const assignment = data.myPathOfLightAssignment;
        const call = getStealFireTowerTwoBaitOutput(assignment?.slot);
        return output[call]!();
      },
      outputStrings: {
        leftUpBait: forsakenOutputStrings.leftUpBait!,
        leftDownBait: forsakenOutputStrings.leftDownBait!,
        rightUpBait: forsakenOutputStrings.rightUpBait!,
        rightDownBait: forsakenOutputStrings.rightDownBait!,
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'DMU P2 Last All Things Ending Followup',
      // BADC All Things Ending (Future)
      type: 'StartsUsing',
      netRegex: { id: 'BADC', source: 'Kefka', capture: false },
      condition: (data) => data.pathOfLightCounter === 9,
      suppressSeconds: 1,
      response: Responses.getBehind(),
    },
    {
      id: 'DMU P2 Light of Judgment',
      type: 'StartsUsing',
      netRegex: { id: 'BABD', source: 'Kefka', capture: false },
      response: Responses.bigAoe('alert'),
    },
    {
      id: 'DMU P2 Trine Collector',
      // Trines start with 3 spawns, then 1, then 3 more.
      // The first set is used as the later tank/party safe spots.
      type: 'CombatantMemory',
      netRegex: {
        change: 'Add',
        pair: [{ key: 'BNpcID', value: ['1EBFB2', '1EBFB3'] }],
        capture: true,
      },
      run: (data, matches) => {
        const x = parseFloat(matches.pairPosX ?? '0');
        const y = parseFloat(matches.pairPosY ?? '0');

        if (data.trineDirNums.length !== 3) {
          const dirNum = Directions.xyTo16DirNum(x, y, centerX, centerY);
          data.trineDirNums.push(dirNum);
        }
      },
    },
    {
      id: 'DMU P2 Trines 1 (Early)',
      type: 'CombatantMemory',
      netRegex: {
        change: 'Add',
        pair: [{ key: 'BNpcID', value: ['1EBFB2', '1EBFB3'] }],
        capture: false,
      },
      condition: (data) => data.trineDirNums.length === 3,
      durationSeconds: 12,
      suppressSeconds: 99999,
      infoText: (data, _matches, output) => {
        const sorted = sortTrineDirNumsByAPointCounterclockwise(data.trineDirNums);
        const tankDir = trineDirNumToOutputKey(sorted[0]);
        const partyDir = trineDirNumToOutputKey(sorted[1]);

        return output.safeSpots!({
          tank: output[tankDir]!(),
          party: output[partyDir]!(),
        });
      },
      outputStrings: {
        ...Directions.outputStrings16Dir,
        safeSpots: {
          en: 'Later: Tanks ${tank}; ${party}',
          cn: '稍后：双T ${tank}；${party}',
        },
      },
    },
    {
      id: 'DMU P2 Single Wing of Destruction',
      // BACD Wings of Destruction, Left wing highlight
      // BACE Wingso of Desctruction, Right wing highlight
      // Halfroom cleaves
      type: 'StartsUsing',
      netRegex: { id: ['BACD', 'BACE'], source: 'Kefka', capture: true },
      infoText: (_data, matches, output) => {
        if (matches.id === 'BACD')
          return output.right!();
        return output.left!();
      },
      outputStrings: {
        right: Outputs.right,
        left: Outputs.left,
      },
    },
    {
      id: 'DMU P2 Wings of Destruction',
      // Players need to move for trines at the same time as the tankbuster call.
      type: 'StartsUsing',
      netRegex: { id: 'C487', source: 'Kefka', capture: false },
      alertText: (data, _matches, output) => {
        const sorted = sortTrineDirNumsByAPointCounterclockwise(data.trineDirNums);
        const tankDir = trineDirNumToOutputKey(sorted[0]);
        const partyDir = trineDirNumToOutputKey(sorted[1]);

        if (data.myPartySlot === 'MT')
          return output.tankBait!({
            dir: output[tankDir]!(),
            bait: output.nearBait!(),
          });
        if (data.myPartySlot === 'ST')
          return output.tankBait!({
            dir: output[tankDir]!(),
            bait: output.farBait!(),
          });
        if (data.role === 'tank')
          return output.tankBait!({
            dir: output[tankDir]!(),
            bait: output.nearFarBait!(),
          });

        return output.partySafe!({
          dir: output[partyDir]!(),
        });
      },
      outputStrings: {
        ...Directions.outputStrings16Dir,
        tankBait: {
          en: '${dir}: ${bait}',
          cn: '${dir}：${bait}',
        },
        partySafe: {
          en: '${dir}',
          cn: '${dir}',
        },
        nearBait: {
          en: 'Bait Near',
          cn: '引导近死刑',
        },
        farBait: {
          en: 'Bait Far',
          cn: '引导远死刑',
        },
        nearFarBait: {
          en: 'Bait Near/Far',
          cn: '引导近/远死刑',
        },
      },
    },
    {
      id: 'DMU P2 Aero III Assault',
      // Knockback from boss that can't be resisted
      // Applies 306 Down for the Count
      type: 'StartsUsing',
      netRegex: { id: 'C3F7', source: 'Kefka', capture: false },
      response: Responses.getUnder('alert'),
    },
    {
      id: 'DMU P3 Epic Hero/Fated Hero Debuffs',
      // Applied to 4 nearest players when Chaos and Exdeath finish casting
      // C2E2/C2E3 The Decisive Battle
      // 1060 Epic Hero: Can only damage Chaos, preferred by Melee DPS
      // 1062 Fated Hero: Can only damage Exdeath, preferred by Ranged DPS
      // These fall off once Exdeath casts BB12 Thunder III
      type: 'GainsEffect',
      netRegex: { effectId: ['1060', '1062'], capture: true },
      condition: Conditions.targetIsYou(),
      infoText: (_data, matches, output) => {
        return matches.effectId === '1060' ? output.epic!() : output.fated!();
      },
      outputStrings: {
        epic: {
          en: 'Attack Chaos',
          ko: '카오스 공격',
        },
        fated: {
          en: 'Attack Exdeath',
          ko: '엑스데스 공격',
        },
      },
    },
    {
      id: 'DMU P3 Bowels of Agony',
      type: 'StartsUsing',
      netRegex: { id: 'BAF2', source: 'Chaos', capture: false },
      response: Responses.aoe(),
    },
    {
      id: 'DMU P3 Entropy and Dynamic Fluid Debuff Collector',
      // TODO: Get crystal element spawn locations
      // Applied at BAF2 Bowels of Agony
      // 640 Entropy: On expiration player is hit with point blank AoE and fire
      // crystal targets two closest players with donut AoEs
      // 641 Dynamic Flood: On expiration creates donut AoE around the player
      // and water crystal targets two closest players with point-blank AoEs
      //
      // Entropy or Dynamic Fluid will have 19s and the other 46s duration
      // At the same time, elemental crystals spawn at intercardinals
      // Fire and Water Crystals will be opposite each other
      // Wind Crystal will be between on the opposite side
      //
      // Exdeath Tank needs to go to element that has the long timer
      // Chaos Tank needs to go between wind crystal and element with short timer
      type: 'GainsEffect',
      netRegex: { effectId: ['640', '641'], capture: true },
      run: (data, matches) => {
        const id = matches.effectId;
        if (data.isFireShort === undefined) {
          const isShort = parseFloat(matches.duration) < 20;
          data.isFireShort = (isShort && id === '640') ||
              (!isShort && id === '641')
            ? true
            : false;
        }
        if (data.me === matches.target)
          data.myElement = id === '640' ? 'fire' : 'water';

        if (id === '640')
          data.fireElementPlayers.push(matches.target);
        else
          data.waterElementPlayers.push(matches.target);
      },
    },
    {
      id: 'DMU P3 Headwind/Tailwind Debuff Collector',
      // Applied at BAF2 Bowels of Agony
      // 642 Headwind: Face away from knockback source, wind crystal targets
      // nearest player with 2-person stack
      // 643 Tailwind: Face towards knockback source, wind crystal targets
      // nearest player with 2-person stack
      // These have a 68s duration
      type: 'GainsEffect',
      netRegex: { effectId: ['642', '643'], capture: true },
      condition: Conditions.targetIsYou(),
      run: (data, matches) => data.myWind = matches.effectId === '642' ? 'head' : 'tail',
    },
    {
      id: 'DMU P3 Headwind/Tailwind Debuff',
      type: 'GainsEffect',
      netRegex: { effectId: ['642', '643'], capture: true },
      condition: Conditions.targetIsYou(),
      delaySeconds: 0.1,
      infoText: (data, matches, output) => {
        const myElement = data.myElement;
        const short = data.isFireShort
          ? output.shortFire!()
          : output.shortWater!();
        const wind = matches.effectId === '642'
          ? output.headwind!()
          : output.tailwind!();
        if (myElement !== undefined)
          return output.withElement!({
            short: short,
            element: output[myElement]!(),
            wind: wind,
          });
        return output.withoutElement!({
          short: short,
          wind: wind,
        });
      },
      outputStrings: {
        shortFire: {
          en: 'Short Fire',
        },
        shortWater: {
          en: 'Short Water',
        },
        fire: {
          en: 'Fire',
        },
        water: {
          en: 'Water',
        },
        headwind: {
          en: 'Headwind on YOU',
        },
        tailwind: {
          en: 'Tailwind on YOU',
        },
        withElement: {
          en: '${short}: ${element} + ${wind}',
        },
        withoutElement: {
          en: '${short}: ${wind}',
        },
      },
    },
    {
      id: 'DMU P3 Crystal Location Collector',
      // Crystals are added at same time as BAF2 Bowels of Agony
      //
      // First set spawns at intercardinals
      // Wind will be inbetween Fire and Water
      // The following are their BNpcIDs:
      // 1EC03A => Fire (Red Triangle) Crystal
      // 1EC03B => Water (Blue Square) Crystal
      // 1EC03C => Wind (Green Diamond) Crystal
      //
      // Later the Earth Crystal will spawn in the center
      // 1EC03D => Earth (Yellow Arrowhead) Crystal (TODO: Verify this BNnpcID)
      // They are removed once players lose their respective debuffs
      type: 'CombatantMemory',
      netRegex: {
        change: 'Add',
        pair: [{ key: 'BNpcID', value: ['1EC03A', '1EC03B', '1EC03C'] }],
        capture: true,
      },
      run: (data, matches) => {
        const x = parseFloat(matches.pairPosX ?? '0');
        const y = parseFloat(matches.pairPosY ?? '0');
        const bnpcid = matches.pairBNpcID;
        const dirNum = Directions.xyTo4DirIntercardNum(x, y, centerX, centerY);

        if (bnpcid === '1EC03A')
          data.fireCrystalDirNum = dirNum;
        else if (bnpcid === '1EC03B')
          data.waterCrystalDirNum = dirNum;
        else
          data.windCrystalDirNum = dirNum;
      },
    },
    {
      id: 'DMU P3 Short Crystal and Crystal Locations',
      type: 'CombatantMemory',
      netRegex: {
        change: 'Add',
        pair: [{ key: 'BNpcID', value: '1EC03C' }],
        capture: false,
      },
      delaySeconds: 3, // To prevent overlap with debuffs and time for collect
      durationSeconds: 16, // Duration of the first debuff
      suppressSeconds: 1,
      infoText: (data, _matches, output) => {
        const config = data.triggerSetConfig.boa;
        const fireDirNum = data.fireCrystalDirNum;
        const waterDirNum = data.waterCrystalDirNum;
        const windDirNum = data.windCrystalDirNum;
        const fireDir = fireDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[fireDirNum] ?? 'unknown';
        const waterDir = waterDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[waterDirNum] ?? 'unknown';
        const windDir = windDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[windDirNum] ?? 'unknown';
        const fShort = data.isFireShort;

        const fire = output.fire!({ dir: output[fireDir]!() });
        const water = output.water!({ dir: output[waterDir]!() });
        const wind = output.wind!({ dir: output[windDir]!() });

        if (config !== 'none') {
          const myElement = data.myElement;
          // Tank will need to first position Exdeath for Thunder III AOE
          if (data.role === 'tank') {
            const exdeathLocaleNames: LocaleText = {
              en: 'Exdeath',
              de: 'Exdeath',
              fr: 'Exdeath',
              ja: 'エクスデス',
              cn: '艾克斯迪司',
              ko: '엑스데스',
              tc: '艾克斯迪司',
            };
            const exdeathName = exdeathLocaleNames[data.parserLang];
            if (config === 'sg3k') {
              if (myElement === 'fire') {
                if (fShort) {
                  return output.moveExdeathThenMech!({
                    exdeath: exdeathName,
                    long: water,
                    mech: output.baitCrystal!({
                      crystal: fire,
                      inout: Outputs.in,
                    }),
                  });
                }

                // Get player expected to be inner water bait
                const players = data.waterElementPlayers.filter(
                  (player) => data.party.isDPS(player),
                );
                const player = data.party.member(players[0]);

                return output.moveExdeathThenMech!({
                  exdeath: exdeathName,
                  long: fire,
                  mech: output.getMiddleNearPlayer!({
                    player: player,
                  }),
                });
              }

              if (myElement === 'water') {
                if (fShort)
                  return output.moveExdeathThenMech!({
                    exdeath: exdeathName,
                    long: water,
                    mech: output.getHitByDonut!(),
                  });

                return output.moveExdeathThenMech!({
                  exdeath: exdeathName,
                  long: fire,
                  mech: output.baitCrystal!({
                    crystal: water,
                    inout: Outputs.in,
                  }),
                });
              }
            }

            // LB3 Config
            const chaosLocaleNames: LocaleText = {
              en: 'Chaos',
              de: 'Chaos',
              fr: 'Chaos',
              ja: 'カオス',
              cn: '卡奥斯',
              ko: '카오스',
              tc: '卡奧斯',
            };
            const chaosName = chaosLocaleNames[data.parserLang];
            return output.moveExdeathAndChaosThenMech!({
              exdeath: exdeathName,
              chaos: chaosName,
              dir: wind,
              mech: output.beNearWind!({
                dir: wind,
              }),
            });
          }

          if (config === 'sg3k') {
            if (myElement === 'fire') {
              if (fShort)
                return output.crystalsMech!({
                  crystals: output.shortLongCrystals!({
                    short: fire,
                    long: water,
                  }),
                  mech: output.baitCrystal!({
                    crystal: fire,
                    inout: data.role === 'dps' ? output.in!() : output.out!(),
                  }),
                });

              // Get player expected to be inner water bait
              const players = data.waterElementPlayers.filter(
                (player) => data.party.isDPS(player),
              );
              const player = data.party.member(players[0]);

              return output.crystalsMech!({
                crystals: output.shortLongCrystals!({
                  short: water,
                  long: fire,
                }),
                mech: output.getMiddleNearPlayer!({
                  player: player,
                }),
              });
            }

            if (myElement === 'water') {
              if (fShort)
                return output.crystalsMech!({
                  crystals: output.shortLongCrystals!({
                    short: fire,
                    long: water,
                  }),
                  mech: output.getHitByDonut!(),
                });
              return output.crystalsMech!({
                crystals: output.shortLongCrystals!({
                  short: water,
                  long: fire,
                }),
                mech: output.baitCrystal!({
                  crystal: water,
                  inout: data.role === 'dps' ? output.in!() : output.out!(),
                }),
              });
            }
            return output.crystalsMech!({
              crystals: output.shortLongCrystals!({
                short: fShort ? fire : water,
                long: fShort ? water : fire,
              }),
              mech: output.beNearWind!({
                dir: wind,
              }),
            });
          }

          // LB3 Config
          if (data.role !== 'dps' || Util.isMeleeDpsJob(data.job)) {
            return output.crystalsMech!({
              crystals: output.shortLongCrystals!({
                short: fShort ? fire : water,
                long: fShort ? water : fire,
              }),
              mech: output.beNearWind!({
                dir: wind,
              }),
            });
          }
          // Ranged DPS Bait
          return output.crystalsMech!({
            crystals: output.shortLongCrystals!({
              short: fShort ? fire : water,
              long: fShort ? water : fire,
            }),
            mech: output.baitCrystal!({
              crystal: fShort ? fire : water,
              inout: output.out!(),
            }),
          });
        }

        return output.crystals!({
          short: fShort ? fire : water,
          long: fShort ? water : fire,
          wind: wind,
        });
      },
      outputStrings: boaOutputStrings,
    },
    {
      id: 'DMU P3 Entropy and Fire Crystal',
      // Late goes off 2s after BAFF Shockwave
      type: 'GainsEffect',
      netRegex: { effectId: '640', capture: true },
      delaySeconds: (_data, matches) => parseFloat(matches.duration) - 4, // 6s after Lat/Long when Late
      suppressSeconds: 1,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = boaOutputStrings;
        const config = data.triggerSetConfig.boa;
        const fireDirNum = data.fireCrystalDirNum;
        const waterDirNum = data.waterCrystalDirNum;
        const windDirNum = data.windCrystalDirNum;
        const fireDir = fireDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[fireDirNum] ?? 'unknown';
        const waterDir = waterDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[waterDirNum] ?? 'unknown';
        const windDir = windDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[windDirNum] ?? 'unknown';
        const fShort = data.isFireShort;
        const myElement = data.myElement;
        const myWind = data.myWind;

        const fire = output.fire!({ dir: output[fireDir]!() });
        const water = output.water!({ dir: output[waterDir]!() });
        const wind = output.wind!({ dir: output[windDir]!() });

        const players = data.fireElementPlayers.map(
          (player) => {
            if (player === data.me)
              return output.you!();
            return data.party.member(player);
          },
        );
        const msg = players?.join(', ');
        const spread = output.fireOnPlayers!({ players: msg });

        const isRangedDPS = Util.isRangedDpsJob(data.job) || Util.isCasterDpsJob(data.job);
        const severity = config === 'lb3' && isRangedDPS
          ? 'alertText'
          : myElement === 'fire'
          ? 'alertText'
          : 'infoText';

        if (fShort) {
          if (config === 'lb3') {
            const isNotRanged = data.role !== 'dps' || Util.isMeleeDpsJob(data.job);
            return {
              [severity]: output.mechThenMech!({
                mech1: isNotRanged ? spread : output.baitCrystal!({
                  crystal: fire,
                  inout: output.out!(),
                }),
                mech2: isNotRanged
                  ? output.donutLater!()
                  : output.baitCrystal!({
                    crystal: water,
                    inout: output.out!(),
                  }),
              }),
            };
          }

          if (config === 'sg3k') {
            // Get player expected to be inner water bait
            const players = data.waterElementPlayers.filter(
              (player) => data.party.isDPS(player),
            );
            const player = data.party.member(players[0]);

            return {
              [severity]: output.mechThenMech!({
                mech1: myElement === 'fire'
                  ? output.baitCrystal!({
                    crystal: fire,
                    inout: data.role === 'dps' ? output.in!() : output.out!(),
                  })
                  : myElement === 'water'
                  ? output.getHitByDonut!()
                  : output.beNearWind!({ dir: wind }),
                mech2: myElement === 'fire'
                  ? output.getMiddleNearPlayer!({
                    player: player,
                  })
                  : myElement === 'water'
                  ? output.knockbackToDir!({
                    facing: output[myWind ?? 'unknown']!({ name: output[fireDir]!() }),
                    dir: output[waterDir]!(),
                  })
                  : output.stackPartner!(),
              }),
            };
          }
        }
        const exdeathLocaleNames: LocaleText = {
          en: 'Exdeath',
          de: 'Exdeath',
          fr: 'Exdeath',
          ja: 'エクスデス',
          cn: '艾克斯迪司',
          ko: '엑스데스',
          tc: '艾克斯迪司',
        };
        const exdeathName = exdeathLocaleNames[data.parserLang];
        if (config === 'lb3') {
          const isNotRanged = data.role !== 'dps' || Util.isMeleeDpsJob(data.job);
          return {
            [severity]: output.mechThenMech!({
              mech1: isNotRanged ? spread : output.baitCrystal!({
                crystal: fire,
                inout: output.out!(),
              }),
              mech2: Util.isRangedDpsJob(data.job)
                ? output.baitJump!()
                : output.beNearExdeath!({ name: exdeathName }),
            }),
          };
        }

        if (config === 'sg3k') {
          // Players will need to get to opposite side of Wind Crystal
          const exDeathDir = windDirNum === undefined
            ? 'unknown'
            : Directions.outputIntercardDir[(windDirNum + 2) % 4] ?? 'unknown';
          return {
            [severity]: output.mechThenMech!({
              mech1: myElement === 'fire'
                ? output.baitCrystal!({
                  crystal: fire,
                  inout: data.role === 'dps' ? output.in!() : output.out!(),
                })
                : myElement === 'water'
                ? output.getHitByDonut!()
                : output.beNearWind!({ dir: wind }),
              mech2: myElement === 'fire'
                ? output.beNearExdeath!({ name: exdeathName })
                : myElement === 'water'
                ? output.knockbackToDir!({
                  facing: output[myWind ?? 'unknown']!({
                    name: output[fireDir]!(),
                  }),
                  dir: output[exDeathDir]!(),
                })
                : output.stackPartner!(),
            }),
          };
        }
        return {
          [severity]: output.fireOnPlayersCrystalDirNum!({
            spread: spread,
            dir: fire,
            bait: output.baitFireDonut!(),
          }),
        };
      },
    },
    {
      id: 'DMU P3 Dynamic Fluid and Water Crystal',
      // Late goes off 2s after BAFF Shockwave
      type: 'GainsEffect',
      netRegex: { effectId: '641', capture: true },
      delaySeconds: (_data, matches) => parseFloat(matches.duration) - 4, // 6s after Lat/Long when Late
      suppressSeconds: 1,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = boaOutputStrings;
        const config = data.triggerSetConfig.boa;
        const fireDirNum = data.fireCrystalDirNum;
        const waterDirNum = data.waterCrystalDirNum;
        const windDirNum = data.windCrystalDirNum;
        const fireDir = fireDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[fireDirNum] ?? 'unknown';
        const waterDir = waterDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[waterDirNum] ?? 'unknown';
        const windDir = windDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[windDirNum] ?? 'unknown';
        const fShort = data.isFireShort;
        const myElement = data.myElement;
        const myWind = data.myWind;

        const fire = output.fire!({ dir: output[fireDir]!() });
        const water = output.water!({ dir: output[waterDir]!() });
        const wind = output.wind!({ dir: output[windDir]!() });

        const isRangedDPS = Util.isRangedDpsJob(data.job) || Util.isCasterDpsJob(data.job);
        const severity = config === 'lb3' && isRangedDPS
          ? 'alertText'
          : myElement === 'water'
          ? 'alertText'
          : 'infoText';

        const players = data.waterElementPlayers.map(
          (player) => {
            if (player === data.me)
              return output.you!();
            return data.party.member(player);
          },
        );
        const msg = players?.join(', ');
        const donut = output.waterOnPlayers!({ players: msg });

        if (!fShort) {
          if (config === 'lb3') {
            const isNotRanged = data.role !== 'dps' || Util.isMeleeDpsJob(data.job);
            return {
              [severity]: output.mechThenMech!({
                mech1: isNotRanged ? donut : output.baitCrystal!({
                  crystal: water,
                  inout: output.out!(),
                }),
                mech2: isNotRanged
                  ? output.roleStacks!()
                  : output.baitCrystal!({
                    crystal: fire,
                    inout: output.out!(),
                  }),
              }),
            };
          }

          if (config === 'sg3k') {
            // Get player expected to be inner water bait
            const players = data.waterElementPlayers.filter(
              (player) => data.party.isDPS(player),
            );
            const player = data.party.member(players[0]);

            return {
              [severity]: output.mechThenMech!({
                mech1: myElement === 'fire'
                  ? output.getMiddleNearPlayer!({
                    player: player,
                  })
                  : myElement === 'water'
                  ? output.baitCrystal!({
                    crystal: water,
                    inout: data.role === 'dps' ? output.in!() : output.out!(),
                  })
                  : output.beNearWind!({ dir: wind }),
                mech2: myElement === 'fire'
                  ? output.knockbackToDir!({
                    facing: output[myWind ?? 'unknown']!({ name: output[waterDir]!() }),
                    dir: output[fireDir]!(),
                  })
                  : myElement === 'water'
                  ? output.getHitByDonut!()
                  : output.stackPartner!(),
              }),
            };
          }
        }
        const exdeathLocaleNames: LocaleText = {
          en: 'Exdeath',
          de: 'Exdeath',
          fr: 'Exdeath',
          ja: 'エクスデス',
          cn: '艾克斯迪司',
          ko: '엑스데스',
          tc: '艾克斯迪司',
        };
        const exdeathName = exdeathLocaleNames[data.parserLang];
        if (config === 'lb3') {
          const isNotRanged = data.role !== 'dps' || Util.isMeleeDpsJob(data.job);
          return {
            [severity]: output.mechThenMech!({
              mech1: isNotRanged ? donut : output.baitCrystal!({
                crystal: water,
                inout: output.out!(),
              }),
              mech2: Util.isRangedDpsJob(data.job)
                ? output.baitJump!()
                : output.beNearExdeath!({ name: exdeathName }),
            }),
          };
        }

        if (config === 'sg3k') {
          // Get player expected to be inner water bait
          const players = data.waterElementPlayers.filter(
            (player) => data.party.isDPS(player),
          );
          const player = data.party.member(players[0]);
          // Players will need to get to opposite side of Wind Crystal
          const exDeathDir = windDirNum === undefined
            ? 'unknown'
            : Directions.outputIntercardDir[(windDirNum + 2) % 4] ?? 'unknown';
          return {
            [severity]: output.mechThenMech!({
              mech1: myElement === 'fire'
                ? output.getMiddleNearPlayer!({
                  player: player,
                })
                : myElement === 'water'
                ? output.baitCrystal!({
                  crystal: water,
                  inout: data.role === 'dps' ? output.in!() : output.out!(),
                })
                : output.beNearWind!({ dir: wind }),
              mech2: myElement === 'fire'
                ? output.beNearExdeath!({ name: exdeathName })
                : myElement === 'water'
                ? output.knockbackToDir!({
                  facing: output[myWind ?? 'unknown']!({
                    name: output[waterDir]!(),
                  }),
                  dir: output[exDeathDir]!(),
                })
                : output.stackPartner!(),
            }),
          };
        }

        return {
          [severity]: output.waterOnPlayersCrystalDirNum!({
            donut: donut,
            dir: water,
            bait: output.baitWaterAoe!(),
          }),
        };
      },
    },
    {
      id: 'DMU P3 Long Crystal and Wind Crystal Locations',
      // Inform that long is next, location it will Be
      // One of these spells will trigger:
      // BAF3 Stray Flames
      // BAF6 Stray Spray
      type: 'Ability',
      netRegex: { id: ['BAF3', 'BAF6'], source: 'Chaos', capture: true },
      condition: (data, matches) => {
        const fShort = data.isFireShort;
        const id = matches.id;
        // Ensure this only outputs if expected crystal went off
        return (fShort && id === 'BAF3') || (!fShort && id === 'BAF6');
      },
      durationSeconds: 27, // Duration of the first debuff
      suppressSeconds: 99999,
      infoText: (data, _matches, output) => {
        const fShort = data.isFireShort;
        const longCrystalDirNum = fShort
          ? data.waterCrystalDirNum
          : data.fireCrystalDirNum;
        const windDirNum = data.windCrystalDirNum;

        const longDir = longCrystalDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[longCrystalDirNum] ?? 'unknown';
        const windDir = windDirNum === undefined
          ? 'unknown'
          : Directions.outputIntercardDir[windDirNum] ?? 'unknown';

        return output.crystals!({
          long: fShort
            ? output.water!({ dir: output[longDir]!() })
            : output.fire!({ dir: output[longDir]!() }),
          wind: output.wind!({ dir: output[windDir]!() }),
        });
      },
      outputStrings: {
        ...Directions.outputStringsIntercardDir,
        fire: {
          en: 'Fire ${dir}',
        },
        water: {
          en: 'Water ${dir}',
        },
        wind: {
          en: 'Wind ${dir}',
        },
        crystals: {
          en: '${long} => ${wind} (later)',
        },
      },
    },
    {
      id: 'DMU P3 Wind Crystal Next Flag',
      // By the BAFF Shockwave, the next BAF3 Stray Flames / BAF6 Stray Spray
      // Will mean we will need to resolve the wind crystal next
      type: 'Ability',
      netRegex: { id: 'BAFF', source: 'Chaos', capture: false },
      suppressSeconds: 99999,
      run: (data) => data.windCrystalNext = true,
    },
    {
      id: 'DMU P3 Wind Crystal Location',
      // Inform that wind is next
      // One of these spells will trigger:
      // BAF3 Stray Flames
      // BAF6 Stray Spray
      type: 'Ability',
      netRegex: { id: ['BAF3', 'BAF6'], source: 'Chaos', capture: false },
      condition: (data) => data.windCrystalNext,
      suppressSeconds: 99999,
      infoText: (data, _matches, output) => {
        const windDirNum = data.windCrystalDirNum;
        const config = data.triggerSetConfig.boa;
        const windDir = windDirNum === undefined
          ? 'unknown'
          : config !== 'lb3'
          ? Directions.outputIntercardDir[windDirNum] ?? 'unknown'
          : data.role === 'healer'
          ? Directions.outputIntercardDir[(windDirNum + 3) % 4] ?? 'unknown' // Wrap-around
          : Util.isMeleeDpsJob(data.job) || data.role === 'tank'
          ? Directions.outputIntercardDir[(windDirNum + 2) % 4] ?? 'unknown' // Opposite of Wind Crystal
          : Directions.outputIntercardDir[(windDirNum + 1) % 4] ?? 'unknown'; // Ranged DPS

        return config !== 'lb3'
          ? output.wind!({ dir: output[windDir]!() })
          : output.knockbackToDir!({ dir: output[windDir]!() });
      },
      outputStrings: {
        ...Directions.outputStringsIntercardDir,
        wind: {
          en: 'Knockback to Wind ${dir} (later)',
        },
        knockbackToDir: {
          en: 'Knockback to ${dir} (later)',
        },
      },
    },
    {
      id: 'DMU P3 Headwind/Tailwind Cleanup',
      // If players resolve winds prior to Exdeath's Vacuum Wave
      // Long debuffs could get knocked back into the other crystal
      // Short Debuffs could run to other crystal's donut if fire or stack/bait if water
      // The remaining 4 players will have to resolve during knockback
      // Note that each time these are lost, the wind crystal triggers nearest player with 2-person stack
      type: 'LosesEffect',
      netRegex: { effectId: ['642', '643'], capture: true },
      condition: Conditions.targetIsYou(),
      run: (data) => delete data.myWind,
    },
    {
      id: 'DMU P3 Thunder III AOE',
      type: 'StartsUsing',
      netRegex: { id: 'BB12', source: 'Exdeath', capture: true },
      durationSeconds: (_data, matches) => parseFloat(matches.castTime), // 7s castTime
      infoText: (_data, matches, output) => {
        const boss = matches.source;
        return output.awayFromBoss!({ boss: boss });
      },
      outputStrings: {
        awayFromBoss: {
          en: 'Away from ${boss}',
        },
      },
    },
    {
      id: 'DMU P3 Thunder III Tankbuster',
      // Tankbuster that targets nearest player and then nearest again after 3s
      type: 'StartsUsing',
      netRegex: { id: 'BB09', source: 'Exdeath', capture: true },
      response: (data, matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = {
          avoid: {
            en: '${boss}${cleaves}',
          },
          tankCleaveNearThenSwap: {
            en: 'Near ${boss}${cleave} => ${swap}',
          },
          boss: {
            en: '${boss}: ',
          },
          tankCleave: Outputs.tankCleave,
          avoidTankCleaves: Outputs.avoidTankCleaves,
          tankSwap: Outputs.tankSwap,
        };

        const severity = data.role === 'tank' || data.role === 'healer'
          ? 'alertText'
          : 'infoText';
        const boss = output.boss!({ boss: matches.source });

        if (data.role === 'tank')
          return {
            [severity]: output.tankCleaveNearThenSwap!({
              boss: boss,
              cleave: output.tankCleave!(),
              swap: output.tankSwap!(),
            }),
          };

        return {
          [severity]: output.avoid!({
            boss: boss,
            cleaves: output.avoidTankCleaves!(),
          }),
        };
      },
    },
    {
      id: 'DMU P3 Thunder III Tank Swap',
      type: 'Ability',
      netRegex: { id: 'BB09', source: 'Exdeath', capture: true },
      condition: (data) => data.role === 'tank',
      suppressSeconds: 4,
      alertText: (data, matches, output) => {
        const boss = matches.source;
        if (matches.target === data.me)
          return output.awayFromBoss!({ boss: boss });
        return output.beNearBoss!({ boss: boss });
      },
      outputStrings: {
        beNearBoss: {
          en: 'Be Near ${boss} (swap)',
        },
        awayFromBoss: {
          en: 'Away from ${boss} (swap)',
        },
      },
    },
    {
      id: 'DMU P3 Longitudinal Implosion',
      type: 'StartsUsing',
      netRegex: { id: 'BAFD', source: 'Chaos', capture: false },
      infoText: (_data, _matches, output) => output.sides!(),
      outputStrings: {
        sides: Outputs.sidesThenFrontBack,
      },
    },
    {
      id: 'DMU P3 Latitudinal Implosion',
      type: 'StartsUsing',
      netRegex: { id: 'BAFE', source: 'Chaos', capture: false },
      infoText: (_data, _matches, output) => output.frontBack!(),
      outputStrings: {
        frontBack: Outputs.frontBackThenSides,
      },
    },
    {
      id: 'DMU P3 Ultima Blaster Collect',
      // Starts from random cardinal/intercardinal then rotates either CW or CCW
      // These are raidwide AOEs, but also include telegraphed lines and explosions
      // Ability lines can have erroneous values
      // Entity that does these has BNpcID 4BFB, added shortly before
      // 271 ActorSetPos and 261 CombatantMemory Change lines are updated just prior to the ability
      type: 'Ability',
      netRegex: { id: 'BAE3', source: 'Kefka', capture: true },
      condition: (data) => data.blasterRotation === undefined,
      suppressSeconds: 1,
      run: (data, matches) => {
        const actor = data.actorPositions[matches.sourceId];
        if (actor === undefined)
          return;

        const x2 = actor.x;
        const y2 = actor.y;
        // Get rotation of first and second Kefka blasters
        const x1 = data.firstBlaster[0];
        const y1 = data.firstBlaster[1];
        if (x1 === undefined || y1 === undefined) {
          data.firstBlaster = [x2, y2];
          data.firstBlasterDirNum = (Directions.xyTo8DirNum(x2, y2, centerX, centerY) + 4) % 8; // Need opposite side
          // Return to get the next blaster
          return;
        }

        // Compute atan2 of determinant and dot product to get rotational direction
        // Note: X and Y are flipped due to Y axis being reversed
        data.blasterRotation = Math.atan2(y1 * x2 - x1 * y2, y1 * y2 + x1 * x2);
      },
    },
    {
      id: 'DMU P3 Ultima Blaster Rotation',
      type: 'Ability',
      netRegex: { id: 'BAE3', source: 'Kefka', capture: false },
      condition: (data) => data.blasterRotation !== undefined,
      durationSeconds: 10,
      suppressSeconds: 99999,
      infoText: (data, _matches, output) => {
        const rotation = data.blasterRotation;
        const dirNum = data.firstBlasterDirNum;
        if (rotation === undefined || dirNum === undefined)
          return;

        // Will need 16Dir for positions later
        const dir = Directions.output8Dir[dirNum] ?? 'unknown';

        if (rotation < 0)
          return output.clockwise!({ card: output[dir]!() });
        if (rotation > 0)
          return output.counterclockwise!({ card: output[dir]!() });
      },
      outputStrings: {
        ...Directions.outputStrings8Dir,
        clockwise: {
          en: '<== ${card} Clockwise (Later)',
        },
        counterclockwise: {
          en: '${card} Counterclockwise (Later) ==>',
        },
      },
    },
    {
      id: 'DMU P3 Umbra Smash',
      // At start of cast the target of BB00 Umbra Smash has been locked
      // Instead of a timeline trigger, ues one of these abilities to trigger:
      // BAFD Longitudinal Implosion
      // BAFE  Latitudinal Implosion
      type: 'Ability',
      netRegex: { id: ['BAFD', 'BAFE'], source: 'Chaos', capture: false },
      delaySeconds: 10,
      suppressSeconds: 99999,
      infoText: (_data, _matches, output) => output.baitJump!(),
      outputStrings: {
        baitJump: {
          en: 'Bait Jump',
        },
      },
    },
    {
      id: 'DMU P3 Vacuum Wave',
      // If players have not yet resolved their headwinds, then they will need
      // to do so:
      // Headwind look at Exdeath
      // Tailwind look away from Exdeath
      //
      // Party can Tank LB3 to survive stacking the winds
      type: 'StartsUsing',
      netRegex: { id: 'BB13', source: 'Exdeath', capture: true },
      alertText: (data, matches, output) => {
        const windDirNum = data.windCrystalDirNum;
        const windDir = windDirNum === undefined
          ? 'unknown'
          : data.triggerSetConfig.boa !== 'lb3'
          ? Directions.outputIntercardDir[windDirNum] ?? 'unknown'
          : data.role === 'healer'
          ? Directions.outputIntercardDir[(windDirNum + 3) % 4] ?? 'unknown' // Wrap-around
          : Util.isMeleeDpsJob(data.job) || data.role === 'tank'
          ? Directions.outputIntercardDir[(windDirNum + 2) % 4] ?? 'unknown' // Opposite of Wind Crystal
          : Directions.outputIntercardDir[(windDirNum + 1) % 4] ?? 'unknown'; // Ranged DPS
        const exdeath = matches.source;

        if (data.myWind === undefined) {
          const knockback = output.knockbackFromExdeath!({ name: exdeath });
          if (windDir === undefined)
            return output.knockbackToCrystal!({
              knockback: knockback,
            });
          return output.knockbackToDir!({
            knockback: knockback,
            dir: output[windDir]!(),
          });
        }

        const knockbackFacing = output.knockbackFromFacingExdeath!({
          facing: output[data.myWind]!({ name: exdeath }),
        });

        if (windDir === undefined)
          return output.knockbackToCrystal!({
            knockback: knockbackFacing,
          });
        return output.knockbackToDir!({
          knockback: knockbackFacing,
          dir: output[windDir]!(),
        });
      },
      outputStrings: {
        ...Directions.outputStringsIntercardDir,
        tail: {
          en: 'Face ${name}',
        },
        head: Outputs.lookAwayFromTarget,
        knockbackFromExdeath: {
          en: 'Knockback from ${name}',
        },
        knockbackFromFacingExdeath: {
          en: 'Knockback from + ${facing}',
        },
        knockbackToDir: {
          en: '${knockback} to ${dir}',
        },
        knockbackToCrystal: {
          en: '${knockback} to Crystal',
        },
      },
    },
    {
      id: 'DMU P3 Vacuum Wave Tank LB3',
      type: 'StartsUsing',
      netRegex: { id: 'BB13', source: 'Exdeath', capture: true },
      condition: (data) => {
        return data.role === 'tank' &&
          data.triggerSetConfig.boa === 'lb3';
      },
      delaySeconds: (_data, matches) => parseFloat(matches.castTime) - 2, // 8s castTime, damage expected 3.9s after cast
      alarmText: (_data, _matches, output) => output.text!(),
      outputStrings: {
        text: {
          en: 'TANK LB!!',
          de: 'TANK LB!!',
          fr: 'LB TANK !!',
          ja: 'タンクLB!!',
          cn: '坦克LB!!',
          ko: '탱리밋!!',
          tc: '坦克LB!!',
        },
      },
    },
    {
      id: 'DMU P1 Ultima Blaster Location',
      // Nearest inter-inter cardinal opposite that of first blaster
      // Could also account for player missing a marker as these are added sequentially
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['1'],
          headMarkerData['2'],
          headMarkerData['3'],
          headMarkerData['4'],
          headMarkerData['5'],
          headMarkerData['6'],
          headMarkerData['7'],
          headMarkerData['8'],
        ],
        capture: true,
      },
      condition: Conditions.targetIsYou(),
      infoText: (data, matches, output) => {
        const blasterNumberMap: { [id: string]: number } = {
          '0150': 1,
          '0151': 2,
          '0152': 3,
          '0153': 4,
          '01B5': 5,
          '01B6': 6,
          '01B7': 7,
          '01B8': 8,
        };
        const blasterDirNum = data.firstBlasterDirNum;
        const rotation = data.blasterRotation;
        const id = matches.id;
        const myNum = blasterNumberMap[id];
        if (myNum === undefined)
          return;

        if (blasterDirNum === undefined || rotation === undefined || rotation === 0)
          return output.num!({ num: myNum });

        // Subtract 1 from ourself as 1 is 0th position
        const adjNum = (myNum - 1) * 2; // Convert our number to 16Dir format
        const adjBlaster = blasterDirNum * 2; // Convert blasterDirNum to 16Dir format

        // Boss is at an intercard, so +1 or -1 to get inter-inter safe spot
        const adjustedDirNum = rotation < 0
          ? (adjNum + adjBlaster + 1) % 16 // Clockwise
          : ((adjBlaster - 1 - adjNum) + 16) % 16; // Counterclock

        // Find inter-inter cardinal
        const safeDir = Directions.output16Dir[adjustedDirNum] ?? 'unknown';
        return output.text!({
          num: output.num!({ num: myNum }),
          dir: output[safeDir]!(),
        });
      },
      outputStrings: {
        ...Directions.outputStrings16Dir,
        num: {
          en: '#${num}',
          de: '#${num}',
          fr: '#${num}',
          ja: '${num}番',
          cn: '#${num}',
          ko: '${num}번째',
          tc: '#${num}',
        },
        text: {
          en: '${num}: ${dir}',
        },
      },
    },
    {
      id: 'DMU P3 Damning Edict',
      type: 'StartsUsing',
      netRegex: { id: 'BB01', source: 'Chaos', capture: true },
      infoText: (_data, matches, output) => {
        return output.getBehindTarget!({ target: matches.source });
      },
      outputStrings: {
        getBehindTarget: {
          en: 'Get Behind ${target}',
          ko: '${target} 뒤로',
        },
      },
    },
    {
      id: 'DMU P3 In Line Debuff Collector',
      type: 'GainsEffect',
      netRegex: { effectId: ['BBC', 'BBD', 'BBE'] },
      run: (data, matches) => {
        const effectToNum: { [effectId: string]: number } = {
          BBC: 1,
          BBD: 2,
          BBE: 3,
        } as const;
        const num = effectToNum[matches.effectId];
        if (num === undefined)
          return;
        data.inLine[matches.target] = num;
      },
    },
    {
      id: 'DMU P3 Accretion Collector',
      // Will be applied to 1 DPS and 1 Healer
      // One will have First in Line, the other will have Second in Line
      type: 'GainsEffect',
      netRegex: { effectId: '644', capture: true },
      delaySeconds: (data) => {
        if (data.triggerSetConfig.accretion === 'line')
          return 0.1; // Delay for In Line debuffs
        return 0;
      },
      run: (data, matches) => {
        const target = matches.target;
        const first = data.triggerSetConfig.accretion === 'line'
          ? data.inLine[target] === 1
          : data.party.isHealer(target);
        if (first)
          data.firstAccretion = target;
        else
          data.secondAccretion = target;

        // Store for Black Hole Order
        if (data.me === target)
          data.hadAccretion = true;
      },
    },
    {
      id: 'DMU P3 In Line Debuff + Accretion 1',
      type: 'GainsEffect',
      netRegex: { effectId: ['BBC', 'BBD', 'BBE'], capture: false },
      delaySeconds: 0.2,
      durationSeconds: 5,
      suppressSeconds: 1,
      infoText: (data, _matches, output) => {
        const myNum = data.inLine[data.me];
        if (myNum === undefined)
          return;

        // Let healers know Accretion order
        // String may be too long to provide list of partners
        if (data.role === 'healer') {
          const first = data.firstAccretion;
          const second = data.secondAccretion;
          const player1 = first === data.me
            ? output.you!()
            : data.party.member(first);
          const player2 = second === data.me
            ? output.you!()
            : data.party.member(second);

          return output.accretionHealer!({
            num: myNum,
            player1: player1,
            player2: player2,
          });
        }

        // Rest of players will get partners
        const partners = [];
        for (const [name, num] of Object.entries(data.inLine))
          if (num === myNum && name !== data.me)
            partners.push(data.party.member(name));
        const msg = partners?.join(', ');

        return output.text!({ num: myNum, players: msg });
      },
      outputStrings: {
        you: {
          en: 'YOU',
        },
        text: {
          en: '${num} (with ${players})',
          de: '${num} (mit ${players})',
          fr: '${num} (avec ${players})',
          ja: '${num} (${players})',
          cn: '${num} (与${players})',
          ko: '${num} (+ ${players})',
          tc: '${num} (與${players})',
        },
        accretionHealer: {
          en: '${num}: Accretion on ${player1} => ${player2}',
        },
      },
    },
    {
      id: 'DMU P3 Accretion Cleanup',
      type: 'LosesEffect',
      netRegex: { effectId: '644', capture: true },
      run: (data, matches) => {
        const target = matches.target;
        if (target === data.firstAccretion)
          delete data.firstAccretion;
        // There is no one else it could be but second
        else
          delete data.secondAccretion;
      },
    },
    {
      id: 'DMU P3 Accretion 2',
      // Cleansing 644 Accretion or 154E Primordial Crust triggers BAFA Earthquake
      // on all but the player that had Accretion
      // BAFA Earthquake targets receive D2C Earth Resistance Down II (1.96s)
      // Utilizing D2C Earth Resistance Down II to call for healing next player
      // NOTE: This will still trigger if 154E Primordial Crust is cleansed early
      type: 'GainsEffect',
      netRegex: { effectId: 'D2C', capture: true },
      condition: (data) => {
        return data.firstAccretion !== undefined || data.secondAccretion !== undefined;
      },
      delaySeconds: (_data, matches) => parseFloat(matches.duration),
      suppressSeconds: 1,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = {
          healPlayerFull: {
            en: 'Heal ${player} to full',
            de: 'Heile ${player} voll',
            fr: 'Soin complet sur ${player}',
            ja: '${player} を全回復して',
            cn: '奶满${player}',
            ko: '완전 회복: ${player}',
            tc: '奶滿${player}',
          },
        };
        const first = data.firstAccretion;
        const second = data.secondAccretion;
        const player = first !== undefined
          ? first
          : second !== undefined
          ? second
          : undefined;

        // This happens if players get cleansed within the delaySeconds, likely causing a wipe
        if (player === undefined)
          return;

        const severity = data.role === 'healer' ? 'alertText' : 'infoText';

        return {
          [severity]: output.healPlayerFull!({
            player: data.party.member(player),
          }),
        };
      },
    },
    {
      id: 'DMU P3 Boss Teleport Collect',
      // For BAE6/BAE7 Slap Happy
      // Boss' position data is (100, 100), but heading does update ~2.5s before cast
      // 4 Invisible entities via 03 AddCombatant log lines correlate to the slap AoEs
      // spawn at time of StartsUsing. These are also ordered in the order they occur.
      //
      // For BAEC/BAED Look upon Me and Despair, boss also teleports
      // TODO: Get earlier infoText call
      // This could be necessary to call which black holes to grab later
      type: 'StartsUsing',
      netRegex: { id: ['BAE6', 'BAE7', 'BAEC', 'BAED'], source: 'Kefka', capture: true },
      run: (data, matches) => {
        const heading = parseFloat(matches.heading);
        data.kefkaTeleportDirNum = (Directions.hdgTo8DirNum(heading) + 4) % 8;
      },
    },
    {
      id: 'DMU P3 Slap Happy',
      // BAE6 Slap Happy: Boss slaps his right 3 times (party cleave) + left once
      // BAE7 Slap Happy: Boss slaps his left 3 times (role cleaves) + right once
      // Boss can be in different cardinal/intercardinals
      type: 'StartsUsing',
      netRegex: { id: ['BAE6', 'BAE7'], source: 'Kefka', capture: true },
      alertText: (_data, matches, output) => {
        const id = matches.id;
        const heading = parseFloat(matches.heading);
        // NOTE: Using heading, which is flipped, so CW/CCW are flipped here
        const bossDirNum = Directions.hdgTo8DirNum(heading);
        const clockDirNum = (bossDirNum + 6) % 8; // Wrap-around
        const counterDirNum = (bossDirNum + 2) % 8;
        const clockDir = Directions.output8Dir[clockDirNum] ?? 'unknown';
        const counterDir = Directions.output8Dir[counterDirNum] ?? 'unknown';

        const isRightSlap = id === 'BAE6';
        const dir = isRightSlap ? clockDir : counterDir;

        return output.slapDirMechThenOut!({
          dir1: output[dir]!(),
          mech: isRightSlap
            ? output.partyStack!()
            : output.roleStacks!(),
          out: output.outOfMiddle!(),
        });
      },
      outputStrings: {
        ...Directions.outputStrings8Dir,
        outOfMiddle: {
          en: 'Out Of Middle',
          de: 'Raus aus der Mitte',
          fr: 'Sortez du milieu',
          ja: '横へ',
          cn: '远离中间',
          ko: '가운데 피하기',
          tc: '遠離中間',
        },
        partyStack: {
          en: 'Party Stack',
          de: 'In der Gruppe sammeln',
          fr: 'Package en groupe',
          ja: 'あたまわり',
          cn: '人群分摊',
          ko: '본대 쉐어',
          tc: '分攤',
        },
        roleStacks: {
          en: 'Role Stacks',
          de: 'Rollengruppe sammeln',
          fr: 'Package par rôle',
          cn: '职能分摊',
          ko: '역할별 쉐어',
          tc: '職能分攤',
        },
        slapDirMechThenOut: {
          en: '${dir1} + ${mech} => ${out}',
        },
      },
    },
    {
      id: 'DMU P3 Black Hole Tracker',
      // 11 are added with 0.2s of BAFB Black Hole Ability
      // Both 261 CombatantMemory Add and 03 AddCombatant are available
      // There are also 272 NPCSpawnExtra lines
      // These have BNpcID 4C38
      // They should only spawn at cardinals
      // Interestingly, they have differing headings as well
      // Spawn Location Example:
      //             (100, 83)
      //    (94.83, 87.53)
      //     (93.64, 93.64) (106.36, 93.64)
      //                        (112.47, 94.83)
      //     (93.64, 106.36)(106.36, 106.36)
      // (87.53, 105.17)
      //                            (117, 100)
      //                (105.17, 112.47)
      //             (100, 117)
      type: 'AddedCombatant',
      netRegex: { name: 'Black Hole', capture: true },
      run: (data, matches) => {
        const x = parseFloat(matches.x);
        const y = parseFloat(matches.y);
        const dirNum = Directions.xyTo4DirNum(x, y, centerX, centerY);

        // Storing as dirNum to be sorted later once we have tethers
        data.blackHoleIdDirNums[matches.id] = dirNum;
      },
    },
    {
      id: 'DMU P3 Nothingness Counter',
      // There are 10 sets of Nothingness from Black Holes to soak
      // They always spawn on a cardinal
      // The Nothingness beams should be baited cw or ccw for melee uptime
      // Getting hit by Nothingness gives 154C Unbecoming
      // If hit by Nothingness with 154C Unbecoming, it becomes 154D Meanest Existence
      // If hit by Nothingness with 154D Meanest Existence, lethal damage is taken which
      // expires 154E Primordial Crust causing an BAFA Earthquake AOE
      //
      // Accretions Resolve => Slap Happy
      // Black Hole Set 1 spawns 1 Black Hole
      // 1 => 1 Nothingness (Taken by a 1)
      // Black Holes Set 2 spawns 2 Black Holes
      // 2 => 2 Nothingness (Taken by two 1s)
      // TBs => Damning Edict => Slap Happy
      // Black Hole Set 3 spawns 3 Black Holes
      // 3 => 3 Nothingness (Taken by two 1s and Accretion 1), 1 player swaps tether
      // 4 => 3 Nothingness (Taken by one 1, Accretion 1, and one 2), 1 player swaps tether
      // 5 => 3 Nothingness (Taken by two 2s and Accretion 1)
      // Damning Edict => Look upon Me and Despair => TBs
      // Black Hole Set 3 spawns 3 Black Holes
      // 6 => 3 Black Holes (Taken by two 2s and Accretion 2), 1 player swaps tether
      // 7 => 3 Black Holes (Taken by one 3, one 2, and Accretion 2), 1 player swaps tether
      // 8 => 3 Black Holes (Taken by two 3s, and Accretion 2)
      // Lat/Long (White Hole cast here too) => Slap Happy  => Look upon Me and Despair
      // Black Hole Set 5 spawns 2 Black Holes
      // 9 => 2 Black Holes (Taken by two 3s)
      // Black Hole Set 6 spawns 1 Black Hole
      // 10 => 1 Black Hole (Taken by last 3)
      // However, there are will be 10 BAFC Nothingness casts
      // Using BAFC Nothingness to track which set we are on
      type: 'Ability',
      netRegex: { id: 'BAFC', source: 'Black Hole', capture: false },
      suppressSeconds: 1,
      run: (data) => {
        data.nothingnessCount = data.nothingnessCount + 1;
        // Reset the tether dirs for next round
        data.blackHoleTetherDirNums = [];
      },
    },
    {
      id: 'DMU P3 Black Hole Tether Collect',
      type: 'Tether',
      netRegex: { capture: true },
      condition: (data, matches) => {
        if (matches.id === headMarkerData['exdeathTether'])
          return false;
        // No need to collect the single tether sets
        return data.phase === 'p3' &&
          (data.nothingnessCount !== 0 && data.nothingnessCount !== 9);
      },
      run: (data, matches) => {
        const dirNum = data.blackHoleIdDirNums[matches.sourceId];
        if (dirNum === undefined)
          return;

        // Ignore the tether if it is already stored
        // This allows for collection of tethers if instantaneous swap
        if (!data.blackHoleTetherDirNums.includes(dirNum))
          data.blackHoleTetherDirNums.push(dirNum);
      },
    },
    {
      id: 'DMU P3 Black Hole 1, Nothingness 1',
      // One Black Hole spawns, causes a single Nothingness
      type: 'Tether',
      netRegex: { capture: true },
      condition: (data, matches) => {
        if (matches.id === headMarkerData['exdeathTether'])
          return false;
        return data.phase === 'p3' && data.nothingnessCount === 0;
      },
      suppressSeconds: 99999,
      response: (data, matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = blackHoleOutputStrings;

        const config = data.triggerSetConfig.blackhole;
        const dirNum = data.blackHoleIdDirNums[matches.sourceId];
        const dir = dirNum === undefined
          ? 'unknown'
          : Directions.outputCardinalDir[dirNum] ?? 'unknown';

        if (
          config === 'kefka' && data.inLine[data.me] === 1 &&
          !data.hadAccretion && data.role === 'dps'
        )
          return {
            alertText: output.takeDirTetherClockwise!({
              num: data.nothingnessCount,
              dir: output[dir]!(),
            }),
          };
        return {
          infoText: output.oneBlackHole!({
            num: data.nothingnessCount,
            dir: output[dir]!(),
          }),
        };
      },
    },
    {
      id: 'DMU P3 Black Hole 2, Nothingness 1',
      // Two Black Holes spawn, each cause a single Nothingness
      type: 'Tether',
      netRegex: { capture: false },
      condition: (data) => {
        return data.phase === 'p3' && data.nothingnessCount === 1;
      },
      suppressSeconds: 99999,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = blackHoleOutputStrings;

        const config = data.triggerSetConfig.blackhole;
        const kefkaDir = data.kefkaTeleportDirNum;
        const dirNums = data.blackHoleTetherDirNums;

        // Convert Kefka dir to 4Dir
        const startDir = kefkaDir !== undefined
          ? Math.round(kefkaDir / 2) % 4
          : -1;
        const sorted = startDir !== -1 ? getCWOrderFromN(startDir, dirNums) : [];
        const dir1 = sorted[0] !== undefined
          ? Directions.outputCardinalDir[sorted[0]] ?? 'unknown'
          : 'unknown';
        const dir2 = sorted[1] !== undefined
          ? Directions.outputCardinalDir[sorted[1]] ?? 'unknown'
          : 'unknown';

        if (
          config === 'kefka' && data.inLine[data.me] === 1 &&
          !data.hadAccretion
        ) {
          if (data.role === 'dps')
            return {
              alertText: output.takeDirTetherClockwise!({
                num: data.nothingnessCount,
                dir: output[dir1]!(),
              }),
            };
          // Support #1
          return {
            alertText: output.takeDirTetherClockwise!({
              num: data.nothingnessCount,
              dir: output[dir2]!(),
            }),
          };
        }

        return {
          infoText: output.twoBlackHoles!({
            num: data.nothingnessCount,
            dir1: output[dir1]!(),
            dir2: output[dir2]!(),
          }),
        };
      },
    },
    {
      id: 'DMU P3 Black Hole 3, Nothingness 1',
      // Three Black Holes spawn, each cause three Nothingness
      type: 'Tether',
      netRegex: { capture: false },
      condition: (data) => {
        return data.phase === 'p3' && data.nothingnessCount === 2;
      },
      suppressSeconds: 99999,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = blackHoleOutputStrings;

        const config = data.triggerSetConfig.blackhole;
        const kefkaDir = data.kefkaTeleportDirNum;
        const dirNums = data.blackHoleTetherDirNums;

        // Convert Kefka dir to 4Dir
        const startDir = kefkaDir !== undefined
          ? Math.round(kefkaDir / 2) % 4
          : -1;
        const sorted = startDir !== -1 ? getCWOrderFromN(startDir, dirNums) : [];
        const dir1 = sorted[0] !== undefined
          ? Directions.outputCardinalDir[sorted[0]] ?? 'unknown'
          : 'unknown';
        const dir2 = sorted[1] !== undefined
          ? Directions.outputCardinalDir[sorted[1]] ?? 'unknown'
          : 'unknown';
        const dir3 = sorted[2] !== undefined
          ? Directions.outputCardinalDir[sorted[2]] ?? 'unknown'
          : 'unknown';

        if (config === 'kefka' && data.inLine[data.me] === 1) {
          if (data.hadAccretion)
            return {
              alertText: output.takeDirTetherClockwise!({
                num: data.nothingnessCount,
                dir: output[dir3]!(),
              }),
            };
          if (data.role === 'dps')
            return {
              alertText: output.takeDirTetherClockwise!({
                num: data.nothingnessCount,
                dir: output[dir1]!(),
              }),
            };
          // Support #1
          return {
            alertText: output.takeDirTetherClockwise!({
              num: data.nothingnessCount,
              dir: output[dir2]!(),
            }),
          };
        }

        return {
          infoText: output.threeBlackHoles!({
            num: data.nothingnessCount,
            dir1: output[dir1]!(),
            dir2: output[dir2]!(),
            dir3: output[dir3]!(),
          }),
        };
      },
    },
    {
      id: 'DMU P3 Black Hole 3, Nothingness 2',
      // One player needs to swap tether
      // TODO: Move the players with previous tethers to a trigger condition on hit?
      type: 'Ability',
      netRegex: { id: 'BAFC', source: 'Black Hole', capture: false },
      condition: (data) => {
        return data.phase === 'p3' && data.nothingnessCount === 3;
      },
      delaySeconds: 0.1, // Delay for tether collect
      suppressSeconds: 99999,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = blackHoleOutputStrings;

        const config = data.triggerSetConfig.blackhole;
        const hadAccretion = data.hadAccretion;
        const line = data.inLine[data.me];

        if (config === 'kefka') {
          if (line === 1) {
            if (hadAccretion || (data.role !== 'dps'))
              return { infoText: output.keepTether!() };
            // DPS #1
            return { alertText: output.passTether!() };
          }
          if (line === 2 && !hadAccretion && data.role === 'dps') {
            const kefkaDir = data.kefkaTeleportDirNum;
            const dirNums = data.blackHoleTetherDirNums;

            // Convert Kefka dir to 4Dir
            const startDir = kefkaDir !== undefined
              ? Math.round(kefkaDir / 2) % 4
              : -1;
            const sorted = startDir !== -1 ? getCWOrderFromN(startDir, dirNums) : [];
            const dir = sorted[0] !== undefined
              ? Directions.outputCardinalDir[sorted[0]] ?? 'unknown'
              : 'unknown';

            // We could get the player they are taking from, but seems unnecessary at the time
            return {
              alertText: output.takeDirTetherClockwise!({
                num: data.nothingnessCount,
                dir: output[dir]!(),
              }),
            };
          }
        }
      },
    },
    {
      id: 'DMU P3 Black Hole 3, Nothingness 3',
      // One player needs to swap tether
      // TODO: Move the players with previous tethers to a trigger condition on hit?
      type: 'Ability',
      netRegex: { id: 'BAFC', source: 'Black Hole', capture: false },
      condition: (data) => {
        return data.phase === 'p3' && data.nothingnessCount === 4;
      },
      delaySeconds: 0.1, // Delay for tether collect
      suppressSeconds: 99999,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = blackHoleOutputStrings;

        const config = data.triggerSetConfig.blackhole;
        const hadAccretion = data.hadAccretion;
        const line = data.inLine[data.me];

        if (config === 'kefka') {
          if (line === 1) {
            if (hadAccretion)
              return { infoText: output.keepTether!() };
            if (data.role !== 'dps')
              return { alertText: output.passTether!() };
          }
          if (line === 2 && !hadAccretion) {
            if (data.role !== 'dps') {
              const kefkaDir = data.kefkaTeleportDirNum;
              const dirNums = data.blackHoleTetherDirNums;

              // Convert Kefka dir to 4Dir
              const startDir = kefkaDir !== undefined
                ? Math.round(kefkaDir / 2) % 4
                : -1;
              const sorted = startDir !== -1 ? getCWOrderFromN(startDir, dirNums) : [];
              const dir = sorted[1] !== undefined
                ? Directions.outputCardinalDir[sorted[1]] ?? 'unknown'
                : 'unknown';

              // We could get the player they are taking from, but seems unnecessary at the time
              return {
                alertText: output.takeDirTetherClockwise!({
                  num: data.nothingnessCount,
                  dir: output[dir]!(),
                }),
              };
            }
            // DPS #2
            return { infoText: output.keepTether!() };
          }
        }
      },
    },
    {
      id: 'DMU P3 Black Hole 4, Nothingness 1',
      // Three Black Holes spawn, each cause three Nothingness
      type: 'Tether',
      netRegex: { capture: false },
      condition: (data) => {
        return data.phase === 'p3' && data.nothingnessCount === 5;
      },
      delaySeconds: 0.1, // Delay for tether collect
      suppressSeconds: 99999,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = blackHoleOutputStrings;

        const config = data.triggerSetConfig.blackhole;
        const kefkaDir = data.kefkaTeleportDirNum;
        const dirNums = data.blackHoleTetherDirNums;

        // Convert Kefka dir to 4Dir
        const startDir = kefkaDir !== undefined
          ? Math.round(kefkaDir / 2) % 4
          : -1;
        const sorted = startDir !== -1 ? getCWOrderFromN(startDir, dirNums) : [];
        const dir1 = sorted[0] !== undefined
          ? Directions.outputCardinalDir[sorted[0]] ?? 'unknown'
          : 'unknown';
        const dir2 = sorted[1] !== undefined
          ? Directions.outputCardinalDir[sorted[1]] ?? 'unknown'
          : 'unknown';
        const dir3 = sorted[2] !== undefined
          ? Directions.outputCardinalDir[sorted[2]] ?? 'unknown'
          : 'unknown';

        if (config === 'kefka' && data.inLine[data.me] === 2) {
          if (data.hadAccretion)
            return {
              alertText: output.takeDirTetherClockwise!({
                num: data.nothingnessCount,
                dir: output[dir3]!(),
              }),
            };
          if (data.role === 'dps')
            return {
              alertText: output.takeDirTetherClockwise!({
                num: data.nothingnessCount,
                dir: output[dir1]!(),
              }),
            };
          // Support #2
          return {
            alertText: output.takeDirTetherClockwise!({
              num: data.nothingnessCount,
              dir: output[dir2]!(),
            }),
          };
        }

        return {
          infoText: output.threeBlackHoles!({
            num: data.nothingnessCount,
            dir1: output[dir1]!(),
            dir2: output[dir2]!(),
            dir3: output[dir3]!(),
          }),
        };
      },
    },
    {
      id: 'DMU P3 Black Hole 4, Nothingness 2',
      // One player needs to swap tether
      // TODO: Move the players with previous tethers to a trigger condition on hit?
      type: 'Ability',
      netRegex: { id: 'BAFC', source: 'Black Hole', capture: false },
      condition: (data) => {
        return data.phase === 'p3' && data.nothingnessCount === 6;
      },
      delaySeconds: 0.1, // Delay for tether collect
      suppressSeconds: 99999,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = blackHoleOutputStrings;

        const config = data.triggerSetConfig.blackhole;
        const line = data.inLine[data.me];

        if (config === 'kefka') {
          if (line === 2) {
            if (data.hadAccretion || data.role !== 'dps')
              return { infoText: output.keepTether!() };
            // DPS #2
            return { alertText: output.passTether!() };
          }
          if (line === 3 && data.role === 'dps') {
            const kefkaDir = data.kefkaTeleportDirNum;
            const dirNums = data.blackHoleTetherDirNums;

            // Convert Kefka dir to 4Dir
            const startDir = kefkaDir !== undefined
              ? Math.round(kefkaDir / 2) % 4
              : -1;
            const sorted = startDir !== -1 ? getCWOrderFromN(startDir, dirNums) : [];
            const dir = sorted[0] !== undefined
              ? Directions.outputCardinalDir[sorted[0]] ?? 'unknown'
              : 'unknown';

            // We could get the player they are taking from, but seems unnecessary at the time
            return {
              alertText: output.takeDirTetherClockwise!({
                num: data.nothingnessCount,
                dir: output[dir]!(),
              }),
            };
          }
        }
      },
    },
    {
      id: 'DMU P3 Black Hole 4, Nothingness 3',
      // One player needs to swap tether
      // TODO: Move the players with previous tethers to a trigger condition on hit?
      type: 'Ability',
      netRegex: { id: 'BAFC', source: 'Black Hole', capture: false },
      condition: (data) => {
        return data.phase === 'p3' && data.nothingnessCount === 7;
      },
      delaySeconds: 0.1, // Delay for tether collect
      suppressSeconds: 99999,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = blackHoleOutputStrings;

        const config = data.triggerSetConfig.blackhole;
        const line = data.inLine[data.me];

        if (config === 'kefka') {
          if (line === 2) {
            if (data.hadAccretion)
              return { infoText: output.keepTether!() };
            if (data.role !== 'dps')
              return { alertText: output.passTether!() };
          }
          if (line === 3) {
            if (data.role === 'dps')
              return { infoText: output.keepTether!() };
            // Support #3
            const kefkaDir = data.kefkaTeleportDirNum;
            const dirNums = data.blackHoleTetherDirNums;

            // Convert Kefka dir to 4Dir
            const startDir = kefkaDir !== undefined
              ? Math.round(kefkaDir / 2) % 4
              : -1;
            const sorted = startDir !== -1 ? getCWOrderFromN(startDir, dirNums) : [];
            const dir = sorted[1] !== undefined
              ? Directions.outputCardinalDir[sorted[1]] ?? 'unknown'
              : 'unknown';

            // We could get the player they are taking from, but seems unnecessary at the time
            return {
              alertText: output.takeDirTetherClockwise!({
                num: data.nothingnessCount,
                dir: output[dir]!(),
              }),
            };
          }
        }
      },
    },
    {
      id: 'DMU P3 Black Hole 5, Nothingness 1',
      // Two Black Holes spawn, each cause a single Nothingness
      type: 'Tether',
      netRegex: { capture: false },
      condition: (data) => {
        return data.phase === 'p3' && data.nothingnessCount === 8;
      },
      delaySeconds: 0.1, // Delay for tether collect
      suppressSeconds: 99999,
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = blackHoleOutputStrings;

        const config = data.triggerSetConfig.blackhole;
        const kefkaDir = data.kefkaTeleportDirNum;
        const dirNums = data.blackHoleTetherDirNums;

        // Convert Kefka dir to 4Dir
        const startDir = kefkaDir !== undefined
          ? Math.round(kefkaDir / 2) % 4
          : -1;
        const sorted = startDir !== -1 ? getCWOrderFromN(startDir, dirNums) : [];
        const dir1 = sorted[0] !== undefined
          ? Directions.outputCardinalDir[sorted[0]] ?? 'unknown'
          : 'unknown';
        const dir2 = sorted[1] !== undefined
          ? Directions.outputCardinalDir[sorted[1]] ?? 'unknown'
          : 'unknown';

        if (config === 'kefka' && data.inLine[data.me] === 3) {
          if (data.role === 'dps')
            return {
              alertText: output.takeDirTetherClockwise!({
                num: data.nothingnessCount,
                dir: output[dir1]!(),
              }),
            };
          // Support #3
          return {
            alertText: output.takeDirTetherClockwise!({
              num: data.nothingnessCount,
              dir: output[dir2]!(),
            }),
          };
        }

        return {
          infoText: output.twoBlackHoles!({
            num: data.nothingnessCount,
            dir1: output[dir1]!(),
            dir2: output[dir2]!(),
          }),
        };
      },
    },
    {
      id: 'DMU P3 Black Hole 6, Nothingness 1',
      // One Black Hole spawns, causes a single Nothingness
      type: 'Tether',
      netRegex: { capture: true },
      condition: (data) => {
        return data.phase === 'p3' && data.nothingnessCount === 9;
      },
      suppressSeconds: 99999,
      response: (data, matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = blackHoleOutputStrings;

        const config = data.triggerSetConfig.blackhole;
        const dirNum = data.blackHoleIdDirNums[matches.sourceId];
        const dir = dirNum === undefined
          ? 'unknown'
          : Directions.outputCardinalDir[dirNum] ?? 'unknown';

        if (
          config === 'kefka' && data.inLine[data.me] === 3 &&
          data.role !== 'dps'
        )
          return {
            alertText: output.takeDirTetherClockwise!({
              num: data.nothingnessCount,
              dir: output[dir]!(),
            }),
          };
        return {
          infoText: output.oneBlackHole!({
            num: data.nothingnessCount,
            dir: output[dir]!(),
          }),
        };
      },
    },
    {
      id: 'DMU P3 Blizzard III Puddles',
      // TODO: Get which role is doing stack + player, and which role is doing towers
      type: 'StartsUsing',
      netRegex: { id: 'BB0F', source: 'Exdeath', capture: false },
      infoText: (_data, _matches, output) => {
        return output.puddlesThenMech!({
          bait: output.baitPuddles!(),
          mech1: output.roleStack!(),
          mech2: output.getTowers!(),
        });
      },
      outputStrings: {
        roleStack: {
          en: 'Role Stack',
        },
        getTowers: Outputs.getTowers,
        puddlesThenMech: {
          en: '${bait} => ${mech1}/${mech2}',
        },
        baitPuddles: {
          en: 'Bait Puddles x2',
        },
      },
    },
    {
      id: 'DMU P3 Stomp-a-Mole Direction',
      // In order to avoid 3s D98 Deep Freeze
      type: 'StartsUsing',
      netRegex: { id: 'BAEF', source: 'Kefka', capture: true },
      durationSeconds: (_data, matches) => parseFloat(matches.castTime) + 5.6, // Time until last Tower
      infoText: (_data, matches, output) => {
        const heading = parseFloat(matches.heading);
        const dirNum = (Directions.hdgTo8DirNum(heading) + 4) % 8;
        return output.text!({ dir: output[dirNum]!() });
      },
      outputStrings: {
        ...Directions.outputStrings8Dir,
        text: {
          en: '${dir} Kefka',
        },
      },
    },
    {
      id: 'DMU P3 Blizzard III Keep Moving',
      // In order to avoid 3s D98 Deep Freeze
      // Players also need to avoid BB05 Big Bang at this time as well
      // BB05 Big Bang goes off at the stack locations
      type: 'StartsUsing',
      netRegex: { id: 'BB11', source: 'Exdeath', capture: true },
      durationSeconds: (_data, matches) => parseFloat(matches.castTime),
      infoText: (_data, _matches, output) => output.keepMoving!(),
      outputStrings: {
        keepMoving: Outputs.moveAround,
      },
    },
  ],
  timelineReplace: [
    {
      'locale': 'en',
      'replaceText': {
        'Future\'s End/Past\'s End': 'Future/Past\'s End',
        'Spelldriver/Spellscatter/Spellwave': 'Spelldriver/scatter/wave',
        'Longitudinal Implosion/Latitudinal Implosion': 'Long/Lat Implosion',
      },
    },
    {
      'locale': 'de',
      'missingTranslations': true,
      'replaceSync': {
        'Black Hole': 'schwarz(?:e|er|es|en) Loch',
        'Chaos': 'Chaos',
        '(?<! )Exdeath': 'Exdeath',
        'Graven Image': 'heilig(?:e|er|es|en) Statue',
        'Kefka': 'Kefka',
        'Neo Exdeath': 'Neo Exdeath',
      },
      'replaceText': {
        'Aero III Assault': 'Wallendes Windga',
        'Aetherlink': 'Ätherbund',
        'All Things Ending': 'Ende aller Dinge',
        'Ave Maria': 'Ave Maria',
        'Big Bang': 'Quantengravitation',
        'Black Antilight': 'Dunkellicht des Toten',
        'Black Hole': 'Schwarzes Loch',
        'Black Spark': 'Schwarzer Funke',
        'Blizzard III(?! Blowout)': 'Eisga',
        'Blizzard III Blowout': 'Expandierendes Eisga',
        'Bowels of Agony': 'Quälende Eingeweide',
        'Catastrophic Choice': 'Katastrophenwahl',
        'Celestriad': 'Dreigestirn',
        'Chaotic Flare': 'Chaotische Flare',
        'Chaotic Flood': 'Chaotische Flut',
        'Chaotic Holy': 'Chaotisches Sanctus',
        'Cyclone': 'Tornado',
        'Damning Edict': 'Verdammendes Edikt',
        'Death Bolt': 'Todeskeil',
        'Death Bomb': 'Todesbombe',
        'Death Shriek': 'Todesschrei',
        'Death Surge': 'Todeswallung',
        'Death Wave': 'Todeswelle',
        'Definition of Insanity': 'Rekonstruktion',
        'Double-Trouble Trap': 'Fiese Falle',
        '(?<! )Earthquake': 'Erdbeben',
        'Edge of Death': 'Abgrund des Todes',
        'Explosion': 'Explosion',
        'Fell Forces': 'Magieangriff',
        '(?<! )Fire III': 'Feuga',
        'Flagrant Fire III': 'Flammendes Feuga',
        '(?<! )Flare(?! )': 'Flare',
        'Flare Diffusion': 'Flare-Diffusion',
        '(?<! )Flood(?! )': 'Flut',
        'Flood of Naught': 'Flut der Leere',
        'Forsaken(?! [BGN])': 'Verloren',
        'Forsaken Bonds': 'Verlorene Bunde',
        'Forsaken Ground': 'Verlorener Boden',
        'Forsaken Null': 'Verlorenes Sein',
        'Future\'s End': 'Ende der Zukunft',
        'Grand Cross': 'Supernova',
        'Graven Image': 'Göttliche Statue',
        'Gravitas': 'Gravitas',
        'Gravitational Wave': 'Gravitationswelle',
        'Gravity III': 'Graviga',
        '(?<! )Holy': 'Sanctus',
        'Hyperdrive': 'Hyperantrieb',
        'Idyllic Will': 'Idyllischer Wille',
        'Indolent Will': 'Träger Wille',
        'Indulgent Will': 'Nachsichtiger Wille',
        'Inferno': 'Flamme',
        'Intemperate Will': 'Unmäßiger Wille',
        'Kefka Says': 'Schelmische Seele',
        'Knock Down': 'Einschlag',
        'Latitudinal Implosion': 'Horizontale Implosion',
        'Light of Judgment': 'Licht des Urteils',
        'Longitudinal Implosion': 'Vertikale Implosion',
        'Look upon Me and Despair': 'Voller Körpereinsatz',
        'Maddening Orchestra': 'Symphonie des Wahns',
        'Mana Charge': 'Mana-Aufladung',
        'Mana Release': 'Mana-Entladung',
        'Max': 'Riese',
        'Meteor': 'Meteo',
        'Mystery Magic': 'Mysteriöse Magie',
        'Nothingness': 'Welle der Leere',
        'Past\'s End': 'Ende der Vergangenheit',
        'Pulse Wave': 'Pulswelle',
        '(?<![ h])Quake': 'Beben',
        'Revolting Ruin III': 'Revoltierendes Ruinga',
        'Shocking Impact': 'Heftiger Impakt',
        'Shockwave': 'Schockwelle',
        'Slap Happy': 'Kolossale Klatsche',
        'Spelldriver': 'Risikofaktor: Antrieb',
        'Spellscatter': 'Risikofaktor: Streuung',
        'Spellwave': 'Risikofaktor: Welle',
        'Stomp-a-Mole': 'Schallender Stampfer',
        'Stray Apocalypse': 'Chaosende',
        'Stray Entropy': 'Chaoswirbel',
        'Stray Flames': 'Chaosflammen',
        'Stray Spray': 'Chaosspritzer',
        'Tele-trouncing': 'Tückischer Teleport',
        'The Decisive Battle': 'Entscheidungsschlacht',
        'The Path of Light': 'Pfad des Lichts',
        'Thrumming Thunder III': 'Brachiales Blitzga',
        '(?<! )Thunder III': 'Blitzga',
        'Tornado': 'Tornado',
        'Trance': 'Trance',
        'Trine': 'Trine',
        'Tsunami': 'Tsunami',
        'Ultima Blaster': 'Ultima-Kanone',
        'Ultima Repeater': 'Multi-Ultima',
        'Ultima Upsurge': 'Ultima-Wallung',
        'Ultimate Embrace': 'Ultima-Umarmung',
        'Umbra Smash': 'Schattenschlag',
        'Vacuum Wave': 'Vakuumwelle',
        'Vitrophyre': 'Vitrophyr',
        'Wave Cannon': 'Wellenkanone',
        'White Antilight': 'Dunkellicht des Lebenden',
        'White Hole': 'Weißes Loch',
        'Wings of Destruction': 'Vernichtungsschwinge',
      },
    },
    {
      'locale': 'fr',
      'missingTranslations': true,
      'replaceSync': {
        'Black Hole': 'trou noir',
        'Chaos': 'Chaos',
        '(?<! )Exdeath': 'Exdeath',
        'Graven Image': 'statue divine',
        'Kefka': 'Kefka',
        'Neo Exdeath': 'Néo-Exdeath',
      },
      'replaceText': {
        'Aero III Assault': 'Méga Vent véhément',
        'Aetherlink': 'Lien éthéré',
        'All Things Ending': 'Fin de toutes choses',
        'Ave Maria': 'Ave Maria',
        'Big Bang': 'Saillie',
        'Black Antilight': 'Lumière sombre du défunt',
        'Black Hole': 'Trou noir',
        'Black Spark': 'Étincelle noire',
        'Blizzard III(?! Blowout)': 'Méga Glace',
        'Blizzard III Blowout': 'Méga Glace propagatrice',
        'Bowels of Agony': 'Entrailles de l\'agonie',
        'Catastrophic Choice': 'Catastrophe double',
        'Celestriad': 'Tristella',
        'Chaotic Flare': 'Brasier chaotique',
        'Chaotic Flood': 'Déluge chaotique',
        'Chaotic Holy': 'Miracle chaotique',
        'Cyclone': 'Tornade',
        'Damning Edict': 'Décret accablant',
        'Death Bolt': 'Éclair fatal',
        'Death Bomb': 'Bombe fatale',
        'Death Shriek': 'Hurlement fatal',
        'Death Surge': 'Poussée fatale',
        'Death Wave': 'Vague fatale',
        'Definition of Insanity': 'Reconstruction',
        'Double-Trouble Trap': 'Pièges successifs',
        '(?<! )Earthquake': 'Séisme',
        'Edge of Death': 'Lisière de la mort',
        'Explosion': 'Explosion',
        'Fell Forces': 'Frappe maléfique',
        '(?<! )Fire III': 'Méga Feu',
        'Flagrant Fire III': 'Méga Feu faufilant',
        '(?<! )Flare(?! )': 'Brasier',
        'Flare Diffusion': 'Brasier diffuseur',
        '(?<! )Flood(?! )': 'Déluge',
        'Flood of Naught': 'Crue du néant',
        'Forsaken(?! [BGN])': 'Cataclysme',
        'Forsaken Bonds': 'Cataclysme lié',
        'Forsaken Ground': 'Cataclysme tellurique',
        'Forsaken Null': 'Cataclysme initial',
        'Future\'s End': 'Fin du futur',
        'Grand Cross': 'Croix suprême',
        'Graven Image': 'Statue divine',
        'Gravitas': 'Tir gravitationnel',
        'Gravitational Wave': 'Onde gravitationnelle',
        'Gravity III': 'Méga Gravité',
        '(?<! )Holy': 'Miracle',
        'Hyperdrive': 'Colonne de feu',
        'Idyllic Will': 'Volonté idyllique',
        'Indolent Will': 'Volonté indolente',
        'Indulgent Will': 'Volonté indulgente',
        'Inferno': 'Flammes',
        'Intemperate Will': 'Volonté intempérante',
        'Kefka Says': 'Âmes facétieuses',
        'Knock Down': 'Impact de canon',
        'Latitudinal Implosion': 'Implosion horizontale',
        'Light of Judgment': 'Triade guerrière',
        'Longitudinal Implosion': 'Implosion verticale',
        'Look upon Me and Despair': 'Moi, au naturel',
        'Maddening Orchestra': 'Symphonie de la démence',
        'Mana Charge': 'Concentration de mana',
        'Mana Release': 'Décharge de mana',
        'Max': 'Maxi',
        'Meteor': 'Météore',
        'Mystery Magic': 'Magie énigmatique',
        'Nothingness': 'Rayon du néant',
        'Past\'s End': 'Fin du passé',
        'Primordial Crust Quake': '',
        'Pulse Wave': 'Pulsation spirituelle',
        '(?<![ h])Quake': 'Séisme',
        'Revolting Ruin III': 'Méga Ruine ravageuse',
        'Shocking Impact': 'Impact puissant',
        'Shockwave': 'Onde de choc',
        'Slap Happy': 'Gifle cinglante',
        'Spelldriver': 'Péril magique chargé',
        'Spellscatter': 'Peril magique dispersé',
        'Spellwave': 'Peril magique ondulé',
        'Stomp-a-Mole': 'Piétinement frénétique',
        'Stray Apocalypse': 'Crépuscule chaotique',
        'Stray Entropy': 'Tourbillon chaotique',
        'Stray Flames': 'Flammes du chaos',
        'Stray Spray': 'Eaux du chaos',
        'Tele-trouncing': 'Téléportation perfide',
        'The Decisive Battle': 'Combat décisif',
        'The Path of Light': 'Voie de Lumière',
        'Thrumming Thunder III': 'Méga Foudre fourmillante',
        '(?<! )Thunder III': 'Méga Foudre',
        'Tornado': 'Tornade',
        'Trance': 'Transe',
        'Trine': 'Trine',
        'Tsunami': 'Raz-de-marée',
        'Ultima Blaster': 'Ultima fulgurante',
        'Ultima Repeater': 'Ultima en pagaille',
        'Ultima Upsurge': 'Ultima ulcérante',
        'Ultimate Embrace': 'Étreinte fatidique',
        'Umbra Smash': 'Fracas ombral',
        'Vacuum Wave': 'Vague de vide',
        'Vitrophyre': 'Vitrophyre',
        'Wave Cannon': 'Canon plasma',
        'White Antilight': 'Lumière sombre du vivant',
        'White Hole': 'Trou blanc',
        'Wings of Destruction': 'Aile de la destruction',
      },
    },
    {
      'locale': 'ja',
      'missingTranslations': true,
      'replaceSync': {
        'Black Hole': 'ブラックホール',
        'Chaos': 'カオス',
        '(?<! )Exdeath': 'エクスデス',
        'Graven Image': '神々の像',
        'Kefka': 'ケフカ',
        'Neo Exdeath': 'ネオエクスデス',
      },
      'replaceText': {
        'Aero III Assault': 'ずんずんエアロガ',
        'Aetherlink': 'エーテルリンク',
        'All Things Ending': '消滅の脚',
        'Ave Maria': 'アヴェ・マリア',
        'Big Bang': '突出',
        'Black Antilight': '死者の暗黒光',
        'Black Hole': 'ブラックホール',
        'Black Spark': 'ブラックスパーク',
        'Blizzard III(?! Blowout)': 'ブリザガ',
        'Blizzard III Blowout': 'ひろげるブリザガ',
        'Bowels of Agony': 'バウル・オブ・アゴニー',
        'Catastrophic Choice': '二択のカタストロフ',
        'Celestriad': 'スリースターズ',
        'Chaotic Flare': 'カオティックフレア',
        'Chaotic Flood': 'カオティックフラッド',
        'Chaotic Holy': 'カオティックホーリー',
        'Cyclone': 'たつまき',
        'Damning Edict': 'ダミングイーディクト',
        'Death Bolt': 'デスボルト',
        'Death Bomb': 'デスボム',
        'Death Shriek': 'デスシュリーク',
        'Death Surge': 'デスサージ',
        'Death Wave': 'デスウェーブ',
        'Definition of Insanity': '再構築',
        'Double-Trouble Trap': 'つぎつぎトラップ',
        '(?<! )Earthquake': 'じしん',
        'Edge of Death': '生死の境界',
        'Explosion': '爆発',
        'Fell Forces': '魔撃',
        '(?<! )Fire III': 'ファイガ',
        'Flagrant Fire III': 'めらめらファイガ',
        '(?<! )Flare(?! )': 'フレア',
        'Flare Diffusion': 'フレアディフュージョン',
        '(?<! )Flood(?! )': 'フラッド',
        'Flood of Naught': '無の氾濫',
        'Forsaken(?! [BGN])': 'ミッシング',
        'Forsaken Bonds': 'ミッシング・ボンド',
        'Forsaken Ground': 'ミッシング・グラウンド',
        'Forsaken Null': 'ミッシング・ゼロ',
        'Future\'s End': '未来の終焉',
        'Grand Cross': 'グランドクロス',
        'Graven Image': '神々の像',
        'Gravitas': '重力弾',
        'Gravitational Wave': '重力波',
        'Gravity III': 'グラビガ',
        '(?<! )Holy': 'ホーリー',
        'Hyperdrive': 'ハイパードライブ',
        'Idyllic Will': '睡魔の神気',
        'Indolent Will': '惰眠の神気',
        'Indulgent Will': '聖母の神気',
        'Inferno': 'ほのお',
        'Intemperate Will': '撲殺の神気',
        'Kefka Says': 'おちょくりソウル',
        'Knock Down': '着弾',
        'Latitudinal Implosion': 'ホリゾンタルインプロージョン',
        'Light of Judgment': '裁きの光',
        'Longitudinal Implosion': 'ヴァーティカルインプロージョン',
        'Look upon Me and Despair': 'ありのままのボクチン',
        'Maddening Orchestra': '狂気のオーケストラ',
        'Mana Charge': 'マジックチャージ',
        'Mana Release': 'マジックアウト',
        'Max': 'マキシマム',
        'Meteor': 'メテオ',
        'Mystery Magic': 'なぞなぞマジック',
        'Nothingness': '無の波動',
        'Past\'s End': '過去の終焉',
        'Pulse Wave': '波動弾',
        '(?<![ h])Quake': 'クエイク',
        'Revolting Ruin III': 'ばりばりルインガ',
        'Shocking Impact': '重衝撃',
        'Shockwave': '衝撃波',
        'Slap Happy': 'びんびんビンタ',
        'Spelldriver': 'スペルハザード・ドライブ',
        'Spellscatter': 'スペルハザード・スキャッター',
        'Spellwave': 'スペルハザード・ウェーブ',
        'Stomp-a-Mole': 'どんどこ地団駄',
        'Stray Apocalypse': '混沌の終末',
        'Stray Entropy': '混沌の渦',
        'Stray Flames': '混沌の炎',
        'Stray Spray': '混沌の水',
        'Tele-trouncing': 'ずびずばテレポ',
        'The Decisive Battle': '決戦',
        'The Path of Light': '光の波動',
        'Thrumming Thunder III': 'もりもりサンダガ',
        '(?<! )Thunder III': 'サンダガ',
        'Tornado': 'トルネド',
        'Trance': 'トランス',
        'Trine': 'トライン',
        'Tsunami': 'つなみ',
        'Ultima Blaster': 'アルテマブラスター',
        'Ultima Repeater': '連続アルテマ',
        'Ultima Upsurge': 'どきどきアルテマ',
        'Ultimate Embrace': '終末の双腕',
        'Umbra Smash': 'アンブラスマッシュ',
        'Vacuum Wave': '真空波',
        'Vitrophyre': '岩石弾',
        'Wave Cannon': '波動砲',
        'White Antilight': '生者の暗黒光',
        'White Hole': 'ホワイトホール',
        'Wings of Destruction': '破壊の翼',
      },
    },
    {
      'locale': 'cn',
      'missingTranslations': true,
      'replaceSync': {
        'Black Hole': '黑洞',
        'Chaos': '卡奥斯',
        '(?<! )Exdeath': '艾克斯迪司',
        'Graven Image': '众神之像',
        'Kefka': '凯夫卡',
        'Neo Exdeath': '新生艾克斯迪司',
      },
      'replaceText': {
        'Aero III Assault': '疼飕飕暴风',
        'All Things Ending': '消灭之脚',
        'Ave Maria': '圣母颂',
        'Big Bang': '顶起',
        'Black Antilight': '死者暗黑光',
        'Black Hole': '黑洞',
        'Black Spark': '暗黑火花',
        'Blizzard III(?! Blowout)': '冰封',
        'Blizzard III Blowout': '扩大大冰封',
        'Bowels of Agony': '深层痛楚',
        'Celestriad': '三星',
        'Damning Edict': '诅咒敕令',
        'Death Bolt': '死亡落雷',
        'Death Bomb': '死亡爆弹',
        'Death Shriek': '死亡尖叫',
        'Death Surge': '死亡波涛',
        'Death Wave': '死亡波纹',
        'Double-Trouble Trap': '连环环陷阱',
        '(?<! )Earthquake': '地震',
        'Edge of Death': '生死之境',
        'Explosion': '爆炸',
        'Fell Forces': '魔击',
        '(?<! )Fire III': '爆炎',
        'Flagrant Fire III': '呼啦啦爆炎',
        '(?<! )Flare(?! )': '核爆',
        '(?<! )Flood(?! )': '洪水',
        'Flood of Naught': '无之泛滥',
        'Forsaken(?! [BGN])': '遗弃末世',
        'Future\'s End': '未来终结',
        'Grand Cross': '大十字',
        'Graven Image': '众神之像',
        'Gravitas': '重力弹',
        'Gravitational Wave': '重力波',
        'Gravity III': '强重力',
        '(?<! )Holy': '神圣',
        'Hyperdrive': '超驱动',
        'Idyllic Will': '睡魔的神气',
        'Indolent Will': '懒惰的神气',
        'Indulgent Will': '圣母的神气',
        'Intemperate Will': '扑杀的神气',
        'Knock Down': '轰击',
        'Latitudinal Implosion': '纬度聚爆',
        'Light of Judgment': '制裁之光',
        'Longitudinal Implosion': '经度聚爆',
        'Mana Charge': '魔法储存',
        'Mana Release': '魔法放出',
        'Max': '放大',
        'Meteor': '陨石',
        'Mystery Magic': '玄乎乎魔法',
        'Nothingness': '无之波动',
        'Past\'s End': '过去终结',
        'Pulse Wave': '波动弹',
        '(?<![ h])Quake': '地震',
        'Revolting Ruin III': '恶狠狠毁荡',
        'Shockwave': '冲击波',
        'Spelldriver': '咏唱危机·驱动',
        'Spellscatter': '咏唱危机·散碎',
        'Spellwave': '咏唱危机·波动',
        'Stray Flames': '混沌之炎',
        'Stray Spray': '混沌之水',
        'Tele-trouncing': '唰啦啦传送',
        'The Decisive Battle': '决战',
        'The Path of Light': '光之波动',
        'Thrumming Thunder III': '劈啪啪暴雷',
        '(?<! )Thunder III': '暴雷',
        'Tornado': '龙卷',
        'Trine': '异三角',
        'Ultima Upsurge': '扑腾腾究极',
        'Ultimate Embrace': '终末双腕',
        'Umbra Smash': '本影爆碎',
        'Vacuum Wave': '真空波',
        'Vitrophyre': '岩石弹',
        'Wave Cannon': '波动炮',
        'White Antilight': '生者暗黑光',
        'White Hole': '白洞',
        'Wings of Destruction': '破坏之翼',
      },
    },
    {
      'locale': 'ko',
      'missingTranslations': true,
      'replaceSync': {
        'Black Hole': '블랙홀',
        'Chaos': '카오스',
        '(?<! )Exdeath': '엑스데스',
        'Graven Image': '신들의 상',
        'Kefka': '케프카',
        'Neo Exdeath': '네오 엑스데스',
      },
      'replaceText': {
        '\\(Pop Window\\)': '(활성화)',
        '\\(castbar\\)': '(시전바)',
        '\\(Chaos': '(카오스',
        '\\(Exdeath': '(엑스데스',
        '--numbers--': '--숫자--',
        '--accretion\\?--': '--혼돈의 진흙?--',
        '--untargetable\\?--': '--타겟 불가능?--',
        '--middle\\?--': '--중앙?--',
        '--Chaos untargetable\\?--': '--카오스 타겟 불가능?--',
        '--Exdeath untargetable\\?--': '--엑스데스 타겟 불가능?--',
        'Accretion Earthquake': '혼돈의 진흙 지진',
        'Aero III Assault': '갈기갈기 에어로가',
        'Aetherlink': '에테르 연결',
        'All Things Ending': '소멸의 발차기',
        'Ave Maria': '아베 마리아',
        'Big Bang': '돌출',
        'Black Antilight': '죽은 자의 암흑광',
        'Black Hole': '블랙홀',
        'Black Spark': '검은 불꽃',
        'Blackblood': '흑혈',
        'Blizzard III(?! Blowout)': '블리자가',
        'Blizzard III Blowout': '널리널리 블리자가',
        'Bowels of Agony': '고통의 심핵',
        'Catastrophic Choice': '두 가지 선택의 참사',
        'Celestriad': '세 개의 별',
        'Chaotic Flare': '혼돈의 플레어',
        'Chaotic Flood': '혼돈의 홍수',
        'Chaotic Holy': '혼돈의 홀리',
        'Cyclone': '회오리',
        'Damning Edict': '파멸 포고',
        'Death Bolt': '죽음의 번개',
        'Death Bomb': '죽음의 폭탄',
        'Death Shriek': '죽음의 비명',
        'Death Surge': '죽음의 격동',
        'Death Wave': '죽음의 파도',
        'Definition of Insanity': '재구성',
        'Double-Trouble Trap': '줄줄이 함정',
        'Down for the Count': '행동 불가',
        '(?<! )Earthquake': '지진',
        'Edge of Death': '생사의 갈림길',
        'Explosion': '폭발',
        'Fell Forces': '마격',
        '(?<! )Fire III': '파이가',
        'Flagrant Fire III': '이글이글 파이가',
        '(?<! )Flare(?! )': '플레어',
        'Flare Diffusion': '확산 플레어',
        '(?<! )Flood(?! )': '플러드',
        'Flood of Naught': '무의 범람',
        'Forsaken(?! [BGN])': '행방불명',
        'Forsaken Bonds': '행방불명: 유대',
        'Forsaken Ground': '행방불명: 지면',
        'Forsaken Null': '행방불명: 소실',
        'Future\'s End/Past\'s End': '과거/미래의 종언',
        'Grand Cross': '그랜드크로스',
        'Graven Image': '신들의 상',
        'Gravitas': '중력탄',
        'Gravitational Wave': '중력파',
        'Gravity III': '그라비가',
        '(?<! )Holy': '홀리',
        'Hyperdrive': '하이퍼드라이브',
        'Idyllic Will': '수마의 신기',
        'Indolent Will': '태만의 신기',
        'Indulgent Will': '성모의 신기',
        'Inferno': '화염',
        'Intemperate Will': '박살의 신기',
        'Kefka Says': '꼭두각시 영혼',
        'Knock Down': '착탄',
        'Light of Judgment': '심판의 빛',
        'Longitudinal Implosion/Latitudinal Implosion': '가로/세로 내파',
        'Look upon Me and Despair': '있는 그대로의 나',
        'Maddening Orchestra': '광기의 오케스트라',
        'Mana Charge': '마력 충전',
        'Mana Release': '마력 방출',
        'Max': '맥시멈',
        'Meteor': '메테오',
        'Mystery Magic': '알쏭달쏭 마법',
        'Nothingness': '무의 파동',
        'Primordial Crust Quake': '혼돈의 흙 퀘이크',
        'Pulse Wave': '파동탄',
        '(?<![ h])Quake': '퀘이크',
        'Revolting Ruin III': '파삭파삭 루인가',
        'Shocking Impact': '겹충격',
        'Shockwave': '충격파',
        'Slap Happy': '철썩철썩 따귀',
        'Spelldriver/Spellscatter/Spellwave': '위험한 주문: 집중/분산/파동',
        'Stomp-a-Mole': '쿵쿵 발 구르기',
        'Stray Apocalypse': '혼돈의 종말',
        'Stray Entropy': '혼돈의 와류',
        'Stray Flames': '혼돈의 불',
        'Stray Spray': '혼돈의 물',
        'Tele-trouncing': '성큼성큼 텔레포',
        'The Decisive Battle': '결전',
        'The Path of Light': '빛의 파동',
        'Thrumming Thunder III': '찌릿찌릿 선더가',
        '(?<! )Thunder III': '선더가',
        'Tornado': '토네이도',
        'Trance': '자아도취',
        'Trine': '트라인',
        'Tsunami': '해일',
        'Ultima Blaster': '알테마 블래스터',
        'Ultima Repeater': '연속 알테마',
        'Ultima Upsurge': '두근두근 알테마',
        'Ultimate Embrace': '종말의 포옹',
        'Umbra Smash': '그림자 타격',
        'Vacuum Wave': '진공파',
        'Vitrophyre': '암석탄',
        'Wave Cannon': '파동포',
        'White Antilight': '산 자의 암흑광',
        'White Hole': '화이트홀',
        'Wings of Destruction': '파괴의 날개 ',
      },
    },
  ],
};

export default triggerSet;
