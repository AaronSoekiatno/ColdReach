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
    embedding: [F64],
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
