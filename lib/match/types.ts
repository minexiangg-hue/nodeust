import type { Money } from './constraints.ts';
import type { MatchClaim, MatchRequirement } from './requirements.ts';

/** Public post content only. Owner IDs are used by the server for exclusion, never extraction. */
export type MatchPost = {
  id: string;
  ownerId?: string;
  category: string;
  title: string;
  body: string;
  currentHall?: string | null;
  targetHall?: string | null;
  roomType?: string | null;
  genderEligibility?: string | null;
  availableFrom?: string | null;
  locationId?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
  status?: string;
};
export type MatchKind = 'hall' | 'goods' | 'study' | 'transport' | 'other';
export type MatchIntent = {
  kind: MatchKind;
  /** Canonical item/course/activity, or route for housing/transport. */
  entity: string;
  side: 'offer' | 'seek' | 'peer' | 'driver' | 'rider' | 'share' | 'swap';
  from?: string;
  fromExit?: string;
  toExit?: string;
  to?: string;
  date?: string;
  minute?: number;
  endMinute?: number;
  strictTime?: boolean;
  term?: string;
  room?: string;
  wantedRoom?: string;
  wantedRooms?: string[];
  eligibility?: string;
  /** Public author claims, not verification against university records. */
  allocation?: 'confirmed' | 'pending' | 'denied';
  exchangeEligibility?: 'eligible' | 'ineligible' | 'pending';
  /** Missing transaction preserves the existing sale-only representation. */
  transaction?: 'sale' | 'loan';
  loanStart?: string;
  loanEnd?: string;
  loanPickupPlace?: string;
  loanReturnPlace?: string;
  price?: number;
  /** Explicit lesson/travel charge or budget; no implied free service. */
  fee?: Money;
  currency?: string;
  model?: string;
  condition?: string;
  quantity?: number;
  thicknessMm?: number;
  minimumThicknessMm?: number;
  colors?: string[];
  edition?: string;
  itemFormat?: 'print' | 'digital';
  itemLanguage?: string;
  priceBasis?: 'unit' | 'total';
  skill?: string;
  requiredSkill?: string;
  walkingMinutes?: number;
  requiredWalkingMinutes?: number;
  alcoholFree?: boolean;
  requiresAlcoholFree?: boolean;
  alcoholAllowed?: boolean;
  acceptsAlcoholFree?: boolean;
  vegetarianOnly?: boolean;
  acceptsVegetarian?: boolean;
  participantLevel?: 'ug' | 'pg';
  requiredParticipantLevel?: 'ug' | 'pg';
  participantGender?: string;
  requiredParticipantGender?: string;
  equipment?: string[];
  requiredEquipment?: string[];
  providedEquipment?: string[];
  borrowedEquipment?: string[];
  luggage?: number;
  luggagePerPerson?: number;
  luggageKind?: 'backpack' | 'suitcase' | 'small-bag' | 'bag';
  luggageLimit?: number;
  luggageLimitBasis?: 'person' | 'party';
  luggageTotalLimit?: number;
  luggageLimitKind?: 'backpack' | 'suitcase' | 'small-bag' | 'any';
  allowedLuggageKinds?: Array<'backpack' | 'suitcase' | 'small-bag' | 'bag'>;
  communication?: string;
  topics?: string[];
  requiredTopics?: string[];
  party?: number;
  seats?: number;
  unlimitedPlaces?: boolean;
  /** An explicit attendance limit whose count may be unspecified. */
  limitedPlaces?: boolean;
  capacity?: number;
  soughtPartyMax?: number;
  place?: string;
  guestAccess?: 'provided' | 'restricted';
  /** Verbatim source snippets, never claims from latent test labels. */
  evidence: string[];
  /** Explicit facts and counterpart requirements, scoped to this intent only. */
  claims?: MatchClaim[];
  requirements?: MatchRequirement[];
  /** Missing essential fields; prevents classification as a confident match. */
  missing: string[];
};
export type ParsedPost = {
  post: MatchPost;
  intents: MatchIntent[];
  warnings: string[];
};
export type MatchReason = { code: string; values?: string[] };
export type PairMatch = {
  kind: MatchKind;
  confidence: 'high' | 'possible';
  score: number;
  reasons: MatchReason[];
  missing: string[];
};
