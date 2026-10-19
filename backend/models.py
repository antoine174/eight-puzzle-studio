from pydantic import BaseModel
from typing import List

class SolveRequest(BaseModel):
    initial_state: List[int]  # e.g., [1, 2, 5, 3, 4, 0, 6, 7, 8]
    algorithm: str            # bfs dfs iddfs
    max_depth: int = 30       

class StepSnapshot(BaseModel):
    step_number: int
    action: str               # 
    board: List[int]

class SolveResponse(BaseModel):
    algorithm: str
    solvable: bool
    inversions: int
    path_to_goal: List[str]   
    cost_of_path: int                 # Total moves made
    nodes_expanded: int               # Total states popped/expanded
    search_depth: int                 # Depth of the goal node
    max_search_depth: int             # Maximum depth reached in search space
    running_time_ms: float            # Execution time in milliseconds
    traceable_steps: List[StepSnapshot] # Every board configuration from start to goal