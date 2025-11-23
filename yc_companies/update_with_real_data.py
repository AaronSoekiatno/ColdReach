"""
Script to help update REAL_FOUNDERS dictionary with real founder data.
This script reads pattern companies and helps systematically add real data.
"""
import json
import csv
from pathlib import Path
import re

def extract_domain_from_website(website):
    """Extract clean domain from website"""
    if not website:
        return None
    # Remove http://, https://, www.
    domain = website.replace('http://', '').replace('https://', '').replace('www.', '')
    # Remove trailing slash
    domain = domain.rstrip('/')
    return domain

def generate_email_from_name(domain, first_name, last_name):
    """Generate likely email format"""
    if not domain or not first_name:
        return None
    first_lower = first_name.lower()
    last_lower = last_name.lower() if last_name else ''
    
    # Common email patterns
    patterns = [
        f"{first_lower}@{domain}",
        f"{first_lower}.{last_lower}@{domain}" if last_lower else None,
        f"{first_lower}{last_lower}@{domain}" if last_lower else None,
    ]
    return [p for p in patterns if p]

def main():
    """Read enriched data and identify companies needing real founder data"""
    json_file = Path('final_enriched_summer25 - final_enriched_summer25.json')
    
    with open(json_file, 'r', encoding='utf-8') as f:
        companies = json.load(f)
    
    pattern_companies = [c for c in companies if c.get('data_quality') == '🤖 PATTERN']
    
    print("="*70)
    print("COMPANIES NEEDING REAL FOUNDER DATA")
    print("="*70)
    print(f"\nTotal pattern companies: {len(pattern_companies)}\n")
    
    # Group by first letter for easier navigation
    print("Companies by name:\n")
    for i, company in enumerate(pattern_companies, 1):
        yc_link = company.get('YC_Link', '')
        website = company.get('website', '')
        desc = company.get('company_description', '')[:60]
        
        print(f"{i:3d}. {company['Company_Name']}")
        print(f"     YC: {yc_link}")
        print(f"     Website: {website}")
        print(f"     Desc: {desc}...")
        print()
        
        if i >= 20:  # Show first 20
            print(f"... and {len(pattern_companies) - 20} more companies")
            break

if __name__ == "__main__":
    main()

