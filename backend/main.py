from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import SolveRequest, SolveResponse
from utils import is_solvable
from algorithms.bfs import solve_bfs
from algorithms.dfs import solve_dfs
from algorithms.iddfs import solve_iddfs
from algorithms.astar_manhattan import solve_astar_manhattan
from algorithms.astar_euclidean import solve_astar_euclidean

app = FastAPI(title="8-Puzzle AI Telemetry Studio")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALGO_MAP = {
    "bfs": solve_bfs,
    "dfs": solve_dfs,
    "iddfs": solve_iddfs,
    "astar_manhattan": solve_astar_manhattan,
    "astar_euclidean": solve_astar_euclidean,
}

@app.post("/api/solve", response_model=SolveResponse)
def solve_puzzle(req: SolveRequest):
    if sorted(req.initial_state) != [0, 1, 2, 3, 4, 5, 6, 7, 8]:
        raise HTTPException(status_code=400, detail="Board must contain digits 0-8 exactly once.")

    solvable, inversions = is_solvable(req.initial_state)
    state_tuple = tuple(req.initial_state)

    if not solvable:
        return {
            "algorithm": req.algorithm,
            "solvable": False,
            "inversions": inversions,
            "path_to_goal": [],
            "cost_of_path": 0,
            "nodes_expanded": 0,
            "search_depth": 0,
            "max_search_depth": 0,
            "running_time_ms": 0.0,
            "traceable_steps": [],
            "explored_sample": [],
        }

    solver = ALGO_MAP.get(req.algorithm)
    if not solver:
        raise HTTPException(status_code=400, detail="Unknown algorithm")

    if req.algorithm == "iddfs":
        return solver(state_tuple, req.max_depth)
    return solver(state_tuple)

@app.post("/api/benchmark")
def benchmark_all(req: SolveRequest):
    """Runs all 5 algorithms on the same board to generate the Section 2.2 & 3.1 comparison."""
    state_tuple = tuple(req.initial_state)
    results = []
    for key, solver in ALGO_MAP.items():
        res = solver(state_tuple) if key != "iddfs" else solver(state_tuple, req.max_depth)
        results.append(res)
    return {"results": results}