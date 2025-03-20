import sys
import json
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences

# Example Tokenizer and max_len (you can modify this based on your actual tokenizer and max_len)
tokenizer = Tokenizer()
max_len = 100

def preprocess_input(text, tokenizer, max_len):
    # Fit the tokenizer on the text if it's not already fitted
    tokenizer.fit_on_texts([text])
    
    # Debugging statements should not be part of the JSON output
    print(f"Original text: {text}", file=sys.stderr)  # Send to stderr for debugging purposes
    
    # Tokenize the input text
    sequence = tokenizer.texts_to_sequences([text])
    print(f"Tokenized sequence: {sequence}", file=sys.stderr)  # Send to stderr
    
    # Pad the sequences to ensure consistent length
    padded_sequence = pad_sequences(sequence, maxlen=max_len, padding='post')
    print(f"Padded sequence: {padded_sequence}", file=sys.stderr)  # Send to stderr
    
    return padded_sequence  # This is the actual JSON output

def postprocess_output(sequence, tokenizer):
    # Convert sequence back to text
    text = tokenizer.sequences_to_texts(sequence)
    return text

# Main code to handle input and call the functions
if __name__ == "__main__":
    action = sys.argv[1]
    
    if action == "preprocess":
        input_text = sys.argv[2]
        result = preprocess_input(input_text, tokenizer, max_len)
        print(json.dumps(result.tolist()))  # Return the result as JSON
    elif action == "postprocess":
        input_sequence = json.loads(sys.argv[2])
        result = postprocess_output(input_sequence, tokenizer)
        print(json.dumps(result))  # Return the result as JSON
