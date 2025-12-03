import { createClient } from '@supabase/supabase-js';
import { guessFounderEmailFromStartup } from '@/lib/founder-email';
import { config as loadEnv } from 'dotenv';
import path from 'path';

type StartupRow = {
  id: string;
  name: string;
  website: string | null;
  founder_first_name: string | null;
  founder_emails: string | null;
};

async function main() {
  // Load env vars from .env.local first (Next.js style), then fall back to .env
  const rootDir = process.cwd();
  loadEnv({ path: path.join(rootDir, '.env.local') });
  loadEnv({ path: path.join(rootDir, '.env') });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. ' +
        'Set these before running the backfill script.'
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey);

  console.log('Fetching startups with empty founder_emails...');

  const { data, error } = await supabase
    .from('startups')
    .select('id, name, website, founder_first_name, founder_emails');

  if (error) {
    console.error('Error fetching startups:', error.message);
    process.exit(1);
  }

  const startups = ((data ?? []) as StartupRow[]).filter(
    (s) => !s.founder_emails || s.founder_emails.trim() === ''
  );

  console.log(`Found ${startups.length} startups with empty founder_emails`);

  for (const startup of startups) {
    const { email, isGuessed } = guessFounderEmailFromStartup({
      founder_first_name: startup.founder_first_name,
      founder_emails: startup.founder_emails,
      website: startup.website,
    });

    if (!isGuessed || !email) {
      console.log(
        `Skipping ${startup.name} (cannot guess from first name + website)`
      );
      continue;
    }

    console.log(`Setting guessed founder email for ${startup.name}: ${email}`);

    const { error: updateError } = await supabase
      .from('startups')
      .update({ founder_emails: email })
      .eq('id', startup.id);

    if (updateError) {
      console.error(
        `  Failed to update ${startup.name}:`,
        updateError.message
      );
    }
  }

  console.log('Backfill complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


