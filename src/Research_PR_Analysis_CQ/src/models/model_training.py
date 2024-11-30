import lightgbm as lgb
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import GridSearchCV
from imblearn.over_sampling import SMOTE
from joblib import dump

def handle_imbalance(X, y):
    """
    Apply SMOTE to balance the dataset.
    """
    smote = SMOTE(random_state=42)
    X_resampled, y_resampled = smote.fit_resample(X, y)
    return X_resampled, y_resampled

def train_model(X_train, y_train):
    """
    Train a LightGBM model with hyperparameter tuning.
    """
    param_grid = {
        'num_leaves': [31, 50],
        'max_depth': [-1, 10, 20],
        'learning_rate': [0.01, 0.1],
        'n_estimators': [100, 200]
    }

    model = lgb.LGBMClassifier(random_state=42)
    grid_search = GridSearchCV(model, param_grid, cv=3, scoring='f1', verbose=2)
    grid_search.fit(X_train, y_train)

    best_model = grid_search.best_estimator_
    print(f"Best Model Parameters: {grid_search.best_params_}")
    return best_model

def evaluate_model(model, X_test, y_test):
    """
    Evaluate the model and print classification report and confusion matrix.
    """
    y_pred = model.predict(X_test)
    print("Model Evaluation Report:")
    print(classification_report(y_test, y_pred))

    cm = confusion_matrix(y_test, y_pred)
    print("Confusion Matrix:")
    print(cm)

def save_model(model, scaler, model_path, scaler_path):
    """
    Save the trained model and scaler for deployment.
    """
    dump(model, model_path)
    dump(scaler, scaler_path)
    print(f"Model saved to {model_path}")
    print(f"Scaler saved to {scaler_path}")
