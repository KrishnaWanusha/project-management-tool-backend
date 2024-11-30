from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer

def select_features(data):
    """
    Select numerical features from the dataset for training.
    """
    feature_columns = [
        'cbo', 'cboModified', 'fanin', 'fanout', 'wmc', 'dit', 'noc', 'rfc',
        'lcom', 'lcom*', 'tcc', 'loc', 'returnQty', 'loopQty', 'comparisonsQty',
        'tryCatchQty', 'stringLiteralsQty', 'numbersQty', 'assignmentsQty',
        'mathOperationsQty', 'variablesQty', 'maxNestedBlocksQty'
    ]
    return data[feature_columns]

def add_interaction_features(data):
    """
    Create interaction features to capture relationships between variables.
    """
    data['density'] = data['wmc'] / (data['loc'] + 1)  # Methods per line of code
    data['cohesion'] = data['tcc'] * data['lcom*']     # Combined cohesion metric
    return data

def preprocess_features(X):
    """
    Scale numerical features and handle missing values.
    """
    # Handle missing values (impute with the mean)
    imputer = SimpleImputer(strategy='mean')
    X_imputed = imputer.fit_transform(X)

    # Scale the features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_imputed)

    return X_scaled, scaler
