from src.data.data_loader import load_dataset, inspect_dataset
from src.features.feature_engineering import select_features, add_interaction_features, preprocess_features
from src.models.model_training import handle_imbalance, train_model, evaluate_model, save_model
from sklearn.model_selection import train_test_split

def main():
    # Load and inspect data
    file_path = "data/OnlyNonTrivial_dt.csv"  # Ensure this path is correct
    data = load_dataset(file_path)
    inspect_dataset(data)

    # Drop rows where the target variable is missing
    data = data.dropna(subset=['refactoring'])

    # Add interaction features
    data = add_interaction_features(data)

    # Feature selection and preprocessing
    X = select_features(data)
    y = data['refactoring']
    X_scaled, scaler = preprocess_features(X)

    # Handle class imbalance
    X_resampled, y_resampled = handle_imbalance(X_scaled, y)

    # Split data into train, validation, and test sets
    X_train, X_temp, y_train, y_temp = train_test_split(X_resampled, y_resampled, test_size=0.3, random_state=42)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42)

    # Train the model using XGBoost with validation set
    model = train_model(X_train, y_train, X_val, y_val)

    # Evaluate the model
    evaluate_model(model, X_test, y_test)

    # Save the model and scaler
    save_model(model, scaler, "models/improved_xgb_model.pkl", "models/improved_scaler.pkl")

if __name__ == "__main__":
    main()