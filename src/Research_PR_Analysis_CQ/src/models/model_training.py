import xgboost as xgb
import numpy as np
import seaborn as sns
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend to fix Tkinter error
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import RandomizedSearchCV, train_test_split
from imblearn.combine import SMOTEENN
from joblib import dump

def handle_imbalance(X, y):
    """
    Apply SMOTEENN (SMOTE + Edited Nearest Neighbors) to balance the dataset.
    """
    smote_enn = SMOTEENN(random_state=42)
    X_resampled, y_resampled = smote_enn.fit_resample(X, y)
    return X_resampled, y_resampled

def train_model(X_train, y_train, X_val, y_val):
    """
    Train an XGBoost model with early stopping.
    """
    model = xgb.XGBClassifier(
        n_estimators=500,
        max_depth=10,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        gamma=0.1,
        reg_lambda=0.5,
        reg_alpha=0.1,
        objective="binary:logistic",
        eval_metric="logloss",
        use_label_encoder=False
    )

    # Convert to DMatrix for better efficiency
    dtrain = xgb.DMatrix(X_train, label=y_train)
    dval = xgb.DMatrix(X_val, label=y_val)

    # Train with early stopping
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=True  # Enables logging for best iteration
    )

    return model

def evaluate_model(model, X_test, y_test):
    """
    Evaluate the model using multiple metrics.
    """
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]

    print("Model Evaluation Report:")
    print(classification_report(y_test, y_pred))

    roc_score = roc_auc_score(y_test, y_pred_proba)
    print(f"ROC AUC Score: {roc_score:.4f}")

    cm = confusion_matrix(y_test, y_pred)
    print("Confusion Matrix:")
    print(cm)

    # Plot Confusion Matrix
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=["Negative", "Positive"], yticklabels=["Negative", "Positive"])
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.title("Confusion Matrix")
    plt.savefig("confusion_matrix.png")  # Save the plot instead of displaying
    print("Confusion matrix saved as confusion_matrix.png")

def save_model(model, scaler, model_path, scaler_path):
    """
    Save the trained model and scaler for deployment.
    """
    dump(model, model_path)
    dump(scaler, scaler_path)
    print(f"Model saved to {model_path}")
    print(f"Scaler saved to {scaler_path}")

# Example Usage:
# X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
# X_train, y_train = handle_imbalance(X_train, y_train)
# model = train_xgb_model(X_train, y_train, X_test, y_test)
# evaluate_model(model, X_test, y_test)
# save_model(model, scaler, "xgb_model.pkl", "scaler.pkl")