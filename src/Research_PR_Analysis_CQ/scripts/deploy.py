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
def redirect_to_login(repo_name: str = None):
    """
    Redirect to the /login endpoint. Optionally include a `repo_name` in the query parameters.
    """
    if repo_name:
        return RedirectResponse(url=f"/login?repo_name={repo_name}")
    return RedirectResponse(url="/login")



@app.get("/login")
def login(repo_name: str = Query(None)):
    """
    Redirect users to GitHub's OAuth2 login page.
    If a `repo_name` is provided, include it in the callback URL.
    """
    redirect_uri = "http://127.0.0.1:8000/callback"
    if repo_name:
        redirect_uri = f"{redirect_uri}?repo_name={repo_name}"

    github_auth_url = (
        f"{GITHUB_AUTHORIZE_URL}?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}&scope=repo"
    )
    return RedirectResponse(github_auth_url)



@app.get("/callback")
def callback(code: str = Query(...), repo_name: str = Query(None)):
    """
    Handle the GitHub OAuth2 callback, exchange the code for an access token,
    store the user details, and analyze repositories or a specific repository.
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

    try:
        # Decide which analysis to perform
        if repo_name:
            logger.info(f"Analyzing specific repository: {repo_name} for user: {user['login']}")
            analysis_results = analyze_single_repo(user["login"], repo_name)
        else:
            logger.info(f"Analyzing all repositories for user: {user['login']}")
            analysis_results = analyze_all_repositories(user["login"])

    except Exception as e:
        logger.error(f"Error during analysis: {e}")
        raise HTTPException(status_code=400, detail=f"Error analyzing repositories: {str(e)}")

    return {
        "message": f"Welcome, {user['login']}! Analysis completed successfully.",
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
@app.get("/analyze_all_repos")
def analyze_all_repositories(username: str):
    """
    Analyze all pull requests (PRs) in repositories for the logged-in user and predict code quality.
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
                pull_requests = repo.get_pulls(state="all")
                pr_results = []

                if pull_requests.totalCount == 0:
                    logger.info(f"No pull requests found for repository: {repo_name}")
                    results.append({
                        "repo_name": repo_name,
                        "pull_requests": "No pull requests found."
                    })
                    continue

                logger.info(f"Found {pull_requests.totalCount} pull requests in repository: {repo_name}")

                for pr in pull_requests:
                    logger.info(f"Analyzing PR #{pr.number}: {pr.title}")

                    pr_files = pr.get_files()
                    code_metrics = []
                    unsupported_files = []

                    for file in pr_files:
                        if file.filename.endswith((".py", ".js" , ".ts" , ".tsx" , ".java" , ".cs" , ".html" , ".css" , ".jsx" )):
                            logger.debug(f"Analyzing file in PR: {file.filename}")
                            try:
                                # Fetch file content from the PR
                                content = repo.get_contents(file.filename).decoded_content.decode()
                                metrics = extract_metrics_from_code(content)
                                logger.info(f"Extracted metrics for file: {file.filename}")
                                code_metrics.append(metrics)
                            except Exception as file_error:
                                logger.error(f"Error analyzing file {file.filename} in PR #{pr.number}: {file_error}")
                        else:
                            logger.warning(f"Unsupported file type in PR #{pr.number}: {file.filename}")
                            unsupported_files.append(file.filename)

                    pr_result = {
                        "pr_number": pr.number,
                        "title": pr.title,
                        "unsupported_files": unsupported_files,
                    }

                    if code_metrics:
                        aggregated_metrics = aggregate_metrics(code_metrics)
                        logger.info(f"Aggregated metrics for PR #{pr.number}: {aggregated_metrics}")

                        input_features = np.array([list(aggregated_metrics.values())])
                        scaled_features = scaler.transform(input_features)
                        prediction = model.predict(scaled_features)
                        quality = "Good" if prediction[0] == 1 else "Bad"

                        logger.info(f"Prediction for PR #{pr.number} in repository {repo_name}: {quality}")
                        pr_result["quality"] = quality
                        pr_result["metrics"] = aggregated_metrics
                    else:
                        pr_result["quality"] = "No analysis (unsupported files only)"

                    pr_results.append(pr_result)

                results.append({"repo_name": repo_name, "pull_requests": pr_results})

            except Exception as repo_error:
                logger.error(f"Error analyzing repository {repo_name}: {repo_error}")

        logger.info(f"Completed analysis for user: {username}")
        return {"username": username, "repositories": results}

    except Exception as e:
        logger.error(f"Error analyzing repositories for user {username}: {e}")
        raise HTTPException(status_code=400, detail=f"Error analyzing repositories: {str(e)}")
    



