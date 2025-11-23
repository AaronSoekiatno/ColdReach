"""
Script to update the existing CSV file with real founder data.
Reads the existing CSV, extracts founder info, and updates in place.
"""
import csv
import json
import re
from pathlib import Path

def extract_company_slug(yc_link):
    """Extract company slug from YC link"""
    if not yc_link:
        return None
    match = re.search(r'/companies/([^/]+)', yc_link)
    if match:
        return match.group(1)
    return None

def extract_domain_from_website(website):
    """Extract domain from website URL"""
    if not website:
        return None
    # Remove http://, https://, www.
    domain = website.replace('http://', '').replace('https://', '').replace('www.', '')
    # Remove trailing slash
    domain = domain.rstrip('/')
    return domain

def generate_email_from_domain(domain, first_name, last_name):
    """Generate likely email from domain and name"""
    if not domain or not first_name:
        return f"hello@{domain}"
    
    first_lower = first_name.lower()
    last_lower = last_name.lower() if last_name else ""
    
    # Common patterns
    patterns = [
        f"{first_lower}@{domain}",
        f"{first_lower}.{last_lower}@{domain}" if last_lower else None,
        f"{first_lower}{last_lower}@{domain}" if last_lower else None,
    ]
    return [p for p in patterns if p][0] if any(p for p in patterns if p) else f"hello@{domain}"

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
    
    print(f"   Found {len(companies)} companies")
    
    # Identify pattern companies
    pattern_companies = [c for c in companies if c.get('data_quality') == '🤖 PATTERN']
    real_companies = [c for c in companies if c.get('data_quality') == '✅ REAL']
    
    print(f"   ✅ REAL: {len(real_companies)}")
    print(f"   🤖 PATTERN: {len(pattern_companies)}")
    
    if not pattern_companies:
        print("\n✅ All companies already have REAL data!")
        return
    
    print(f"\n🔍 Will update {len(pattern_companies)} pattern companies")
    print(f"   This script will update the CSV file in place")
    print(f"   All companies will be marked as ✅ REAL after update")
    
    # For now, we'll use web search to find founder data
    # This is a placeholder - actual implementation would use browser automation
    # or web search API to extract founder info from YC pages
    
    print(f"\n⚠️  This script requires founder data extraction.")
    print(f"   For each pattern company, we need to:")
    print(f"   1. Visit their YC page (from YC_Link)")
    print(f"   2. Extract founder name(s) and LinkedIn")
    print(f"   3. Generate email from domain")
    print(f"   4. Update the CSV")
    
    return pattern_companies, companies, input_file

if __name__ == "__main__":
    pattern_companies, all_companies, csv_file = main()
    print(f"\n📋 Ready to process {len(pattern_companies)} pattern companies")
    print(f"   CSV file: {csv_file}")

