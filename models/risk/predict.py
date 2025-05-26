import sys
import json
import os
import joblib
import numpy as np
import tensorflow as tf
from tensorflow import keras
import pandas as pd
from sklearn.metrics import mean_absolute_error, accuracy_score
import time
from datetime import datetime

# Path to models
MODEL_DIR = os.path.dirname(__file__)

# Valid story point values in Fibonacci sequence used in Agile
VALID_STORY_POINTS = [0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100]

# Global models cache to avoid reloading models
_MODELS_CACHE = None

# Helper function to convert numpy types to standard Python types
def convert_to_serializable(obj):
    """Convert numpy types to standard Python types for JSON serialization"""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, (np.ndarray,)):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_serializable(item) for item in obj]
    else:
        return obj

# Define a custom MSE loss function 
def mse(y_true, y_pred):
    return tf.reduce_mean(tf.square(y_true - y_pred))

# Register the MSE function with Keras
keras.utils.get_custom_objects().update({'mse': mse})

def load_models():
    """Load all required models"""
    # Use stderr for logging instead of stdout
    print("Loading models...", file=sys.stderr)
    start_time = time.time()
    try:
        # Load Random Forest model
        rf_model = joblib.load(os.path.join(MODEL_DIR, 'rf_model.joblib'))
        print(f"RF model loaded successfully ({time.time() - start_time:.2f}s)", file=sys.stderr)
        
        # Load TF-IDF vectorizer
        tfidf = joblib.load(os.path.join(MODEL_DIR, 'vectorizer.joblib'))
        print(f"TF-IDF vectorizer loaded successfully ({time.time() - start_time:.2f}s)", file=sys.stderr)
        
        # Load DQN model
        dqn_model = keras.models.load_model(os.path.join(MODEL_DIR, 'dqn_model.h5'), compile=False)
        dqn_model.compile(optimizer='adam', loss='mse')
        print(f"DQN model loaded successfully ({time.time() - start_time:.2f}s)", file=sys.stderr)
        
        # Load label mappings
        label_mapping = joblib.load(os.path.join(MODEL_DIR, 'label_mapping.joblib'))
        inverse_mapping = joblib.load(os.path.join(MODEL_DIR, 'inverse_mapping.joblib'))
        print(f"Label mappings loaded successfully ({time.time() - start_time:.2f}s)", file=sys.stderr)
        
        return {
            'rf_model': rf_model,
            'tfidf': tfidf,
            'dqn_model': dqn_model,
            'label_mapping': label_mapping,
            'inverse_mapping': inverse_mapping
        }
    except Exception as e:
        print(f"Error loading models: {e}", file=sys.stderr)
        sys.exit(1)

def get_models():
    """Get models from cache or load them if not cached"""
    global _MODELS_CACHE
    if _MODELS_CACHE is None:
        _MODELS_CACHE = load_models()
    return _MODELS_CACHE

def preprocess_text(text, tfidf):
    """Preprocess and vectorize text"""
    # Handle missing text
    if text is None or text == '':
        text = ''
    
    # Transform using the pre-trained vectorizer
    X = tfidf.transform([text])
    return X

def preprocess_batch(texts, tfidf):
    """Preprocess and vectorize multiple texts at once"""
    # Handle missing texts
    cleaned_texts = ['' if t is None or t == '' else t for t in texts]
    
    # Transform using the pre-trained vectorizer
    X = tfidf.transform(cleaned_texts)
    return X

def map_to_valid_story_point(value):
    """Map any value to the closest valid story point"""
    if value in VALID_STORY_POINTS:
        return value
    
    # If negative or very small, return the smallest valid point
    if value <= 0:
        return 1
    
    # Find closest valid story point
    closest = min(VALID_STORY_POINTS, key=lambda x: abs(x - value))
    return closest

