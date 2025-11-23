// Candidate - represents a user who uploaded their resume
N::Candidate {
    INDEX email: String,
    name: String,
    summary: String,
    skills: String,
    embedding: [F64],
}

// Startup - represents a startup from the dataset
N::Startup {
    INDEX name: String,
    industry: String,
    description: String,
    funding_stage: String,
    funding_amount: String,
    location: String,
    website: String,
    tags: String,
    embedding: [F64],
}

// FundingRound - represents a funding round for a startup
N::FundingRound {
    INDEX id: String,
    stage: String,
    amount: String,
    date_raised: String,
    batch: String,
}

// Founder - represents a founder of a startup
N::Founder {
    INDEX email: String,
    first_name: String,
    last_name: String,
    linkedin: String,
}

// Edge connecting a candidate to matched startups
E::MatchedTo {
    From: Candidate,
    To: Startup,
    Properties: {
        score: F64,
        matched_at: String,
    }
}

// Edge connecting a startup to its founders
E::HasFounder {
    From: Startup,
    To: Founder,
}

// Edge connecting a startup to its funding rounds
E::HasFundingRound {
    From: Startup,
    To: FundingRound,
}
