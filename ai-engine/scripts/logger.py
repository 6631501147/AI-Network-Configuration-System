"""
Activity Logger
Satisfies Security Requirement: Configuration activity logging.
Writes timestamped entries to logs/activity.log
"""

import logging
import os
from datetime import datetime

# Ensure the logs directory exists
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "activity.log")

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),  # also echo to console
    ],
)

logger = logging.getLogger("NetConfAI")


def log_info(message: str):
    """Log an informational activity entry."""
    logger.info(message)


def log_success(message: str):
    """Log a successful operation."""
    logger.info(f"[SUCCESS] {message}")


def log_error(message: str):
    """Log an error or failure."""
    logger.error(f"[ERROR] {message}")


def log_warning(message: str):
    """Log a warning."""
    logger.warning(f"[WARNING] {message}")


def log_session_start():
    """Log the start of an automation session."""
    separator = "=" * 70
    logger.info(separator)
    logger.info(f"NEW SESSION STARTED at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(separator)


def log_session_end():
    """Log the end of an automation session."""
    logger.info(f"SESSION ENDED at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 70)