def normalize_confidence(q_values):
    """Normalize the confidence value to a 0-1 scale with higher baseline values"""
    q_min = np.min(q_values)
    q_max = np.max(q_values)
    
    # Handle edge case of all identical values
    if q_max == q_min:
        return 0.7  # Return a moderate-high confidence by default
    
    # Calculate the range and relative position of max value
    q_range = q_max - q_min
    relative_strength = q_range / (np.max(np.abs(q_values)) + 1e-10)
    
    # Boost the baseline confidence (values will typically range from 0.5 to 0.95)
    # This gives a more optimistic and intuitive confidence score
    boosted_confidence = 0.5 + (relative_strength * 0.45)
    
    # Further adjust higher values to create more separation in the upper range
    if relative_strength > 0.5:
        boosted_confidence = min(0.95, boosted_confidence + (relative_strength - 0.5) * 0.2)
        
    return boosted_confidence

def calculate_dynamic_influence(confidence, base_influence=0.3):
    """Calculate dynamic DQN influence based on confidence
    
    Returns influence value between 0.1 and 0.7 based on confidence
    """
    # Scale influence between 0.1 (low confidence) and 0.7 (high confidence)
    if confidence > 0.8:
        return min(0.7, base_influence * 1.5)
    elif confidence < 0.4:
        return max(0.1, base_influence * 0.5)
    
    # Linear interpolation for values in between
    return base_influence

def predict(title, description, models=None, dqn_influence=0.3, use_dynamic_influence=False):
    """Make story point prediction with controlled DQN influence
    
    Args:
        title: User story title
        description: User story description
        models: Dictionary containing loaded models (or None to use cached)
        dqn_influence: Weight of DQN adjustment (0.0-1.0)
        use_dynamic_influence: Whether to use confidence-based dynamic influence
    
    Returns:
        Dictionary with prediction results
    """
    # Get models from cache if not provided
    if models is None:
        models = get_models()
    
    # Combine title and description
    text = f"{title} {description}"
    
    # Preprocess text
    X = preprocess_text(text, models['tfidf'])
    
    # Initial prediction from Random Forest
    rf_prediction = models['rf_model'].predict(X)[0]
    rf_index = int(rf_prediction)
    
    # Refine prediction using DQN
    num_classes = len(models['label_mapping'])
    state = np.zeros(num_classes)
    state[rf_index] = 1
    
    # Get Q-values
    q_values = models['dqn_model'].predict(state.reshape(1, -1), verbose=0)[0]
    
    # Calculate normalized confidence (0-1 scale)
    raw_confidence = float(np.max(q_values))
    normalized_confidence = normalize_confidence(q_values)
    
    # Choose best action
    action = np.argmax(q_values)
    
    # Convert action to adjustment
    full_adjustment = action - num_classes
    
    # Apply dynamic influence if enabled
    if use_dynamic_influence:
        dqn_influence = calculate_dynamic_influence(normalized_confidence, dqn_influence)
    
    # Apply controlled adjustment based on influence factor
    if dqn_influence < 1.0:
        # Scale the adjustment based on influence factor
        actual_adjustment = int(full_adjustment * dqn_influence)
    else:
        actual_adjustment = full_adjustment
    
    adjusted_index = rf_index + actual_adjustment
    adjusted_index = max(0, min(num_classes - 1, adjusted_index))
    
    # Convert to original story point values
    rf_story_point = models['inverse_mapping'][rf_index]
    hybrid_story_point = models['inverse_mapping'][adjusted_index]
    
    # Handle -1 values or other invalid story points
    rf_story_point = map_to_valid_story_point(rf_story_point)
    hybrid_story_point = map_to_valid_story_point(hybrid_story_point)
    
    # Log predictions for debugging
    print(f"RF index: {rf_index}, Story point: {rf_story_point}", file=sys.stderr)
    print(f"Adjusted index: {adjusted_index}, Story point: {hybrid_story_point}", file=sys.stderr)
    print(f"Adjustment: {actual_adjustment} (full: {full_adjustment})", file=sys.stderr)
    print(f"Confidence: {normalized_confidence:.4f} (raw: {raw_confidence:.4f})", file=sys.stderr)
    if use_dynamic_influence:
        print(f"Dynamic influence: {dqn_influence:.4f}", file=sys.stderr)
    
    # Make sure everything is regular Python types, not numpy types
    return {
        'rf_prediction': int(rf_story_point),
        'adjusted_prediction': int(hybrid_story_point),
        'confidence': float(normalized_confidence),
        'raw_confidence': float(raw_confidence),
        'full_adjustment': int(full_adjustment),
        'applied_adjustment': int(actual_adjustment),
        'dqn_influence': float(dqn_influence)
    }

