import pandas as pd

def load_dataset(file_path):
    """
    Load the dataset from a CSV file.
    """
    data = pd.read_csv(file_path)
    print(f"Dataset loaded with shape: {data.shape}")
    return data

def inspect_dataset(data):
    """
    Inspect the dataset for missing values, class imbalance, and statistics.
    """
    print(data.info())
    print("Dataset Description:")
    print(data.describe())

    # Check for class imbalance
    print("Class distribution:")
    print(data['refactoring'].value_counts())
    print(f"Imbalance Ratio: {data['refactoring'].value_counts(normalize=True)}")
