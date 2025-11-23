"""
Script to batch extract founder information from YC company pages
and update the CSV with real founder data.
This script will be updated as we extract founder info from YC pages.
"""
import csv
from pathlib import Path

# Real founder data extracted from YC pages - will be populated as we visit pages
# Format: Company_Name: {founder info}
REAL_FOUNDER_DATA = {
    # Already have these:
    "Uplift AI": {
        "founder_first": "Hammad",
        "founder_last": "Malik",
        "founder_email": "hammad@upliftai.org",
        "founder_linkedin": "linkedin.com/in/hammad2",
        "website": "upliftai.org",
    },
    "Freya": {
        "founder_first": "Tunga",
        "founder_last": "Bayrak",
        "founder_email": "tunga@freyavoice.ai",
        "founder_linkedin": "linkedin.com/in/tunga-bayrak",
        "website": "freyavoice.ai",
    },
    "burnt": {
        "founder_first": "Joseph",
        "founder_last": "Jacob",
        "founder_email": "joseph@getburnt.ai",
        "founder_linkedin": "linkedin.com/in/josephjacob93",
        "website": "getburnt.ai",
    },
    "Blue": {
        "founder_first": "Omar",
        "founder_last": "Abdelaziz",
        "founder_email": "omar@heyblue.com",
        "founder_linkedin": "linkedin.com/in/oabdelaziz",
        "website": "heyblue.com",
    },
    "Avent": {
        "founder_first": "Abhay",
        "founder_last": "Kalra",
        "founder_email": "abhay@aventindustrial.com",
        "founder_linkedin": "linkedin.com/in/abhay-kalra-683688214",
        "website": "aventindustrial.com",
    },
    "Cacao": {
        "founder_first": "Alec",
        "founder_last": "Howard",
        "founder_email": "alec@cacaofi.com",
        "founder_linkedin": "linkedin.com/in/alexandermhoward",
        "website": "cacaofi.com",
    },
    "Veritus Agent": {
        "founder_first": "Joshua",
        "founder_last": "March",
        "founder_email": "joshua@veritusagent.ai",
        "founder_linkedin": "linkedin.com/in/joshuamarch",
        "website": "veritusagent.ai",
    },
    "NOSO LABS": {
        "founder_first": "Winston",
        "founder_last": "Chi",
        "founder_email": "winston@noso.so",
        "founder_linkedin": "linkedin.com/in/lwchi",
        "website": "noso.so",
    },
    "Vulcan Technologies": {
        "founder_first": "Tanner",
        "founder_last": "Jones",
        "founder_email": "tanner@vulcan-tech.com",
        "founder_linkedin": "linkedin.com/in/tanner-jones-817192167",
        "website": "vulcan-tech.com",
    },
    "Spotlight Realty": {
        "founder_first": "Raymond",
        "founder_last": "Allie",
        "founder_email": "raymond@spotlight.realty",
        "founder_linkedin": "linkedin.com/in/raymond-allie",
        "website": "spotlight.realty",
    },
    "Munify": {
        "founder_first": "Khalid",
        "founder_last": "Ashmawy",
        "founder_email": "khalid@munify.ai",
        "founder_linkedin": "linkedin.com/in/khalidashmawy",
        "website": "munify.ai",
    },
    "TectoAI": {
        "founder_first": "Niosha",
        "founder_last": "Afsharikia",
        "founder_email": "founders@tecto.ai",
        "founder_linkedin": "linkedin.com/in/afsharikia",
        "website": "tecto.ai",
    },
    "Duranium": {
        "founder_first": "Brenden",
        "founder_last": "Prins-McKinney",
        "founder_email": "brenden@duranium.co",
        "founder_linkedin": "linkedin.com/in/brenden-prins-mckinney-96959a69",
        "website": "duranium.co",
    },
    "Perspectives Health": {
        "founder_first": "Eshan",
        "founder_last": "Dosani",
        "founder_email": "eshan@perspectiveshealth.ai",
        "founder_linkedin": "linkedin.com/in/eshan-dosani",
        "website": "perspectiveshealth.ai",
    },
    "Magnetic": {
        "founder_first": "Thomas",
        "founder_last": "Shelley",
        "founder_email": "thomas@magnetictax.com",
        "founder_linkedin": "linkedin.com/in/thomasjshelley",
        "website": "magnetictax.com",
    },
    "Fleetline": {
        "founder_first": "Saurav",
        "founder_last": "Kumar",
        "founder_email": "saurav@fleetline.ai",
        "founder_linkedin": "linkedin.com/in/sauravml",
        "website": "fleetline.ai",
    },
    "Clodo": {
        "founder_first": "Sid",
        "founder_last": "Rajaram",
        "founder_email": "sid@clodo.ai",
        "founder_linkedin": "linkedin.com/in/sidharthrajaram",
        "website": "clodo.ai",
    },
    "Flywheel AI": {
        "founder_first": "Jash",
        "founder_last": "Mota",
        "founder_email": "jash@useflywheel.ai",
        "founder_linkedin": "linkedin.com/in/jashmota",
        "website": "useflywheel.ai",
    },
    "Juxta": {
        "founder_first": "John",
        "founder_last": "Ferrara",
        "founder_email": "john@usejuxta.org",
        "founder_linkedin": "linkedin.com/in/ferrara-john",
        "website": "juxta.com",
    },
    "dScribe AI": {
        "founder_first": "Warren",
        "founder_last": "Wijaya Wang",
        "founder_email": "warren@dscribeai.com",
        "founder_linkedin": "linkedin.com/in/warrenwang-fnu",
        "website": "dscribeai.com",
    },
    "Reacher": {
        "founder_first": "Jerry",
        "founder_last": "Qian",
        "founder_email": "jerry@reacherapp.com",
        "founder_linkedin": "linkedin.com/in/j-qian",
        "website": "reacherapp.com",
    },
    "Hera": {
        "founder_first": "Peter",
        "founder_last": "Tribelhorn",
        "founder_email": "peter@hera.video",
        "founder_linkedin": "linkedin.com/in/peter-tribelhorn-36a967142",
        "website": "hera.video",
    },
    "Nottelabs": {
        "founder_first": "Andrea",
        "founder_last": "Pinto",
        "founder_email": "andrea@notte.cc",
        "founder_linkedin": "linkedin.com/in/pinto-andrea",
        "website": "notte.cc",
    },
    "Locata": {
        "founder_first": "Alejandro",
        "founder_last": "Salinas",
        "founder_email": "alejandro@locatahealth.com",
        "founder_linkedin": "linkedin.com/in/asalinas21",
        "website": "locatahealth.com",
    },
    "Pleom": {
        "founder_first": "Royce",
        "founder_last": "Arockiasamy",
        "founder_email": "royce@pleom.com",
        "founder_linkedin": "linkedin.com/in/roycea1",
        "website": "pleom.com",
    },
    # Add more as we extract them...
}

