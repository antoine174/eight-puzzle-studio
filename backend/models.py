from pydantic import BaseModel
from typing import List

class SolveRequest(BaseModel):
    initial_state: List[int]
    algorithm: str
    max_depth: int = 30

class StepSnapshot(BaseModel):
    step_number: int
    action: str
    board: List[int]

class SolveResponse(BaseModel):
    algorithm: str
    solvable: bool
    inversions: int
    path_to_goal: List[str]
    cost_of_path: int
    nodes_expanded: int
    search_depth: int
    max_search_depth: int
    running_time_ms: float
    traceable_steps: List[StepSnapshot]  # The final winning path
    expanded_steps: List[StepSnapshot]   # Chronological nodes expanded (with backtracking & depth restarts)