def batch_predict(items, models=None, dqn_influence=0.3, use_dynamic_influence=False):
    """Process multiple predictions in batch for efficiency
    
    Args:
        items: List of dictionaries with 'title' and 'description' keys
        models: Dictionary containing loaded models (or None to use cached)
        dqn_influence: Weight of DQN adjustment (0.0-1.0)
        use_dynamic_influence: Whether to use confidence-based dynamic influence
    
    Returns:
        List of prediction results
    """
    # Get models from cache if not provided
    if models is None:
        models = get_models()
    
    # Extract titles and descriptions
    titles = [item.get('title', '') for item in items]
    descriptions = [item.get('description', '') for item in items]
    
    # Combine titles and descriptions
    texts = [f"{title} {desc}" for title, desc in zip(titles, descriptions)]
    
    # Vectorize all texts at once
    X_batch = preprocess_batch(texts, models['tfidf'])
    
    # Make RF predictions for all items
    rf_predictions = models['rf_model'].predict(X_batch)
    
    results = []
    for i, (rf_pred, title, desc) in enumerate(zip(rf_predictions, titles, descriptions)):
        # Process each prediction individually using the RF prediction
        rf_index = int(rf_pred)
        
        # Refine prediction using DQN (same as in predict function)
        num_classes = len(models['label_mapping'])
        state = np.zeros(num_classes)
        state[rf_index] = 1
        
        # Get Q-values
        q_values = models['dqn_model'].predict(state.reshape(1, -1), verbose=0)[0]
        
        # Calculate normalized confidence
        raw_confidence = float(np.max(q_values))
        normalized_confidence = normalize_confidence(q_values)
        
        # Choose best action
        action = np.argmax(q_values)
        
        # Convert action to adjustment
        full_adjustment = action - num_classes
        
        # Apply dynamic influence if enabled
        current_influence = dqn_influence
        if use_dynamic_influence:
            current_influence = calculate_dynamic_influence(normalized_confidence, dqn_influence)
        
        # Apply controlled adjustment based on influence factor
        if current_influence < 1.0:
            actual_adjustment = int(full_adjustment * current_influence)
        else:
            actual_adjustment = full_adjustment
        
        adjusted_index = rf_index + actual_adjustment
        adjusted_index = max(0, min(num_classes - 1, adjusted_index))
        
        # Convert to original story point values
        rf_story_point = models['inverse_mapping'][rf_index]
        hybrid_story_point = models['inverse_mapping'][adjusted_index]
        
        # Handle -1 values or other invalid story points
        rf_story_point = map_to_valid_story_point(rf_story_point)
        hybrid_story_point = map_to_valid_story_point(hybrid_story_point)
        
        # Create result object
        result = {
            'rf_prediction': int(rf_story_point),
            'adjusted_prediction': int(hybrid_story_point),
            'confidence': float(normalized_confidence),
            'raw_confidence': float(raw_confidence),
            'full_adjustment': int(full_adjustment),
            'applied_adjustment': int(actual_adjustment),
            'dqn_influence': float(current_influence)
        }
        
        results.append(result)
        
        # Log progress for large batches
        if (i + 1) % 100 == 0:
            print(f"Processed {i + 1} / {len(items)} items", file=sys.stderr)
    
    return results

