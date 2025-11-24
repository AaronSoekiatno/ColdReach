import { HelixDB } from 'helix-ts';

// Initialize the HelixDB client
// Uses HELIX_URL env var, defaults to localhost for development
const helix = new HelixDB(process.env.HELIX_URL || 'http://localhost:6969');

export interface Candidate {
  name: string;
  email: string;
  summary: string;
  skills: string;
  embedding: number[];
}

export interface Startup {
  name: string;
  industry: string;
  description: string;
  funding_stage: string;
  funding_amount: string;
  location: string;
  embedding: number[];
}

/**
 * Add a new candidate to the database
 */
export async function addCandidate(candidate: Candidate) {
  const result = await helix.query('AddCandidate', {
    name: candidate.name,
    email: candidate.email,
    summary: candidate.summary,
    skills: candidate.skills,
    embedding: candidate.embedding,
  });
  return result;
}

/**
 * Get a candidate by their email
 */
export async function getCandidateByEmail(email: string) {
  const result = await helix.query('GetCandidateByEmail', { email });
  return result;
}

/**
 * Add a new startup to the database
 */
export async function addStartup(startup: Startup) {
  const result = await helix.query('AddStartup', {
    name: startup.name,
    industry: startup.industry,
    description: startup.description,
    funding_stage: startup.funding_stage,
    funding_amount: startup.funding_amount,
    location: startup.location,
    embedding: startup.embedding,
  });
  return result;
}

/**
 * Get all startups from the database
 */
export async function getAllStartups() {
  const result = await helix.query('GetAllStartups', {});
  return result;
}

/**
 * Get matches for a candidate by their email
 */
export async function getCandidateMatches(email: string) {
  const result = await helix.query('GetCandidateMatches', { email });
  return result;
}

export default helix;
