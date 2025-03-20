import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
import string
import numpy as np
import sys
import pickle

# Load the saved model
model = load_model('software_task_model.h5')

# Load tokenizers (ensure these tokenizers are saved correctly during training)
with open('tokenizer_inp.pkl', 'rb') as f_inp, open('tokenizer_out.pkl', 'rb') as f_out:
    tokenizer_inp = pickle.load(f_inp)
    tokenizer_out = pickle.load(f_out)

# Function to preprocess input text
def preprocess_input(text, tokenizer_inp, max_len=100):
    sequence = tokenizer_inp.texts_to_sequences([text])
    padded_sequence = pad_sequences(sequence, maxlen=max_len, padding='post')
    return padded_sequence

# Function to decode the output sequence
def decode_output(sequence, tokenizer_out):
    return tokenizer_out.sequences_to_texts(sequence)

# Main method to run the script
def main():

    input_text = "email notification setup"

    # Preprocess input text
    input_sequence = preprocess_input(input_text, tokenizer_inp)

    # Predict task (development task)
    output_sequence = model.predict([input_sequence, input_sequence])

    # Decode the output sequence (this will be the task)
    output_text = decode_output(output_sequence.argmax(axis=-1), tokenizer_out)
    print("Predicted Task:", output_text)

if __name__ == "__main__":
    main()
