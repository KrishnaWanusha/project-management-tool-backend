import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from github import Github
import requests
import numpy as np
from joblib import load
import radon.metrics
import radon.raw
import re
from scripts.logsModule import logger

# Load environment variables
load_dotenv()

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"

# FastAPI instance
app = FastAPI()

# Temporary storage for user tokens (replace with DB in production)
user_tokens = {}

# Load the ML model and scaler
model = load("models/improved_code_quality_model.pkl")
scaler = load("models/improved_scaler.pkl")


@app.get("/")
def redirect_to_login():
    """
    Automatically redirect the root URL (/) to the /login endpoint.
    """
    return RedirectResponse(url="/login")


@app.get("/login")
def login():
    """
    Redirect users to GitHub's OAuth2 login page.
    """
    redirect_uri = "http://127.0.0.1:8000/callback"
    github_auth_url = (
        f"{GITHUB_AUTHORIZE_URL}?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}&scope=repo"
    )
    return RedirectResponse(github_auth_url)


@app.get("/callback")
def callback(code: str = Query(...)):
    """
    Handle the GitHub OAuth2 callback, exchange the code for an access token,
    store the user details, and analyze repositories.
    """
    token_request = requests.post(
        GITHUB_ACCESS_TOKEN_URL,
        data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
        },
        headers={"Accept": "application/json"}
    )
    token_response = token_request.json()

    if "access_token" not in token_response:
        raise HTTPException(status_code=400, detail="Failed to fetch access token")

    access_token = token_response["access_token"]
    user = get_github_user(access_token)

    # Store the token and repositories for the user
    user_tokens[user["login"]] = {
        "access_token": access_token,
        "repos": get_user_repositories(access_token)
    }

    # Analyze repositories immediately after login
    try:
        analysis_results = analyze_repositories(user["login"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error analyzing repositories: {str(e)}")

    return {
        "message": f"Welcome, {user['login']}! Repositories analyzed successfully.",
        "analysis_results": analysis_results
    }



def get_github_user(access_token):
    """
    Get the authenticated GitHub user's details.
    """
    user_request = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    if user_request.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch user details")
    return user_request.json()


def get_user_repositories(access_token):
    """
    Fetch the repositories of the authenticated user.
    """
    repos_request = requests.get(
        "https://api.github.com/user/repos",
        headers={"Authorization": f"Bearer {access_token}"}
    )

    if repos_request.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch repositories")

    repos = repos_request.json()
    return [{"name": repo["name"], "full_name": repo["full_name"]} for repo in repos]


# Example of calling the function
@app.get("/analyze_repos")
def analyze_repositories(username: str):
    """
    Analyze repositories for the logged-in user and predict code quality.
    """
    logger.info(f"Starting analysis for user: {username}")

    if username not in user_tokens:
        logger.error("User not authenticated")
        raise HTTPException(status_code=403, detail="User not authenticated")

    access_token = user_tokens[username]["access_token"]
    github = Github(access_token)

    try:
        repos = user_tokens[username]["repos"]
        if not repos:
            logger.warning(f"No repositories found for user: {username}")
            raise HTTPException(status_code=404, detail="No repositories found")

        results = []
        logger.info(f"Found {len(repos)} repositories for user: {username}")

        for repo_info in repos:
            repo_name = repo_info["full_name"]
            logger.info(f"Analyzing repository: {repo_name}")

            try:
                repo = github.get_repo(repo_name)
                contents = _get_repository_contents(repo)
                logger.info(f"Fetched {len(contents)} files from repository: {repo_name}")

                code_metrics = []
                for content in contents:
                    logger.debug(f"Analyzing file: {content.path}")
                    metrics = extract_metrics_from_code(content.decoded_content.decode())
                    logger.info(f"Extracted metrics for file: {content.path}")
                    code_metrics.append(metrics)

                if code_metrics:
                    aggregated_metrics = aggregate_metrics(code_metrics)
                    logger.info(f"Aggregated metrics for repository: {repo_name}")

                    input_features = np.array([list(aggregated_metrics.values())])
                    scaled_features = scaler.transform(input_features)
                    prediction = model.predict(scaled_features)
                    quality = "Good" if prediction[0] == 1 else "Bad"

                    logger.info(f"Prediction for repository {repo_name}: {quality}")
                    results.append({"repo_name": repo_name, "quality": quality, "metrics": aggregated_metrics})

            except Exception as repo_error:
                logger.error(f"Error analyzing repository {repo_name}: {repo_error}")

        logger.info(f"Completed analysis for user: {username}")
        return {"username": username, "results": results}

    except Exception as e:
        logger.error(f"Error analyzing repositories for user {username}: {e}")
        raise HTTPException(status_code=400, detail=f"Error analyzing repositories: {str(e)}")






def _get_repository_contents(repo, path=""):
    """
    Recursively fetch only .py and .js files in the repository, excluding public system-generated files.
    """
    try:
        logger.debug(f"Fetching contents for repo {repo.full_name}, path: {path}")
        contents = repo.get_contents(path)
        filtered_files = []

        # Define patterns or filenames to exclude
        excluded_files = {
            "README.md", "LICENSE", ".gitignore", "package-lock.json", "yarn.lock", "Dockerfile",
            ".github/", "__init__.py", "build/", "dist/", ".env", ".vscode/", "node_modules/" , "public/"
        }

        for content in contents:
            # Skip directories or files matching the excluded patterns
            if content.type == "dir":
                if any(excluded in content.path for excluded in excluded_files):
                    logger.debug(f"Skipping excluded directory: {content.path}")
                    continue
                logger.debug(f"Entering directory: {content.path}")
                filtered_files.extend(_get_repository_contents(repo, content.path))
            elif content.path.endswith((".py", ".js")) and content.size < 1_000_000:
                if any(excluded in content.path for excluded in excluded_files):
                    logger.debug(f"Skipping excluded file: {content.path}")
                    continue
                logger.debug(f"Adding file: {content.path}")
                filtered_files.append(content)

        return filtered_files
    except Exception as e:
        logger.error(f"Error fetching contents for repo {repo.full_name}, path {path}: {e}")
        return []



def extract_metrics_from_code(code):
    """
    Extract metrics from a code file dynamically based on its content.
    """
    # Count lines of code (loc)
    loc = len(code.splitlines())

    # Count number of return statements
    return_qty = len(re.findall(r'\breturn\b', code))

    # Count number of loops (for, while)
    loop_qty = len(re.findall(r'\b(for|while)\b', code))

    # Count number of comparisons (e.g., ==, !=, <, >, <=, >=)
    comparisons_qty = len(re.findall(r'==|!=|<=|>=|<|>', code))

    # Count number of try-catch blocks
    try_catch_qty = len(re.findall(r'\btry\b|\bexcept\b', code))

    # Count number of string literals (e.g., "string" or 'string')
    string_literals_qty = len(re.findall(r'\".*?\"|\'.*?\'', code))

    # Count number of numeric literals
    numbers_qty = len(re.findall(r'\b\d+\b', code))

    # Count number of assignments (e.g., = but not ==)
    assignments_qty = len(re.findall(r'(?<![=!<>])=(?!=)', code))

    # Count number of mathematical operations (e.g., +, -, *, /, %)
    math_operations_qty = len(re.findall(r'[+\-*/%]', code))

    # Count number of variables (simple heuristic for variable-like identifiers)
    variables_qty = len(re.findall(r'\b[a-zA-Z_]\w*\b', code))

    # Simulate Weighted Methods per Class (wmc) based on function definitions
    wmc = len(re.findall(r'\bdef\b|\bfunction\b', code))

    # Simulate Depth of Inheritance Tree (dit) and Number of Children (noc)
    dit = len(re.findall(r'class\s+\w+\((\w+)\)', code))  # Depth inferred from inheritance
    noc = len(re.findall(r'class\s+\w+\s*:', code))  # Number of class definitions

    # Approximate Response for a Class (rfc) based on method calls
    rfc = len(re.findall(r'\.\w+\(', code))

    # Approximate Lack of Cohesion of Methods (lcom, lcom_star) based on variable usage
    variable_usage = len(re.findall(r'\bself\.\w+', code))  # Instance variables
    lcom = 1 - (variable_usage / max(1, wmc))  # Simplified cohesion calculation
    lcom_star = lcom / 2  # Approximation based on LCOM

    # Approximate Tight Class Cohesion (tcc)
    tcc = max(0, 1 - (lcom / max(1, noc)))

    # Cyclomatic Complexity (cbo, cboModified) based on conditional complexity
    cbo = len(re.findall(r'\bif\b|\belif\b|\belse\b|\bcase\b|\bwhen\b', code))
    cbo_modified = cbo + loop_qty + try_catch_qty

    # Fan-in and Fan-out (approximated based on function usage)
    fanin = len(re.findall(r'\bimport\b|\bfrom\b', code))
    fanout = len(re.findall(r'\bdef\b|\bfunction\b', code))

    # Maximum nested blocks
    max_nested_blocks_qty = len(re.findall(r'{|}', code)) // 2  # Basic block depth approximation

    # Return the dynamic metrics
    return {
        "cbo": cbo,
        "cboModified": cbo_modified,
        "fanin": fanin,
        "fanout": fanout,
        "wmc": wmc,
        "dit": dit,
        "noc": noc,
        "rfc": rfc,
        "lcom": lcom,
        "lcom_star": lcom_star,
        "tcc": tcc,
        "loc": loc,
        "returnQty": return_qty,
        "loopQty": loop_qty,
        "comparisonsQty": comparisons_qty,
        "tryCatchQty": try_catch_qty,
        "stringLiteralsQty": string_literals_qty,
        "numbersQty": numbers_qty,
        "assignmentsQty": assignments_qty,
        "mathOperationsQty": math_operations_qty,
        "variablesQty": variables_qty,
        "maxNestedBlocksQty": max_nested_blocks_qty
    }


def fetch_file_content(file):
    """
    Fetch file content with proper encoding handling.

    Args:
        file: The GitHub file object.

    Returns:
        str: Decoded file content, or None if decoding fails or file is binary.
    """
    try:
        # Attempt to decode as UTF-8
        return file.decoded_content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            # Fallback to Latin-1 encoding
            return file.decoded_content.decode("latin1")
        except Exception as e:
            print(f"Error decoding file {file.path}: {e}")
            return None
    except AttributeError:
        # Handle cases where content is None (e.g., binary files)
        print(f"File {file.path} appears to be binary or unsupported.")
        return None





def aggregate_metrics(metrics_list):
    """
    Aggregate metrics across all code files in a repository.
    """
    aggregated = {key: 0 for key in metrics_list[0]}
    for metrics in metrics_list:
        for key, value in metrics.items():
            aggregated[key] += value

    # Average the metrics
    for key in aggregated:
        aggregated[key] /= len(metrics_list)

    return aggregated