def validate_model(test_data_path, dqn_influence=0.3, use_dynamic_influence=False):
    """Validate model accuracy on test data
    
    Args:
        test_data_path: Path to CSV with test data
        dqn_influence: Weight of DQN adjustment (0.0-1.0)
        use_dynamic_influence: Whether to use confidence-based dynamic influence
    
    Returns:
        Dictionary with validation metrics
    """
    try:
        start_time = time.time()
        # Load test data
        test_data = pd.read_csv(test_data_path)
        print(f"Loaded test data with {len(test_data)} rows", file=sys.stderr)
        
        # Load models
        models = get_models()
        
        # Track predictions and actual values
        rf_predictions = []
        hybrid_predictions = []
        actual_points = []
        confidence_values = []
        full_adjustments = []
        applied_adjustments = []
        influence_values = [] # Track dynamic influence values if used
        
        # Prepare batch inputs
        items = [
            {'title': row['title'], 'description': row.get('description', '')}
            for _, row in test_data.iterrows()
        ]
        
        # Get actual story points
        actual_points = [map_to_valid_story_point(p) for p in test_data['storypoint']]
        
        # Perform batch prediction
        batch_results = batch_predict(items, models, dqn_influence, use_dynamic_influence)
        
        # Extract prediction results
        for result in batch_results:
            rf_predictions.append(result['rf_prediction'])
            hybrid_predictions.append(result['adjusted_prediction'])
            confidence_values.append(result['confidence'])
            full_adjustments.append(result['full_adjustment'])
            applied_adjustments.append(result['applied_adjustment'])
            influence_values.append(result['dqn_influence'])
        
        # Calculate metrics
        rf_accuracy = accuracy_score(actual_points, rf_predictions)
        hybrid_accuracy = accuracy_score(actual_points, hybrid_predictions)
        
        rf_mae = mean_absolute_error(actual_points, rf_predictions)
        hybrid_mae = mean_absolute_error(actual_points, hybrid_predictions)
        
        # Calculate accuracy within 1 and 2 points
        rf_within_1 = sum(abs(p - a) <= 1 for p, a in zip(rf_predictions, actual_points)) / len(actual_points)
        hybrid_within_1 = sum(abs(p - a) <= 1 for p, a in zip(hybrid_predictions, actual_points)) / len(actual_points)
        
        rf_within_2 = sum(abs(p - a) <= 2 for p, a in zip(rf_predictions, actual_points)) / len(actual_points)
        hybrid_within_2 = sum(abs(p - a) <= 2 for p, a in zip(hybrid_predictions, actual_points)) / len(actual_points)
        
        # Count improvements and worsening
        improved = sum(1 for rf, hyb, act in zip(rf_predictions, hybrid_predictions, actual_points) 
                      if abs(hyb - act) < abs(rf - act))
        worsened = sum(1 for rf, hyb, act in zip(rf_predictions, hybrid_predictions, actual_points) 
                      if abs(hyb - act) > abs(rf - act))
        unchanged = sum(1 for rf, hyb, act in zip(rf_predictions, hybrid_predictions, actual_points) 
                       if abs(hyb - act) == abs(rf - act))
        
        # Metrics to return
        metrics = {
            'rf_accuracy': float(rf_accuracy),
            'hybrid_accuracy': float(hybrid_accuracy),
            'accuracy_improvement': float(hybrid_accuracy - rf_accuracy),
            'accuracy_improvement_percentage': float((hybrid_accuracy - rf_accuracy) / rf_accuracy * 100 if rf_accuracy > 0 else 0),
            'rf_mae': float(rf_mae),
            'hybrid_mae': float(hybrid_mae),
            'mae_improvement': float(rf_mae - hybrid_mae),
            'mae_improvement_percentage': float((rf_mae - hybrid_mae) / rf_mae * 100 if rf_mae > 0 else 0),
            'rf_within_1': float(rf_within_1),
            'hybrid_within_1': float(hybrid_within_1),
            'rf_within_2': float(rf_within_2),
            'hybrid_within_2': float(hybrid_within_2),
            'stories_improved': int(improved),
            'stories_worsened': int(worsened),
            'stories_unchanged': int(unchanged),
            'improvement_rate': float(improved / len(actual_points)),
            'worsening_rate': float(worsened / len(actual_points)),
            'total_stories': int(len(actual_points)),
            'avg_confidence': float(sum(confidence_values) / len(confidence_values)),
            'avg_full_adjustment': float(sum(abs(adj) for adj in full_adjustments) / len(full_adjustments)),
            'avg_applied_adjustment': float(sum(abs(adj) for adj in applied_adjustments) / len(applied_adjustments)),
            'base_dqn_influence': float(dqn_influence),
            'used_dynamic_influence': bool(use_dynamic_influence),
            'dynamic_influence_used': bool(use_dynamic_influence),
            'execution_time_seconds': float(time.time() - start_time)
        }
        
        if use_dynamic_influence:
            metrics['avg_dynamic_influence'] = float(sum(influence_values) / len(influence_values))
            metrics['min_dynamic_influence'] = float(min(influence_values))
            metrics['max_dynamic_influence'] = float(max(influence_values))
        
        return metrics
        
    except Exception as e:
        print(f"Validation error: {e}", file=sys.stderr)
        return {'error': str(e)}

