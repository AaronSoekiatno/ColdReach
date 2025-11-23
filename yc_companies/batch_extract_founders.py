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
    "Convexia": {
        "founder_first": "Ayaan",
        "founder_last": "Parikh",
        "founder_email": "ayaan@convexia.bio",
        "founder_linkedin": "linkedin.com/in/ayaan-parikh",
        "website": "convexia.bio",
    },
    "SigmanticAI": {
        "founder_first": "Rohil",
        "founder_last": "Khare",
        "founder_email": "rohil@sigmanticai.com",
        "founder_linkedin": "linkedin.com/in/rohil-khare",
        "website": "sigmanticai.com",
    },
    "Opennote": {
        "founder_first": "Rishi",
        "founder_last": "Srihari",
        "founder_email": "rishi@opennote.com",
        "founder_linkedin": "linkedin.com/in/rishi-srihari",
        "website": "opennote.com",
    },
    "Sira": {
        "founder_first": "Nathan",
        "founder_last": "Belaye",
        "founder_email": "nathan@sira.team",
        "founder_linkedin": "linkedin.com/in/nathan-belaye-931005149",
        "website": "sira.team",
    },
    "F4": {
        "founder_first": "Paul",
        "founder_last": "Shin",
        "founder_email": "paul@f4.dev",
        "founder_linkedin": "linkedin.com/in/paul-hyoungsang-shin",
        "website": "f4.dev",
    },
    "Eden": {
        "founder_first": "Alex",
        "founder_last": "Talamonti",
        "founder_email": "alex@tryeden.ai",
        "founder_linkedin": "linkedin.com/in/alexander-talamonti",
        "website": "tryeden.ai",
    },
    "Altur": {
        "founder_first": "Luis",
        "founder_last": "Olave",
        "founder_email": "luis@altur.io",
        "founder_linkedin": "linkedin.com/in/luis-olave",
        "website": "altur.io",
    },
    "PARES AI": {
        "founder_first": "Zihao",
        "founder_last": "Wang",
        "founder_email": "zihao@pares.ai",
        "founder_linkedin": "linkedin.com/in/zihao-wang-mh",
        "website": "pares.ai",
    },
    "Avelis Health": {
        "founder_first": "Angel",
        "founder_last": "Onuoha",
        "founder_email": "angel@avelishealth.com",
        "founder_linkedin": "linkedin.com/in/angel-onuoha",
        "website": "avelishealth.com",
    },
    "Nautilus": {
        "founder_first": "Amayr",
        "founder_last": "Babar",
        "founder_email": "amayr@nautilus.co",
        "founder_linkedin": "linkedin.com/in/amayrbabar",
        "website": "nautilus.co",
    },
    "Humoniq": {
        "founder_first": "Todd",
        "founder_last": "Sullivan",
        "founder_email": "todd@humoniq.ai",
        "founder_linkedin": "linkedin.com/in/todsul",
        "website": "humoniq.ai",
    },
    "Palace": {
        "founder_first": "Leeds",
        "founder_last": "Rising",
        "founder_email": "leeds@palace.so",
        "founder_linkedin": "linkedin.com/in/leedsrising",
        "website": "palace.so",
    },
    "Idler": {
        "founder_first": "Ivan",
        "founder_last": "Chub",
        "founder_email": "ivan@idler.ai",
        "founder_linkedin": "linkedin.com/in/ivanchub",
        "website": "idler.ai",
    },
    "Floot": {
        "founder_first": "Yujian",
        "founder_last": "Yao",
        "founder_email": "yujian@floot.com",
        "founder_linkedin": "linkedin.com/in/yjyao",
        "website": "floot.com",
    },
    "Alara": {
        "founder_first": "Sabrine",
        "founder_last": "Obbad",
        "founder_email": "sabrine@alaradental.com",
        "founder_linkedin": "linkedin.com/in/sabrineobbad",
        "website": "alaradental.com",
    },
    "Socratix AI": {
        "founder_first": "Riya",
        "founder_last": "Jagetia",
        "founder_email": "riya@getsocratix.ai",
        "founder_linkedin": "linkedin.com/in/riya-jagetia",
        "website": "getsocratix.ai",
    },
    "Minimal AI": {
        "founder_first": "Niek",
        "founder_last": "Hogenboom",
        "founder_email": "niek@gominimal.ai",
        "founder_linkedin": "linkedin.com/in/niek-hogenboom",
        "website": "gominimal.ai",
    },
    "Risely AI": {
        "founder_first": "Shahryar",
        "founder_last": "Abbasi",
        "founder_email": "founders@risely.ai",
        "founder_linkedin": "linkedin.com/in/shahryarabbasi",
        "website": "risely.ai",
    },
    "Omnara": {
        "founder_first": "Ishaan",
        "founder_last": "Sehgal",
        "founder_email": "ishaan@omnara.com",
        "founder_linkedin": "linkedin.com/in/ishaan-sehgal",
        "website": "omnara.com",
    },
    "Knowlify": {
        "founder_first": "Ritam",
        "founder_last": "Rana",
        "founder_email": "ritam@knowlify.net",
        "founder_linkedin": "linkedin.com/in/ritamrana",
        "website": "knowlify.net",
    },
    "Autosana": {
        "founder_first": "Yuvan",
        "founder_last": "Sundrani",
        "founder_email": "yuvan@autosana.ai",
        "founder_linkedin": "linkedin.com/in/yuvan-sundrani",
        "website": "autosana.ai",
    },
    "April": {
        "founder_first": "Neha",
        "founder_last": "Suresh",
        "founder_email": "neha@tryapril.com",
        "founder_linkedin": "linkedin.com/in/nehasuresh1904",
        "website": "tryapril.com",
    },
    "Iron Grid": {
        "founder_first": "Fern",
        "founder_last": "Morrison",
        "founder_email": "fern@getirongrid.com",
        "founder_linkedin": "linkedin.com/in/elizabeth-fern-morrison",
        "website": "getirongrid.com",
    },
    "Finto": {
        "founder_first": "Jonas",
        "founder_last": "Morgner",
        "founder_email": "jonasm@finto.de",
        "founder_linkedin": "linkedin.com/in/jonasmorgner",
        "website": "gofinto.com",
    },
    "Motives": {
        "founder_first": "Sean",
        "founder_last": "Conley",
        "founder_email": "sean@motives.ai",
        "founder_linkedin": "linkedin.com/in/sean-conley-397b69b8",
        "website": "motives.ai",
    },
    "Relling": {
        "founder_first": "Jai",
        "founder_last": "Relan",
        "founder_email": "jai@relling.co",
        "founder_linkedin": "linkedin.com/in/jairelan",
        "website": "relling.co",
    },
    "mcp-use": {
        "founder_first": "Pietro",
        "founder_last": "Zullo",
        "founder_email": "pietro@mcp-use.com",
        "founder_linkedin": "linkedin.com/in/pietrozullo",
        "website": "mcp-use.com",
    },
    "Novaflow": {
        "founder_first": "Aman",
        "founder_last": "Agarwal",
        "founder_email": "aman@novaflowapp.com",
        "founder_linkedin": "linkedin.com/in/aman-agarwal-ca",
        "website": "novaflowapp.com",
    },
    "Perseus Defense": {
        "founder_first": "Jason",
        "founder_last": "Cornelius",
        "founder_email": "jason@perseusdefense.com",
        "founder_linkedin": "linkedin.com/in/jason-k-cornelius",
        "website": "perseusdefense.com",
    },
    "Phases": {
        "founder_first": "James",
        "founder_last": "Wall",
        "founder_email": "james@phases.ai",
        "founder_linkedin": "linkedin.com/in/j-m-wall",
        "website": "phases.ai",
    },
    "Solva": {
        "founder_first": "Herman",
        "founder_last": "Båverud Olsson",
        "founder_email": "herman@solvatechnology.com",
        "founder_linkedin": "linkedin.com/in/hermanbaverudolsson",
        "website": "solvatechnology.com",
    },
    "Albacore Inc.": {
        "founder_first": "John",
        "founder_last": "Huddleston",
        "founder_email": "john@albacore.inc",
        "founder_linkedin": "linkedin.com/in/john-huddleston-3584121b7",
        "website": "albacore.inc",
    },
    "Riff": {
        "founder_first": "Adith",
        "founder_last": "Reddi",
        "founder_email": "adith@goriff.com",
        "founder_linkedin": "linkedin.com/in/adithreddi",
        "website": "goriff.com",
    },
    "Mohi": {
        "founder_first": "Evan",
        "founder_last": "Seeyave",
        "founder_email": "evan@trymohi.com",
        "founder_linkedin": "linkedin.com/in/evanseeyave",
        "website": "trymohi.com",
    },
    "Mimos": {
        "founder_first": "Rohit",
        "founder_last": "Sirosh",
        "founder_email": "rohit@trymimos.com",
        "founder_linkedin": "linkedin.com/in/rohit-sirosh",
        "website": "trymimos.com",
    },
    "Nozomio": {
        "founder_first": "Arlan",
        "founder_last": "Rakhmetzhanov",
        "founder_email": "arlan@nozomio.com",
        "founder_linkedin": "linkedin.com/in/arlan-rakhmetzhanov",
        "website": "nozomio.com",
    },
    "VibeFlow": {
        "founder_first": "Alessia",
        "founder_last": "Paccagnella",
        "founder_email": "alessia@vibeflow.ai",
        "founder_linkedin": "linkedin.com/in/alepacca",
        "website": "vibeflow.ai",
    },
    "Comena": {
        "founder_first": "Jiehua",
        "founder_last": "Wu",
        "founder_email": "jiehua.wu@comena.ai",
        "founder_linkedin": "linkedin.com/in/jiehua-wu",
        "website": "comena.ai",
    },
    "Normal": {
        "founder_first": "Anson",
        "founder_last": "Yu",
        "founder_email": "anson@normalfactory.com",
        "founder_linkedin": "linkedin.com/in/anson-yu-231336141",
        "website": "normalfactory.com",
    },
    "GhostEye": {
        "founder_first": "Mohammad",
        "founder_last": "Eshan",
        "founder_email": "founders@ghosteye.ai",
        "founder_linkedin": "linkedin.com/in/moheshan",
        "website": "ghosteye.ai",
    },
    "Channel3": {
        "founder_first": "Alexander",
        "founder_last": "Schiff",
        "founder_email": "founders@trychannel3.com",
        "founder_linkedin": "linkedin.com/in/alexanderschiff",
        "website": "trychannel3.com",
    },
    "Epicenter": {
        "founder_first": "Braden",
        "founder_last": "Wong",
        "founder_email": "braden@epicenter.md",
        "founder_linkedin": "linkedin.com/in/braden-wong",
        "website": "epicenter.md",
    },
    "Candytrail": {
        "founder_first": "Aditya",
        "founder_last": "Mahna",
        "founder_email": "founders@candytrail.ai",
        "founder_linkedin": "linkedin.com/in/aditya-mahna-b57256325",
        "website": "candytrail.ai",
    },
    "Embedder": {
        "founder_first": "Ethan",
        "founder_last": "Gibbs",
        "founder_email": "founders@embedder.dev",
        "founder_linkedin": "linkedin.com/in/etgibbs",
        "website": "embedder.com",
    },
    "Flai": {
        "founder_first": "Ari",
        "founder_last": "Polakof",
        "founder_email": "founders@useflai.com",
        "founder_linkedin": "linkedin.com/in/ari-polakof-78b976150",
        "website": "useflai.com",
    },
    "b-12": {
        "founder_first": "Zlatko",
        "founder_last": "Jončev",
        "founder_email": "founders@b12-labs.com",
        "founder_linkedin": "linkedin.com/in/zlatkojoncev",
        "website": "b12-labs.com",
    },
    "Trace": {
        "founder_first": "Tim",
        "founder_last": "Cherkasov",
        "founder_email": "founders@trace.so",
        "founder_linkedin": "linkedin.com/in/timcherkasov",
        "website": "trace.so",
    },
    "The Interface": {
        "founder_first": "Max",
        "founder_last": "Raven",
        "founder_email": "founders@theinterface.com",
        "founder_linkedin": "linkedin.com/in/ravenmax",
        "website": "theinterface.com",
    },
    "IronLedger.ai": {
        "founder_first": "Nick",
        "founder_last": "Amore",
        "founder_email": "sales@ironledger.ai",
        "founder_linkedin": "linkedin.com/in/nick-amore-6391a7129",
        "website": "ironledger.ai",
    },
    "Doe": {
        "founder_first": "Adrian",
        "founder_last": "Barbir",
        "founder_email": "founders@doe.so",
        "founder_linkedin": "linkedin.com/in/adrianbarbir",
        "website": "doe.so",
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

