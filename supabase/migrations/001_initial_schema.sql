-- Create startups table (all data in one table)
CREATE TABLE IF NOT EXISTS startups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  funding_amount TEXT,
  job_openings TEXT,
  round_type TEXT, -- funding stage (Seed, Series A, etc.)
  date TEXT, -- funding date
  location TEXT,
  website TEXT,
  founder_linkedin TEXT,
  industry TEXT,
  founder_names TEXT, -- comma-separated founder names
  founder_emails TEXT, -- comma-separated founder emails
  keywords TEXT, -- tags/keywords for the startup
  description TEXT, -- company description (for embeddings)
  pinecone_id TEXT, -- ID in Pinecone for the embedding
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create candidates table (for resume uploads)
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT,
  skills TEXT,
  pinecone_id TEXT, -- ID in Pinecone for the embedding
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create matches table (for candidate-startup matches)
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  score FLOAT,
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(candidate_id, startup_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_startups_name ON startups(name);
CREATE INDEX IF NOT EXISTS idx_startups_industry ON startups(industry);
CREATE INDEX IF NOT EXISTS idx_startups_round_type ON startups(round_type);
CREATE INDEX IF NOT EXISTS idx_startups_location ON startups(location);
CREATE INDEX IF NOT EXISTS idx_startups_keywords ON startups USING gin(to_tsvector('english', keywords));
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_matches_candidate_id ON matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_matches_startup_id ON matches(startup_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(score DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth requirements)
-- For now, allow all operations - you can restrict later based on your needs
CREATE POLICY "Allow all operations on startups" ON startups
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on candidates" ON candidates
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on matches" ON matches
  FOR ALL USING (true) WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_startups_updated_at
  BEFORE UPDATE ON startups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