def find_optimal_influence(test_data_path, influence_values=None, use_dynamic_influence=False):
    """Find the optimal DQN influence value
    
    Args:
        test_data_path: Path to CSV with test data
        influence_values: List of influence values to test (default set of values if None)
        use_dynamic_influence: Whether to use confidence-based dynamic influence
    
    Returns:
        Dictionary with optimal influence results
    """
    if influence_values is None:
        influence_values = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0]
    
    best_influence = 0.0
    best_accuracy = 0.0
    results = []
    
    print("\nFinding optimal DQN influence value...", file=sys.stderr)
    overall_start = time.time()
    
    for influence in influence_values:
        print(f"\nTesting DQN influence: {influence:.1f}", file=sys.stderr)
        test_start = time.time()
        metrics = validate_model(test_data_path, influence, use_dynamic_influence)
        
        result = {
            'influence': influence,
            'hybrid_accuracy': metrics['hybrid_accuracy'],
            'rf_accuracy': metrics['rf_accuracy'],
            'improvement': metrics['accuracy_improvement'],
            'improvement_percentage': metrics['accuracy_improvement_percentage'],
            'improved_stories': metrics['stories_improved'],
            'worsened_stories': metrics['stories_worsened'],
            'unchanged_stories': metrics['stories_unchanged'],
            'execution_time_seconds': metrics['execution_time_seconds']
        }
        results.append(result)
        
        print(f"DQN Influence: {influence:.1f}", file=sys.stderr)
        print(f"Hybrid Accuracy: {metrics['hybrid_accuracy']:.4f}", file=sys.stderr)
        print(f"RF Accuracy: {metrics['rf_accuracy']:.4f}", file=sys.stderr)
        print(f"Improvement: {metrics['accuracy_improvement']:.4f} ({metrics['accuracy_improvement_percentage']:.2f}%)", file=sys.stderr)
        print(f"Time taken: {time.time() - test_start:.2f} seconds", file=sys.stderr)
        
        if metrics['hybrid_accuracy'] > best_accuracy:
            best_accuracy = metrics['hybrid_accuracy']
            best_influence = influence
    
    total_time = time.time() - overall_start
    print(f"\nBest DQN influence: {best_influence:.1f} with accuracy: {best_accuracy:.4f}", file=sys.stderr)
    print(f"Total optimization time: {total_time:.2f} seconds", file=sys.stderr)
    
    return {
        'best_influence': float(best_influence),
        'best_accuracy': float(best_accuracy),
        'results': results,
        'dynamic_influence_used': bool(use_dynamic_influence),
        'total_execution_time_seconds': float(total_time)
    }

def log_prediction(prediction_data, log_dir="prediction_logs"):
    """Log predictions to a file for monitoring model performance over time"""
    try:
        # Create log directory if it doesn't exist
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        # Create log filename based on date
        date_str = datetime.now().strftime("%Y-%m-%d")
        log_file = os.path.join(log_dir, f"predictions_{date_str}.jsonl")
        
        # Add timestamp to prediction data
        prediction_data['timestamp'] = datetime.now().isoformat()
        
        # Append to log file
        with open(log_file, 'a') as f:
            f.write(json.dumps(prediction_data) + '\n')
            
    except Exception as e:
        print(f"Error logging prediction: {e}", file=sys.stderr)