@app.get("/analyze_single_repo")
def analyze_single_repo(username: str, repo_name: str = Query(None)):
    """
    Analyze pull requests in a specific repository for the logged-in user.
    Redirect to `/login` if the user is not authenticated and a `repo_name` is provided.
    """
    logger.info(f"Starting analysis for user: {username}, repository: {repo_name if repo_name else 'All Repositories'}")

    # Check if user is authenticated
    if username not in user_tokens:
        logger.error("User not authenticated")
        if repo_name:
            logger.info(f"Redirecting to login to analyze specific repository: {repo_name}")
            return RedirectResponse(url=f"/login?repo_name={repo_name}")
        raise HTTPException(status_code=403, detail="User not authenticated")

    if not repo_name:
        logger.error("No repository name provided")
        raise HTTPException(status_code=400, detail="Repository name is required")

    access_token = user_tokens[username]["access_token"]
    github = Github(access_token)

    try:
        # Fetch the repository for analysis
        repos = user_tokens[username]["repos"]
        matching_repo = next((repo for repo in repos if repo["full_name"] == repo_name), None)
        if not matching_repo:
            logger.warning(f"Repository {repo_name} not found for user: {username}")
            raise HTTPException(status_code=404, detail=f"Repository {repo_name} not found for user: {username}")

        logger.info(f"Analyzing repository: {repo_name}")
        repo = github.get_repo(repo_name)
        pull_requests = repo.get_pulls(state="all")

        pr_results = []
        if pull_requests.totalCount == 0:
            logger.info(f"No pull requests found for repository: {repo_name}")
            return {"repo_name": repo_name, "pull_requests": "No pull requests found."}

        logger.info(f"Found {pull_requests.totalCount} pull requests in repository: {repo_name}")
        for pr in pull_requests:
            logger.info(f"Analyzing PR #{pr.number}: {pr.title}")

            pr_files = pr.get_files()
            code_metrics = []
            unsupported_files = []

            for file in pr_files:
                if file.filename.endswith((".py", ".js", ".ts", ".tsx", ".java", ".cs", ".html", ".css", ".jsx")):
                    logger.debug(f"Analyzing file in PR: {file.filename}")
                    try:
                        content = fetch_file_content(repo.get_contents(file.filename))
                        if content:
                            metrics = extract_metrics_from_code(content)
                            logger.info(f"Extracted metrics for file: {file.filename}")
                            code_metrics.append(metrics)
                    except Exception as file_error:
                        logger.error(f"Error analyzing file {file.filename} in PR #{pr.number}: {file_error}")
                else:
                    logger.warning(f"Unsupported file type in PR #{pr.number}: {file.filename}")
                    unsupported_files.append(file.filename)

            pr_result = {
                "pr_number": pr.number,
                "title": pr.title,
                "unsupported_files": unsupported_files,
            }

            if code_metrics:
                aggregated_metrics = aggregate_metrics(code_metrics)
                logger.info(f"Aggregated metrics for PR #{pr.number}: {aggregated_metrics}")

                input_features = np.array([list(aggregated_metrics.values())])
                scaled_features = scaler.transform(input_features)
                prediction = model.predict(scaled_features)
                quality = "Good" if prediction[0] == 1 else "Bad"

                logger.info(f"Prediction for PR #{pr.number} in repository {repo_name}: {quality}")
                pr_result["quality"] = quality
                pr_result["metrics"] = aggregated_metrics
            else:
                pr_result["quality"] = "No analysis (unsupported files only)"

            pr_results.append(pr_result)

        return {"repo_name": repo_name, "pull_requests": pr_results}

    except Exception as repo_error:
        logger.error(f"Error analyzing repository {repo_name}: {repo_error}")
        raise HTTPException(status_code=400, detail=f"Error analyzing repository {repo_name}: {str(repo_error)}")









# def _get_repository_contents(repo, path=""):
#     """
#     Recursively fetch only .py and .js files in the repository, excluding public system-generated files
#     and specified formats like .png and .xml.
#     """
#     try:
#         logger.debug(f"Fetching contents for repo {repo.full_name}, path: {path}")
#         contents = repo.get_contents(path)
#         filtered_files = []

#         # Define patterns or filenames to exclude
#         excluded_files = {
#             "README.md", "LICENSE", ".gitignore", "package-lock.json", "yarn.lock", "Dockerfile",
#             ".github/", "__init__.py", "build/", "dist/", ".env", ".vscode/", "node_modules/", "public/"
#         }

#         for content in contents:
#             # Skip directories or files matching the excluded patterns
#             if content.type == "dir":
#                 if any(excluded in content.path for excluded in excluded_files):
#                     logger.debug(f"Skipping excluded directory: {content.path}")
#                     continue
#                 logger.debug(f"Entering directory: {content.path}")
#                 filtered_files.extend(_get_repository_contents(repo, content.path))
#             elif content.path.endswith((".py", ".js" , ".tsx" , ".java" , ".cs")) and not content.path.endswith((".png", ".xml")) and content.size < 1_000_000:
#                 if any(excluded in content.path for excluded in excluded_files):
#                     logger.debug(f"Skipping excluded file: {content.path}")
#                     continue
#                 logger.debug(f"Adding file: {content.path}")
#                 filtered_files.append(content)
#             else:
#                 logger.debug(f"Skipping file with unsupported format: {content.path}")

#         return filtered_files
#     except Exception as e:
#         logger.error(f"Error fetching contents for repo {repo.full_name}, path {path}: {e}")
#         return []




def extract_metrics_from_code(code):
    """
    Extract metrics from a code file dynamically based on its content.
    All numeric return values are rounded to two decimal places.
    """
    import re  # Import required module

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

    # Create the metrics dictionary with rounded values
    metrics = {
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

    # Round all values to 2 decimal places
    rounded_metrics = {key: round(value, 2) if isinstance(value, float) else value for key, value in metrics.items()}

    return rounded_metrics


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
    Ensure all values are rounded to two decimal places.
    """
    if not metrics_list:
        return {}

    # Initialize the aggregated dictionary
    aggregated = {key: 0 for key in metrics_list[0]}

    # Sum up all the metrics
    for metrics in metrics_list:
        for key, value in metrics.items():
            aggregated[key] += value

    # Calculate the average and round to two decimal places
    aggregated = {key: round(value / len(metrics_list), 2) for key, value in aggregated.items()}

    return aggregated
