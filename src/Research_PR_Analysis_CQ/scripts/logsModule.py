import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Set the logging level
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),  # Log to console
        logging.FileHandler("analyze_repositories.log")  # Log to file
    ]
)

# Create a logger instance
logger = logging.getLogger("analyze_repositories")
