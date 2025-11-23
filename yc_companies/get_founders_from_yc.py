"""
Script to systematically extract real founder data from YC company pages
and update the CSV file with actual founder information.
"""
import csv
import json
import re
from pathlib import Path

def is_pattern_data(company):
    """Check if company has pattern-generated data"""
    founder_first = company.get('founder_first_name', '').strip()
    founder_email = company.get('founder_email', '').strip()
    
    # Pattern indicators
    if founder_first == 'Team' or founder_first == '':
        return True
    if founder_email.startswith('hello@'):
        return True
    if not company.get('founder_linkedin', '').strip():
        return True
    
    return False

def extract_company_slug(yc_link):
    """Extract company slug from YC link"""
    if not yc_link:
        return None
    match = re.search(r'/companies/([^/]+)', yc_link)
    if match:
        return match.group(1)
    return None

def main():
    input_file = Path('final_enriched_summer25 - final_enriched_summer25.csv')
    
    print("="*70)
    print("IDENTIFYING COMPANIES NEEDING REAL FOUNDER DATA")
    print("="*70)
    
    # Read existing CSV
    print(f"\n📖 Reading {input_file.name}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        companies = list(reader)
        fieldnames = reader.fieldnames
    
    print(f"   Found {len(companies)} companies")
    
    # Identify companies with pattern data
    pattern_companies = [c for c in companies if is_pattern_data(c)]
    real_companies = [c for c in companies if not is_pattern_data(c)]
    
    print(f"\n📊 Current Status:")
    print(f"   ✅ Real data: {len(real_companies)}")
    print(f"   🤖 Pattern data: {len(pattern_companies)}")
    
    if not pattern_companies:
        print("\n✅ All companies already have real founder data!")
        return
    
    # Create a list of companies to process with their YC links
    print(f"\n📋 Companies needing real founder data ({len(pattern_companies)}):")
    print("\nYC Links to visit:")
    for idx, company in enumerate(pattern_companies, 1):
        yc_link = company.get('YC_Link', '')
        company_name = company.get('Company_Name', '')
        slug = extract_company_slug(yc_link)
        print(f"{idx}. {company_name}: {yc_link}")
        if idx >= 10:
            print(f"... and {len(pattern_companies) - 10} more")
            break
    
    # Save list to JSON for processing
    output_json = Path('companies_needing_founders.json')
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(pattern_companies, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Saved list to {output_json.name}")
    print(f"\n🔍 Next step: Visit each YC page and extract founder information")
    print(f"   Then update the CSV with real data")
    
    return pattern_companies, companies, input_file, fieldnames

if __name__ == "__main__":
    pattern_companies, all_companies, csv_file, fieldnames = main()
    print(f"\n✅ Ready to extract founder data for {len(pattern_companies)} companies")


