export interface Actor {
  id: number;
  name: string;
  risk_level: string;
  confidence_score: number;
  first_seen: string | null;
  last_seen: string | null;
  description: string | null;
  tags: string | null;
  is_active: boolean;
  created_at: string | null;
  alias_count: number;
  pgp_count: number;
  wallet_count: number;
  domain_count: number;
  post_count: number;
}

export interface ActorDetail {
  actor: Actor;
  aliases: Alias[];
  pgp_keys: PGPKey[];
  wallets: Wallet[];
  domains: Domain[];
  ips: IP[];
  posts: Post[];
  behavior_profile: BehaviorProfile | null;
  stylometric_profile: StylometricProfile | null;
  attributions: Attribution[];
  evidence: Evidence[];
}

export interface Alias {
  id: number;
  actor_id: number;
  handle: string;
  platform: string | null;
  first_seen: string | null;
  last_seen: string | null;
  is_primary: boolean;
}

export interface PGPKey {
  id: number;
  actor_id: number;
  fingerprint: string;
  key_id: string | null;
  algorithm: string | null;
  creation_date: string | null;
}

export interface Wallet {
  id: number;
  actor_id: number;
  address: string;
  currency: string;
  label: string | null;
  balance: number;
  transaction_count: number;
  first_seen: string | null;
  last_seen: string | null;
}

export interface Domain {
  id: number;
  actor_id: number;
  domain: string;
  is_tor: boolean;
  first_seen: string | null;
}

export interface IP {
  id: number;
  actor_id: number;
  ip_address: string;
  port: number | null;
  asn: string | null;
  country: string | null;
  is_tor: boolean;
}

export interface Post {
  id: number;
  actor_id: number;
  title: string | null;
  content: string | null;
  platform: string | null;
  posted_at: string | null;
  word_count: number | null;
}

export interface BehaviorProfile {
  night_activity_pct: number;
  weekend_activity_pct: number;
  avg_posting_interval_hours: number;
  alias_migration_freq: string;
  marketplace_activity: string;
  forum_activity: string;
  timezone_estimate: string;
  posting_frequency: number;
}

export interface StylometricProfile {
  avg_sentence_length: number;
  vocabulary_richness: number;
  punctuation_ratio: number;
  avg_word_length: number;
  sample_count: number;
}

export interface Attribution {
  id: number;
  source_actor_id: number;
  target_actor_id: number;
  overall_confidence: number;
  confidence_level: string;
  alias_similarity: number;
  pgp_match: number;
  wallet_relationship: number;
  behavior_similarity: number;
  stylometry_similarity: number;
  infrastructure_match: number;
  temporal_correlation: number;
  source_reliability: number;
}

export interface Evidence {
  id: number;
  actor_id: number | null;
  evidence_type: string;
  description: string;
  confidence: number;
  source: string | null;
  evidence_hash: string | null;
  created_at: string | null;
}

export interface TimelineEvent {
  id: number;
  actor_id: number | null;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string;
  confidence: number;
  source: string | null;
}

export interface DashboardStats {
  total_actors: number;
  total_aliases: number;
  total_pgps: number;
  total_wallets: number;
  total_domains: number;
  total_ips: number;
  total_posts: number;
  total_relationships: number;
  total_evidence: number;
  total_attributions: number;
  high_confidence_linkages: number;
  recent_intelligence: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  properties?: Record<string, any>;
}
