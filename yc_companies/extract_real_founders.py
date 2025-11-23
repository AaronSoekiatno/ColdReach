"""
Script to extract real founder data from YC company pages
and update the CSV with actual founder information.
"""
import csv
import json
import re
from pathlib import Path
import time

def extract_company_slug(yc_link):
    """Extract company slug from YC link"""
    if not yc_link:
        return None
    match = re.search(r'/companies/([^/]+)', yc_link)
    if match:
        return match.group(1)
    return None

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

def main():
    input_file = Path('final_enriched_summer25 - final_enriched_summer25.csv')
    
    print("="*70)
    print("EXTRACTING REAL FOUNDER DATA FROM YC PAGES")
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
    
    print(f"\n🔍 Need to extract real data for {len(pattern_companies)} companies")
    print(f"   This will visit each YC company page to extract founder info")
    
    # List companies that need real data
    print(f"\n📋 Companies needing real data:")
    for idx, company in enumerate(pattern_companies[:10], 1):
        print(f"   {idx}. {company.get('Company_Name')} - {company.get('YC_Link', '')}")
    if len(pattern_companies) > 10:
        print(f"   ... and {len(pattern_companies) - 10} more")
    
    return pattern_companies, companies, input_file, fieldnames

if __name__ == "__main__":
    pattern_companies, all_companies, csv_file, fieldnames = main()
    print(f"\n📋 Ready to process {len(pattern_companies)} companies")


