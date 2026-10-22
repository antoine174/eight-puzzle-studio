from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import SolveRequest
from utils import is_solvable

from algorithms.bfs import solve_bfs
from algorithms.dfs import solve_dfs
from algorithms.iddfs import solve_iddfs
from algorithms.astar_manhattan import solve_astar_manhattan
from algorithms.astar_euclidean import solve_astar_euclidean

app = FastAPI(title="8-Puzzle AI Search Studio")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALGORITHM_MAP = {
    "bfs": solve_bfs,
    "dfs": solve_dfs,
    "iddfs": solve_iddfs,
    "astar_manhattan": solve_astar_manhattan,
    "astar_euclidean": solve_astar_euclidean,
}

# Safe cap per algorithm in Arena mode so 5 simultaneous boards never lag the browser
ARENA_STEP_CAP = 500

@app.post("/api/solve")
async def solve_puzzle(request: SolveRequest):
    if sorted(request.initial_state) != [0, 1, 2, 3, 4, 5, 6, 7, 8]:
        raise HTTPException(status_code=400, detail="Board must contain digits 0-8 exactly once.")

    state = tuple(request.initial_state)
    solvable, _ = is_solvable(list(state))
    if not solvable:
        raise HTTPException(status_code=400, detail="Board is unsolvable (odd inversions).")

    algo_fn = ALGORITHM_MAP.get(request.algorithm)
    if not algo_fn:
        raise HTTPException(status_code=400, detail=f"Unknown algorithm: {request.algorithm}")

    if request.algorithm == "iddfs":
        return algo_fn(state, max_depth_limit=request.max_depth)
    return algo_fn(state)

@app.post("/api/benchmark")
async def benchmark_puzzle(request: SolveRequest):
    if sorted(request.initial_state) != [0, 1, 2, 3, 4, 5, 6, 7, 8]:
        raise HTTPException(status_code=400, detail="Board must contain digits 0-8 exactly once.")

    state = tuple(request.initial_state)
    solvable, _ = is_solvable(list(state))
    if not solvable:
        raise HTTPException(status_code=400, detail="Board is unsolvable (odd inversions).")

    benchmarks = []

    for algo_id, algo_fn in ALGORITHM_MAP.items():
        if algo_id == "iddfs":
            res = algo_fn(state, max_depth_limit=request.max_depth)
        else:
            res = algo_fn(state)

        res["algo_id"] = algo_id
        res["trace_truncated"] = False
        benchmarks.append(res)

    return {"benchmarks": benchmarks}