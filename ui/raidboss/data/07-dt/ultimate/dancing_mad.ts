import Conditions from '../../../../../resources/conditions';
import Outputs from '../../../../../resources/outputs';
import { callOverlayHandler } from '../../../../../resources/overlay_plugin_api';
import { Responses } from '../../../../../resources/responses';
import Util from '../../../../../resources/util';
import ZoneId from '../../../../../resources/zone_id';
import { RaidbossData } from '../../../../../types/data';
import { PluginCombatantState } from '../../../../../types/event';
import { Job } from '../../../../../types/job';
import { OutputStrings, TriggerSet } from '../../../../../types/trigger';

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

const centerX = 100;
const centerY = 100;

export interface Data extends RaidbossData {
  readonly triggerSetConfig: {
    forsaken: ForsakenStrategy;
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
  myPathOfLights: PathOfLightMarker[];
  partySlotByPlayer: { [name: string]: PartySlot };
  partySlotAssignments: Partial<Record<PartySlot, string>>;
  myPartySlot?: PartySlot;
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

const collectPathOfLightStackCombatants = async (data: Data): Promise<void> => {
  data.pathOfLightStackCombatants = [];
  if (getPathOfLightMarker(data, data.me) !== 'stack')
    return;

  const otherStack = data.pathOfLightStackPlayers.find((player) => player !== data.me);
  if (otherStack === undefined)
    return;

  data.pathOfLightStackCombatants = (await callOverlayHandler({
    call: 'getCombatants',
    names: [data.me, otherStack],
  })).combatants;
};

const getStealFireOddTowerStackOutput = (
  data: Data,
): PathOfLightTowerOneOutput => {
  const otherStack = data.pathOfLightStackPlayers.find((player) => player !== data.me);
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
  return cross > 0 ? 'rightTowerInsideRight' : 'leftTowerInsideLeft';
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
    cn: '避开直线',
  },
  fakeThunder: {
    en: 'In Line',
    cn: '站直线内',
  },
  trueIce: {
    en: 'Avoid Tell',
    cn: '避开扇形',
  },
  fakeIce: {
    en: 'In Cone',
    cn: '进入扇形',
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
    cn: '${mech} + ${ice}',
  },
  stackFakeIce: {
    en: '${mech} + ${ice}',
    cn: '${mech} + ${ice}',
  },
  spreadTrueIce: {
    en: '${mech} + ${ice}',
    cn: '${mech} + ${ice}',
  },
  spreadFakeIce: {
    en: '${mech} + ${ice}',
    cn: '${mech} + ${ice}',
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
    cn: '${mech} + ${thunder}',
  },
  stackFakeThunder: {
    en: '${mech} + ${thunder}',
    cn: '${mech} + ${thunder}',
  },
  spreadTrueThunder: {
    en: '${mech} + ${thunder}',
    cn: '${mech} + ${thunder}',
  },
  spreadFakeThunder: {
    en: '${mech} + ${thunder}',
    cn: '${mech} + ${thunder}',
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
    cn: '左塔内左分摊',
  },
  rightTowerInsideRight: {
    en: 'Right Tower, Inside Right',
    cn: '右塔内右分摊',
  },
  rightTowerInsideLeft: {
    en: 'Right Tower, Inside Left',
    cn: '右塔内左分散',
  },
  leftTowerInsideUpDown: {
    en: 'Left Tower, Inside Up/Down',
    cn: '左塔内下分散',
  },
  rightTowerOutsideRightStack: {
    en: 'Right Tower, Outside Right Stack',
    cn: '右塔外分摊',
  },
  leftTowerOutsideLeft: {
    en: 'Left Tower, Outside Left',
    cn: '左塔外左分摊',
  },
  leftTowerOutsideDownBait: {
    en: 'Left Tower, Outside Down Bait',
    cn: '左塔外下引导',
  },
  leftTowerInsidePairBait: {
    en: 'Left Tower, Inside Pair Bait',
    cn: '左塔内互射',
  },
  rightTowerInsideSpread: {
    en: 'Right Tower, Inside Spread',
    cn: '右塔内分散',
  },
  leftUpBait: {
    en: 'Upper Left Bait',
    cn: '左上引导',
  },
  leftDownBait: {
    en: 'Lower Left Bait',
    cn: '左下引导',
  },
  rightUpBait: {
    en: 'Upper Right Bait',
    cn: '右上引导',
  },
  rightDownBait: {
    en: 'Lower Right Bait',
    cn: '右下引导',
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
      partySlotByPlayer: {},
      partySlotAssignments: {},
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
      id: 'DMU P1 Wave Cannon',
      // BAA8 Wave Cannon is an instant cast from Graven Image
      // This gives a ~5 second warning to spread
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: false },
      suppressSeconds: 99999, // First instance is a blue tower
      alertText: (_data, _matches, output) => output.waveCannonLine!(),
      outputStrings: {
        waveCannonLine: {
          en: 'E/W Spread',
          cn: '东西分散',
        },
      },
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

        const severity = data.doubleTroubleTrapTargets.includes(data.me) ? 'alertText' : 'infoText';
        const players = data.doubleTroubleTrapTargets.map(
          (player) => {
            if (player === data.me)
              return 'YOU';
            return data.party.member(player);
          },
        );
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

        const players = data.doubleTroubleTrapTargets.map(
          (player) => {
            if (player === data.me)
              return 'YOU';
            return data.party.member(player);
          },
        );
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
        const hasVitrophyre = data.gravenImageTether === 'vitrophyre';
        return data.isIceTrue
          ? output.trueIcePuddle!({
            mech1: output.trueIce!(),
            mech2: output.puddle!(),
            mech3: hasVitrophyre ? output.spread!() : output.middle!(),
          })
          : output.fakeIcePuddle!({
            mech1: output.fakeIce!(),
            mech2: output.puddle!(),
            mech3: hasVitrophyre ? output.spread!() : output.middle!(),
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

        const players = data.doubleTroubleTrapTargets.map(
          (player) => {
            if (player === data.me)
              return 'YOU';
            return data.party.member(player);
          },
        );
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
            mech2: output.middle!(),
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

        const severity = data.doubleTroubleTrapTargets.includes(data.me) ? 'alertText' : 'infoText';
        const players = data.doubleTroubleTrapTargets.map(
          (player) => {
            if (player === data.me)
              return 'YOU';
            return data.party.member(player);
          },
        );
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

        const severity = data.doubleTroubleTrapTargets.includes(data.me) ? 'alertText' : 'infoText';
        const players = data.doubleTroubleTrapTargets.map(
          (player) => {
            if (player === data.me)
              return 'YOU';
            return data.party.member(player);
          },
        );
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
          cn: '上角边',
        },
        downdown: {
          en: 'Down Portents',
          cn: '下角边',
        },
        rightright: {
          en: 'Right Portents',
          cn: '右角边',
        },
        leftleft: {
          en: 'Left Portents',
          cn: '左角边',
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
      condition: (data, matches) => data.me === matches.target && data.pathOfLightCounter === 4,
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
      alertText: (data, _matches, output) => {
        const call = getStealFireTowerOneOutput(data, data.myPathOfLightAssignment);
        return output[call]!();
      },
      outputStrings: forsakenOutputStrings,
    },
    {
      id: 'DMU P2 Path of Light Towers 6',
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
      condition: (data, matches) => {
        return data.me === matches.target && data.pathOfLightCounter === 6;
      },
      delaySeconds: 0.1, // Delay for party headmarker collect
      durationSeconds: 9,
      infoText: (data, matches, output) => {
        // If a player from Group A accidentally soaks
        if (data.myPathOfLights.length !== 3)
          return;
        const id = matches.id;
        type markerMap = {
          [key: string]: 'stack' | 'cone' | 'spread';
        };
        const markers: markerMap = {
          '02CB': 'stack',
          '02CD': 'cone',
          '02CC': 'spread',
        };
        const marker = markers[id];
        if (marker === undefined)
          return;

        // Unsure that this could happen, unless more than 4 players soaked?
        if (marker === 'stack')
          return;

        if (marker === 'cone')
          return output.mechs!({
            mech1: output.tower!(),
            mech2: output.beNear!(),
          });
        if (marker === 'spread')
          return output.mechs!({
            mech1: output.tower!(),
            mech2: output.beFar!(),
          });
      },
      outputStrings: {
        tower: Outputs.getTowers,
        beNear: {
          en: 'Be Near',
          de: 'Sei Nahe',
          cn: '站近',
          ko: '가까이 있기',
        },
        beFar: {
          en: 'Be Far',
          de: 'Sei Fern',
          cn: '站远',
          ko: '멀리 있기',
        },
        mechs: {
          en: '${mech1} + ${mech2}',
          cn: '${mech1} + ${mech2}',
        },
      },
    },
    {
      id: 'DMU P2 Path of Light Towers 6 Baits',
      // Players that still have the first headmarker
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
        if (data.myPathOfLights.length !== 4)
          return;

        return output.bait!();
      },
      outputStrings: {
        bait: {
          en: 'Bait cone Left/Right or clone far',
          cn: '左右引导扇形，或远离分身',
        },
      },
    },
    {
      id: 'DMU P2 Path of Light Towers 7',
      // This set should not contain stack markers
      // If stacks exist, they came from first set
      // There should be two stacks, a cone and an aoe
      //
      // Headmarkers come out ~2s before Future's/Past's End
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData['stackPath'],
          headMarkerData['conePath'],
          headMarkerData['spreadPath'],
        ],
        capture: false,
      },
      condition: (data) => data.pathOfLightCounter === 7,
      delaySeconds: 0.1, // Delay for party headmarker collect
      durationSeconds: 9,
      infoText: (data, _matches, output) => {
        // Both groups will be on their last soak
        // Group B will have two stacks
        const marker = data.myPathOfLights[4] ?? 'unknown';
        if (marker === 'stack') {
          // Need to know for priority
          const players = data.pathOfLightStackPlayers.map(
            (player) => {
              if (player === data.me)
                return 'YOU';
              return data.party.member(player);
            },
          );
          const msg = players?.join(', ');
          return output.markerOnYouTower!({
            marker: output.stacksOnPlayers!({ players: msg }),
            tower: output.tower!(),
          });
        }
        return output.groupBTowers!();
      },
      outputStrings: forsakenOutputStrings,
    },
    {
      id: 'DMU P2 Path of Light Towers 8',
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
        capture: false,
      },
      condition: (data) => data.pathOfLightCounter === 8,
      delaySeconds: 0.1, // Delay for party headmarker collect
      durationSeconds: 9,
      infoText: (data, _matches, output) => {
        // Handle first group's last towers
        if (data.myPathOfLights.length === 4) {
          const marker = data.myPathOfLights[3];

          if (marker === 'stack' || marker === 'unknown')
            return;

          if (data.triggerSetConfig.forsaken === 'kroxy-rinon') {
            const tower = data.role === 'tank' || Util.isMeleeDpsJob(data.job)
              ? 'rightTower'
              : 'leftTower';
            if (marker === 'cone')
              return output.mechs!({
                mech1: output[tower]!(),
                mech2: output.beNear!(),
              });
            if (marker === 'spread')
              return output.mechs!({
                mech1: output[tower]!(),
                mech2: output.beFar!(),
              });
          }
          if (marker === 'cone')
            return output.mechs!({
              mech1: output.tower!(),
              mech2: output.beNear!(),
            });
          if (marker === 'spread')
            return output.mechs!({
              mech1: output.tower!(),
              mech2: output.beFar!(),
            });
        }
        return output.bait!();
      },
      outputStrings: {
        tower: Outputs.getTowers,
        leftTower: {
          en: 'Left Tower',
          cn: '左塔',
        },
        rightTower: {
          en: 'Right Tower',
          cn: '右塔',
        },
        beNear: {
          en: 'Be Near',
          de: 'Sei Nahe',
          cn: '站近',
          ko: '가까이 있기',
        },
        beFar: {
          en: 'Be Far',
          de: 'Sei Fern',
          cn: '站远',
          ko: '멀리 있기',
        },
        mechs: {
          en: '${mech1} + ${mech2}',
          cn: '${mech1} + ${mech2}',
        },
        bait: {
          en: 'Bait cone Left/Right or clone far',
          cn: '左右引导扇形，或远离分身',
        },
      },
    },
    {
      id: 'DMU P2 Light of Judgment',
      type: 'StartsUsing',
      netRegex: { id: 'BABD', source: 'Kefka', capture: false },
      response: Responses.bigAoe('alert'),
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
      type: 'StartsUsing',
      netRegex: { id: 'C487', source: 'Kefka', capture: false },
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = {
          maxMeleeAvoidTanks: {
            en: 'Max Melee: Avoid Tanks',
            de: 'Max Nahkampf: Weg von den Tanks',
            fr: 'Max mêlée : éloignez-vous des tanks',
            ja: '近接最大レンジ タンクから離れる',
            cn: '最大近战距离，避开坦克',
            ko: '칼끝딜: 탱커 피하기',
            tc: '最大近戰距離，避開坦克',
          },
          wingsBeNearFar: {
            en: 'Wings: Be Near/Far',
            de: 'Schwingen: Nah/Fern',
            fr: 'Ailes : Placez-vous près/loin',
            ja: '翼: めり込む/離れる',
            cn: '双翅膀：近或远',
            ko: '양날개: 가까이/멀리',
            tc: '雙翅膀：近或遠',
          },
        };
        if (data.role === 'tank')
          return { alertText: output.wingsBeNearFar!() };
        return { infoText: output.maxMeleeAvoidTanks!() };
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
      id: 'DMU P3 Damning Edict',
      type: 'StartsUsing',
      netRegex: { id: 'BB01', source: 'Chaos', capture: false },
      response: Responses.getBehind(),
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
      'locale': 'cn',
      'replaceSync': {
        'Kefka': '\u51ef\u592b\u5361',
        'Chaos': '\u6df7\u6c8c',
        'Graven Image': '\u795e\u50cf',
      },
    },
  ],
};

export default triggerSet;