def main():
    """Main function to handle input and output"""
    # Parse command line arguments
    if len(sys.argv) > 1:
        try:
            # Check if it's a special command
            if sys.argv[1] == '--validate' and len(sys.argv) > 2:
                # Validation mode
                test_data_path = sys.argv[2]
                
                # Optional DQN influence parameter
                dqn_influence = 0.3  # Default to 0.3
                if len(sys.argv) > 3:
                    dqn_influence = float(sys.argv[3])
                
                # Optional dynamic influence flag
                use_dynamic_influence = False
                if len(sys.argv) > 4 and sys.argv[4].lower() == 'dynamic':
                    use_dynamic_influence = True
                
                # Run validation
                metrics = validate_model(test_data_path, dqn_influence, use_dynamic_influence)
                # Convert to serializable format
                metrics = convert_to_serializable(metrics)
                print(json.dumps(metrics))
                return
                
            elif sys.argv[1] == '--find-optimal' and len(sys.argv) > 2:
                # Find optimal influence mode
                test_data_path = sys.argv[2]
                
                # Optional influence values
                influence_values = None
                if len(sys.argv) > 3:
                    influence_values = [float(val) for val in sys.argv[3].split(',')]
                
                # Optional dynamic influence flag
                use_dynamic_influence = False
                if len(sys.argv) > 4 and sys.argv[4].lower() == 'dynamic':
                    use_dynamic_influence = True
                
                # Find optimal influence
                optimal = find_optimal_influence(test_data_path, influence_values, use_dynamic_influence)
                # Convert to serializable format
                optimal = convert_to_serializable(optimal)
                print(json.dumps(optimal))
                return
            
            # Normal prediction mode
            input_json = json.loads(sys.argv[1])
            
            # Optional DQN influence parameter (default to 0.3)
            dqn_influence = 0.3
            if len(sys.argv) > 2:
                dqn_influence = float(sys.argv[2])
            
            # Optional dynamic influence flag
            use_dynamic_influence = False
            if len(sys.argv) > 3 and sys.argv[3].lower() == 'dynamic':
                use_dynamic_influence = True
            
            # Load models once
            models = get_models()
            
            # Handle single prediction or batch predictions
            if isinstance(input_json, list):
                # Batch prediction
                results = batch_predict(input_json, models, dqn_influence, use_dynamic_influence)
                
                # Convert to serializable format and log predictions
                serializable_results = []
                for result in results:
                    # Log prediction for monitoring
                    if os.environ.get('ENABLE_PREDICTION_LOGGING', 'false').lower() == 'true':
                        log_prediction(result)
                    
                    # Convert to serializable format
                    serializable_result = convert_to_serializable(result)
                    serializable_results.append(serializable_result)
                
                # Print ONLY json to stdout
                print(json.dumps(serializable_results))
            else:
                # Single prediction
                title = input_json.get('title', '')
                description = input_json.get('description', '')
                result = predict(title, description, models, dqn_influence, use_dynamic_influence)
                
                # Log prediction for monitoring
                if os.environ.get('ENABLE_PREDICTION_LOGGING', 'false').lower() == 'true':
                    log_prediction({
                        'title': title,
                        'description': description,
                        **result
                    })
                
                # Convert to serializable format
                result = convert_to_serializable(result)
                
                # Print ONLY json to stdout
                print(json.dumps(result))
                
        except Exception as e:
            print(f"Failed to process input: {str(e)}", file=sys.stderr)
            # Print error as JSON to stdout
            print(json.dumps({
                'error': f"Failed to process input: {str(e)}"
            }))
            sys.exit(1)
    else:
        print(json.dumps({
            'error': 'No input provided. Usage: python predict.py <json_input> [dqn_influence] [dynamic] or python predict.py --validate <test_data_path> [dqn_influence] [dynamic]'
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()