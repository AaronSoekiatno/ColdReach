"""
Script to find founder information for batches of companies using web search
"""
import csv
from pathlib import Path

def get_companies_needing_founders():
    """Get list of companies that still need founder data"""
    input_file = Path('final_enriched_summer25 - final_enriched_summer25.csv')
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        companies = []
        for c in reader:
            founder_first = c.get('founder_first_name', '').strip()
            founder_email = c.get('founder_email', '').strip()
            
            # Pattern indicators
            if founder_first == 'Team' or founder_first == '':
                companies.append(c)
            elif founder_email.startswith('hello@'):
                companies.append(c)
            elif not c.get('founder_linkedin', '').strip():
                companies.append(c)
    
    return companies

def main():
    companies = get_companies_needing_founders()
    print(f"Companies needing founder data: {len(companies)}")
    print("\nFirst 20 companies:")
    for i, c in enumerate(companies[:20], 1):
        print(f"{i}. {c.get('Company_Name')} - {c.get('YC_Link', '')}")
    
    return companies

if __name__ == "__main__":
    companies = main()


