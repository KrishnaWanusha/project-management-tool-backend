import sys
import json
import re
from pdfminer.high_level import extract_text

def extract_requirement_sentences(text):
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)

    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)

    # Requirement modal keywords
    keywords = ['should', 'must', 'shall', 'could', 'can', 'may', 'might']

    # Remove filler words only from the beginning
    filler_pattern = re.compile(r'^(so|then|thus|therefore|and|but|because|well)\s+', re.IGNORECASE)

    filtered = []
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence or sentence.endswith('?'):
            continue
        if any(re.search(rf'\b{kw}\b', sentence, re.IGNORECASE) for kw in keywords):
            sentence = filler_pattern.sub('', sentence)
            filtered.append(sentence)
    return filtered

def extract_requirements(text):
    # Match sections
    functional_pattern = r'\s*Functional Requirements(.*?)(?=\s*Non[- ]Functional Requirements)'
    non_functional_pattern = r'\s*Non[- ]Functional Requirements(.*)'

    functional_match = re.search(functional_pattern, text, re.IGNORECASE | re.DOTALL)
    non_functional_match = re.search(non_functional_pattern, text, re.IGNORECASE | re.DOTALL)

    functional_raw = functional_match.group(1).strip() if functional_match else ""
    non_functional_raw = non_functional_match.group(1).strip() if non_functional_match else ""

    return {
        "functional_requirements": extract_requirement_sentences(functional_raw),
        "non_functional_requirements": extract_requirement_sentences(non_functional_raw)
    }

# Entry point
pdf_path = sys.argv[1]
text = extract_text(pdf_path)
requirements = extract_requirements(text)
print(json.dumps(requirements, indent=2))