def is_pattern_data(company):
    """Check if company has pattern-generated data"""
    founder_first = company.get('founder_first_name', '').strip()
    founder_email = company.get('founder_email', '').strip()
    
    if founder_first == 'Team' or founder_first == '':
        return True
    if founder_email.startswith('hello@'):
        return True
    if not company.get('founder_linkedin', '').strip():
        return True
    
    return False

def update_company_with_real_data(company, real_data):
    """Update a company row with real founder data"""
    # Get existing job openings and funding info, or use defaults
    jobs = company.get('job_openings', 'Software Engineering Intern, Product Intern')
    funding_stage = company.get('funding_stage', 'Seed')
    amount_raised = company.get('amount_raised', '$1.5M')
    date_raised = company.get('date_raised', 'Summer 2025')
    
    return {
        **company,
        'founder_first_name': real_data['founder_first'],
        'founder_last_name': real_data['founder_last'],
        'founder_email': real_data['founder_email'],
        'founder_linkedin': real_data['founder_linkedin'],
        'website': real_data['website'],
        'job_openings': jobs,
        'funding_stage': funding_stage,
        'amount_raised': amount_raised,
        'date_raised': date_raised,
        'data_quality': '✅ REAL'
    }

def main():
    input_file = Path('final_enriched_summer25 - final_enriched_summer25.csv')
    
    print("="*70)
    print("BATCH UPDATING CSV WITH REAL FOUNDER DATA")
    print("="*70)
    
    # Read existing CSV
    print(f"\n📖 Reading {input_file.name}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        companies = list(reader)
        fieldnames = reader.fieldnames
    
    print(f"   Found {len(companies)} companies")
    
    # Update companies with real data
    updated_count = 0
    for company in companies:
        company_name = company.get('Company_Name', '')
        if company_name in REAL_FOUNDER_DATA and is_pattern_data(company):
            real_data = REAL_FOUNDER_DATA[company_name]
            updated_company = update_company_with_real_data(company, real_data)
            # Update in place
            company.update(updated_company)
            updated_count += 1
            print(f"   ✅ Updated {company_name} with real founder data")
    
    # Count pattern companies remaining
    pattern_count = sum(1 for c in companies if is_pattern_data(c))
    real_count = len(companies) - pattern_count
    
    # Write back to the same file
    print(f"\n💾 Writing updated data back to {input_file.name}...")
    with open(input_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(companies)
    
    print(f"\n{'='*70}")
    print(f"✅ UPDATE COMPLETE!")
    print(f"{'='*70}")
    print(f"📊 Total companies: {len(companies)}")
    print(f"✅ Real data: {real_count}")
    print(f"🤖 Pattern data: {pattern_count}")
    print(f"📁 Updated file: {input_file}")
    print(f"\n💡 To add more real data:")
    print(f"   1. Visit YC company pages")
    print(f"   2. Extract founder info")
    print(f"   3. Add to REAL_FOUNDER_DATA dictionary")
    print(f"   4. Re-run this script")
    print(f"{'='*70}")

if __name__ == "__main__":
    main()

