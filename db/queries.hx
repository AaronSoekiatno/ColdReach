// ==================== CANDIDATE QUERIES ====================

// Add a new candidate from resume upload
QUERY AddCandidate(name: String, email: String, summary: String, skills: String, embedding: [F64]) =>
    candidate <- AddN<Candidate>({
        name: name,
        email: email,
        summary: summary,
        skills: skills,
        embedding: embedding
    })
    RETURN candidate

// Get candidate by email
QUERY GetCandidateByEmail(email: String) =>
    candidate <- N<Candidate>({email: email})
    RETURN candidate

// ==================== STARTUP QUERIES ====================

// Add a new startup to the database
QUERY AddStartup(name: String, industry: String, description: String, funding_stage: String, funding_amount: String, location: String, embedding: [F64]) =>
    startup <- AddN<Startup>({
        name: name,
        industry: industry,
        description: description,
        funding_stage: funding_stage,
        funding_amount: funding_amount,
        location: location,
        embedding: embedding
    })
    RETURN startup

// Get all startups
QUERY GetAllStartups() =>
    startups <- N<Startup>
    RETURN startups

// ==================== MATCHING QUERIES ====================

// TODO: Vector similarity search - need to find correct Helix syntax
// Find top K startups matching a candidate's embedding using vector similarity
// QUERY FindMatchingStartups(candidate_embedding: [F64], limit: I64) =>
//     matches <- N<Startup>::VectorSearch(embedding, candidate_embedding, limit)
//     RETURN matches

// Find matches for a specific candidate by their email
// QUERY FindMatchesForCandidate(email: String, limit: I64) =>
//     candidate <- N<Candidate>({email: email})
//     matches <- N<Startup>::VectorSearch(embedding, candidate.embedding, limit)
//     RETURN matches

// Save a match between candidate and startup
// TODO: Fix edge creation syntax - need correct AddE syntax
// QUERY SaveMatch(candidate_email: String, startup_name: String, score: F64, matched_at: String) =>
//     candidate <- N<Candidate>({email: candidate_email})
//     startup <- N<Startup>({name: startup_name})
//     edge <- AddE<MatchedTo> {
//         from: candidate,
//         to: startup,
//         score: score,
//         matched_at: matched_at
//     }
//     RETURN edge

// Get all saved matches for a candidate
QUERY GetCandidateMatches(email: String) =>
    candidate <- N<Candidate>({email: email})
    matches <- candidate::Out<MatchedTo>
    RETURN matches
