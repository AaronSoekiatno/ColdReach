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
QUERY AddStartup(name: String, industry: String, description: String, funding_stage: String, funding_amount: String, location: String, website: String, tags: String, embedding: [F64]) =>
    startup <- AddN<Startup>({
        name: name,
        industry: industry,
        description: description,
        funding_stage: funding_stage,
        funding_amount: funding_amount,
        location: location,
        website: website,
        tags: tags,
        embedding: embedding
    })
    RETURN startup

// Get all startups
QUERY GetAllStartups() =>
    startups <- N<Startup>
    RETURN startups

// ==================== FUNDING ROUND QUERIES ====================

// Add a new funding round
QUERY AddFundingRound(id: String, stage: String, amount: String, date_raised: String, batch: String) =>
    funding_round <- AddN<FundingRound>({
        id: id,
        stage: stage,
        amount: amount,
        date_raised: date_raised,
        batch: batch
    })
    RETURN funding_round

// Get funding round by ID
QUERY GetFundingRoundById(id: String) =>
    funding_round <- N<FundingRound>({id: id})
    RETURN funding_round

// ==================== FOUNDER QUERIES ====================

// Add a new founder
QUERY AddFounder(email: String, first_name: String, last_name: String, linkedin: String) =>
    founder <- AddN<Founder>({
        email: email,
        first_name: first_name,
        last_name: last_name,
        linkedin: linkedin
    })
    RETURN founder

// Get founder by email
QUERY GetFounderByEmail(email: String) =>
    founder <- N<Founder>({email: email})
    RETURN founder

// ==================== RELATIONSHIP QUERIES ====================

// Connect a startup to a founder
QUERY ConnectStartupToFounder(startup_name: String, founder_email: String) =>
    startup <- N<Startup>({name: startup_name})
    founder <- N<Founder>({email: founder_email})
    edge <- AddE<HasFounder>({
        from: startup,
        to: founder
    })
    RETURN edge

// Connect a startup to a funding round
QUERY ConnectStartupToFundingRound(startup_name: String, funding_round_id: String) =>
    startup <- N<Startup>({name: startup_name})
    funding_round <- N<FundingRound>({id: funding_round_id})
    edge <- AddE<HasFundingRound>({
        from: startup,
        to: funding_round
    })
    RETURN edge

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
