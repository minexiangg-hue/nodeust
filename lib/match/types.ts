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
  price?: number;
  currency?: string;
  model?: string;
  condition?: string;
  quantity?: number;
  colors?: string[];
  edition?: string;
  priceBasis?: 'unit' | 'total';
  skill?: string;
  requiredSkill?: string;
  communication?: string;
  topics?: string[];
  requiredTopics?: string[];
  party?: number;
  seats?: number;
  capacity?: number;
  place?: string;
  /** Verbatim source snippets, never claims from latent test labels. */
  evidence: string[];
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
