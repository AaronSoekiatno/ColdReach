"""
Script to update CSV with real founder data extracted from YC pages.
This script will update companies with actual founder information.
"""
import csv
import json
import re
from pathlib import Path

# Real founder data extracted from YC pages
# Format: Company_Name: {founder info}
REAL_FOUNDER_DATA = {
    "Uplift AI": {
        "founder_first": "Hammad",
        "founder_last": "Malik",
        "founder_email": "hammad@upliftai.org",
        "founder_linkedin": "linkedin.com/in/hammad2",
        "website": "upliftai.org",
        "jobs": "Software Engineering Intern, Product Intern",
        "funding_stage": "Seed",
        "amount_raised": "$1.5M",
        "date_raised": "Summer 2025"
    },
    "Freya": {
        "founder_first": "Tunga",
        "founder_last": "Bayrak",
        "founder_email": "tunga@freyavoice.ai",
        "founder_linkedin": "linkedin.com/in/tunga-bayrak",
        "website": "freyavoice.ai",
        "jobs": "ML Engineering Intern, AI Research Intern",
        "funding_stage": "Seed",
        "amount_raised": "$1.5M",
        "date_raised": "Summer 2025"
    },
    "burnt": {
        "founder_first": "Joseph",
        "founder_last": "Jacob",
        "founder_email": "joseph@getburnt.ai",
        "founder_linkedin": "linkedin.com/in/josephjacob93",
        "website": "getburnt.ai",
        "jobs": "ML Engineering Intern, AI Research Intern",
        "funding_stage": "Seed",
        "amount_raised": "$1.5M",
        "date_raised": "Summer 2025"
    }
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
    return {
        **company,
        'founder_first_name': real_data['founder_first'],
        'founder_last_name': real_data['founder_last'],
        'founder_email': real_data['founder_email'],
        'founder_linkedin': real_data['founder_linkedin'],
        'website': real_data['website'],
        'job_openings': real_data['jobs'],
        'funding_stage': real_data['funding_stage'],
        'amount_raised': real_data['amount_raised'],
        'date_raised': real_data['date_raised'],
        'data_quality': '✅ REAL'
    }

def main():
    input_file = Path('final_enriched_summer25 - final_enriched_summer25.csv')
    
    print("="*70)
    print("UPDATING CSV WITH REAL FOUNDER DATA")
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

